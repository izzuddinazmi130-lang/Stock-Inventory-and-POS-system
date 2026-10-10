import React, { useEffect, useRef, useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, ShoppingCart, PackagePlus, ArrowDownToLine, History, Volume2, VolumeX } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { SaleReceipt, ReceiptModal } from '../../components/pos/Receipt';
import { Alert, Button, IconButton, SegmentedControl, useConfirm } from '../../components/ui';
import ProductFinder from './pos/ProductFinder';
import OrderPanel from './pos/OrderPanel';

const MAX_TILES = 60;

const rm = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;
const toSen = (n) => Math.round((parseFloat(n) || 0) * 100);


// Normalise a product row from GET /products into the cart item shape used by /qr/lookup
const toCartProduct = (p) => ({
  id: p.id,
  sku: p.sku || p.item_code,
  name: p.name || p.item_name,
  category: p.category,
  in_stock: parseInt(p.in_stock ?? p.quantity ?? 0, 10) || 0,
  price_customer: parseFloat(p.price_customer ?? p.selling_price ?? 0) || 0,
  price_dealer: parseFloat(p.price_dealer ?? 0) || 0,
  price_staff: parseFloat(p.price_staff ?? 0) || 0,
  cost_price: parseFloat(p.cost_price ?? 0) || 0,
  colour: p.colour || null,
  size: p.size || null,
  model: p.model || null,
});

export default function QrScanner({ embedded = false }) {
  const { user } = useAuth();
  const Wrap = embedded ? React.Fragment : Layout;
  // Head office does not sell; its sales view is Sales history
  if (user?.role === 'super_admin') return <Navigate to="/sales" replace />;
  return <PosTerminal Wrap={Wrap} user={user} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH ADMIN POS TERMINAL
// ═══════════════════════════════════════════════════════════════════════════
function PosTerminal({ Wrap, user }) {
  const branchId = user?.branch_id ? String(user.branch_id) : '';
  const branchName = user?.branch_name || 'My branch';
  const businessName = user?.business_name || '';

  // Catalog for this branch
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [looking, setLooking] = useState(false);

  // Sale settings
  const [mode, setMode] = useState('stock_out'); // 'stock_out' = sell, 'stock_in' = receive stock
  const [priceTier, setPriceTier] = useState('customer');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [storeId, setStoreId] = useState('');
  const [saleNote, setSaleNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Cart
  const [cart, setCart] = useState([]);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Camera
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamId, setSelectedCamId] = useState('');

  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const cameraActiveRef = useRef(false);
  const lastScanRef = useRef({ code: '', at: 0 });
  const scanHandlerRef = useRef(null);

  const isSale = mode === 'stock_out';

  // ── Data
  const loadProducts = () => {
    if (!branchId) { setProductsLoading(false); return; }
    setProductsLoading(true);
    api.get('/products', { params: { branch_id: branchId, sort: 'name_asc' } })
      .then(res => { if (res.data.success) setProducts(res.data.items || []); })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  };

  useEffect(() => {
    loadProducts();
    if (branchId) {
      api.get(`/branches/${branchId}/stores`).then(res => {
        if (res.data.success) {
          setStores((res.data.stores || res.data.data || []).filter(s => s.status === 'active' || s.status === 'upcoming'));
        }
      }).catch(() => setStores([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Hand-off from the Low stock page: /qr/scan?receive=12:10,15:4 opens "Receive stock" with those items
  const [searchParams, setSearchParams] = useSearchParams();
  const receiveParamHandled = useRef(false);
  useEffect(() => {
    const param = searchParams.get('receive');
    if (!param || receiveParamHandled.current || productsLoading) return;
    receiveParamHandled.current = true;
    const wanted = param.split(',').map(part => {
      const [id, qty] = part.split(':');
      return { id: parseInt(id, 10), qty: Math.max(1, parseInt(qty, 10) || 1) };
    }).filter(w => w.id);
    const lines = wanted
      .map(w => {
        const p = products.find(x => x.id === w.id);
        return p ? { ...toCartProduct(p), quantity: w.qty } : null;
      })
      .filter(Boolean);
    if (lines.length > 0) {
      setMode('stock_in');
      setCart(lines);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('receive');
    setSearchParams(next, { replace: true });
  }, [searchParams, productsLoading, products, setSearchParams]);

  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      if (!q) return true;
      return [p.name, p.item_name, p.sku, p.item_code, p.category, p.colour, p.size, p.model]
        .some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [products, search, category]);

  // ── Sound
  const playBeep = (freq = 880, duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // ── Cart
  const addToCart = (product) => {
    setErrorMessage(null);
    setCart(prev => {
      const idx = prev.findIndex(item => item.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setLastAddedId(product.id);
  };

  useEffect(() => {
    if (!lastAddedId) return;
    const t = setTimeout(() => setLastAddedId(null), 1200);
    return () => clearTimeout(t);
  }, [lastAddedId, cart]);

  const updateQuantity = (productId, qty) => {
    if (qty <= 0) { removeItem(productId); return; }
    setCart(prev => prev.map(item => (item.id === productId ? { ...item, quantity: qty } : item)));
  };
  const removeItem = (productId) => setCart(prev => prev.filter(item => item.id !== productId));
  const clearCart = () => { setCart([]); setErrorMessage(null); setSaleNote(''); setShowNote(false); };

  const unitPrice = (item) => {
    if (!isSale) return item.cost_price || 0;
    if (priceTier === 'dealer') return item.price_dealer || item.price_customer || 0;
    if (priceTier === 'staff') return item.price_staff || item.price_customer || 0;
    return item.price_customer || 0;
  };

  const grandTotal = cart.reduce((sum, item) => sum + unitPrice(item) * item.quantity, 0);
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const stockProblems = isSale ? cart.filter(item => item.quantity > item.in_stock) : [];
  // Cash: an empty "cash received" means the customer paid the exact amount
  const isCashSale = isSale && paymentMethod === 'cash';
  const cashSen = cashReceived === '' ? toSen(grandTotal) : toSen(cashReceived);
  const cashShortSen = isCashSale ? Math.max(0, toSen(grandTotal) - cashSen) : 0;
  const changeDue = isCashSale && cashShortSen === 0 ? (cashSen - toSen(grandTotal)) / 100 : 0;
  const cartQtyById = useMemo(() => Object.fromEntries(cart.map(i => [i.id, i.quantity])), [cart]);

  // ── Lookup by any code (SKU, QR token, name) through the server
  const lookupAndAdd = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code) return false;
    try {
      setLooking(true);
      const res = await api.get('/qr/lookup', { params: { code } });
      if (res.data.success && res.data.product) {
        playBeep(880, 0.12);
        addToCart(toCartProduct(res.data.product));
        return true;
      }
      setErrorMessage(`No product found for “${code}”.`);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || `No product found for “${code}”.`);
    } finally {
      setLooking(false);
    }
    playBeep(220, 0.2);
    return false;
  };

  // Camera / hardware scans. Ignore the same code seen again within 2.5s (camera keeps seeing it).
  const handleScannedCode = (rawCode) => {
    const now = Date.now();
    const last = lastScanRef.current;
    if (rawCode === last.code && now - last.at < 2500) return;
    if (now - last.at < 500) return;
    lastScanRef.current = { code: rawCode, at: now };
    lookupAndAdd(rawCode);
  };
  scanHandlerRef.current = handleScannedCode;

  // Search box: Enter adds an exact SKU match, the only match, or asks the server (QR tokens etc.)
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    const exact = products.find(p => String(p.sku || p.item_code || '').toLowerCase() === q.toLowerCase());
    const pick = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (pick) {
      playBeep(880, 0.12);
      addToCart(toCartProduct(pick));
      setSearch('');
      return;
    }
    if (await lookupAndAdd(q)) setSearch('');
  };

  const addTile = (p) => {
    const item = toCartProduct(p);
    playBeep(880, 0.08);
    addToCart(item);
  };

  // Hardware scanners type fast and end with Enter/Tab. Catch them even when no input is focused.
  useEffect(() => {
    let buffer = '';
    let lastKeyAt = 0;
    const onKey = (event) => {
      const t = event.target;
      if (t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      const now = Date.now();
      if (now - lastKeyAt > 100) buffer = '';
      lastKeyAt = now;
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (buffer.length >= 3) {
          event.preventDefault();
          const code = buffer;
          buffer = '';
          scanHandlerRef.current?.(code);
        }
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) buffer += event.key;
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // ── Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current && cameraActiveRef.current) {
      try { await html5QrCodeRef.current.stop(); } catch {}
      try { html5QrCodeRef.current.clear(); } catch {}
    }
    cameraActiveRef.current = false;
    html5QrCodeRef.current = null;
  };

  useEffect(() => () => { stopCamera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start the camera once its viewport is on screen; restart when the chosen camera changes
  useEffect(() => {
    if (!cameraOpen) { stopCamera(); return; }
    let cancelled = false;
    (async () => {
      await stopCamera();
      if (cancelled) return;
      // Phones only allow the camera on secure (https) pages
      if (!window.isSecureContext) {
        setCameraStatus('The camera only works on a secure (https) page. Open the https address of this system, or use “Scan from photo”.');
        return;
      }
      setCameraStatus('Starting camera…');
      const config = { fps: 12, qrbox: (w, h) => { const size = Math.max(160, Math.min(260, Math.floor(Math.min(w, h) * 0.7))); return { width: size, height: size }; } };
      const onScan = (decodedText) => scanHandlerRef.current?.(decodedText);
      const start = async (source) => {
        html5QrCodeRef.current = new Html5Qrcode('pos-camera-viewport');
        await html5QrCodeRef.current.start(source, config, onScan, () => {});
      };
      try {
        // Default: the back camera, asked for by facing mode (device lists put the front or ultra-wide camera last on many phones)
        try {
          await start(selectedCamId ? { deviceId: { exact: selectedCamId } } : { facingMode: 'environment' });
        } catch (firstErr) {
          if (!selectedCamId || /NotAllowed|Permission/i.test(String(firstErr))) throw firstErr;
          await stopCamera();
          await start({ facingMode: 'environment' }); // the chosen camera is gone: fall back to the back camera
        }
        cameraActiveRef.current = true;
        if (cancelled) { stopCamera(); return; }
        setCameraStatus('Point the camera at a product QR code');
        // Camera names are only readable once permission is granted
        Html5Qrcode.getCameras().then(devices => { if (!cancelled && devices?.length) setCameras(devices); }).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        const text = String(err?.name || err?.message || err);
        setCameraStatus(
          /NotAllowed|Permission|denied/i.test(text) ? 'Camera access is blocked. Allow the camera for this site in the browser settings, then tap the camera button again.'
          : /NotReadable|TrackStart|in use|Could not start/i.test(text) ? 'The camera is being used by another app. Close that app and try again.'
          : /NotFound|Overconstrained|no camera|Requested device not found/i.test(text) ? 'No camera was found on this device. Use “Scan from photo” or type the code.'
          : 'The camera could not start. Try again, or use “Scan from photo”.'
        );
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen, selectedCamId]);

  const handleImageUpload = async (file) => {
    if (!file) return;
    try {
      const reader = new Html5Qrcode('pos-file-sandbox');
      const decoded = await reader.scanFile(file, false);
      handleScannedCode(decoded);
    } catch {
      setErrorMessage('No QR code found in that image.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Checkout
  const handleConfirm = async () => {
    if (cart.length === 0) return;
    if (!branchId) { setErrorMessage('Your account is not assigned to a branch. Ask HQ to assign one.'); return; }
    if (stockProblems.length > 0) {
      setErrorMessage('Some items have more than is in stock. Lower the quantity or remove them.');
      return;
    }
    if (cashShortSen > 0) {
      setErrorMessage(`Cash received is ${rm(cashShortSen / 100)} short of the total.`);
      return;
    }
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await api.post('/qr/pos-transaction', {
        mode,
        price_tier: priceTier,
        payment_method: paymentMethod,
        store_id: storeId ? parseInt(storeId, 10) : null,
        note: saleNote.trim() || (isSale ? '' : 'Inventory Restock Intake'),
        cash_received: isCashSale ? cashSen / 100 : null,
        items: cart.map(item => ({ product_id: item.id, sku: item.sku, quantity: item.quantity }))
      });
      if (res.data.success) {
        playBeep(1200, 0.25);
        setReceipt({
          ...res.data,
          storeName: stores.find(s => String(s.id) === String(storeId))?.name || null,
          note: saleNote.trim()
        });
        setCart([]);
        setSaleNote('');
        setShowNote(false);
        setCashReceived('');
        loadProducts();
      } else {
        setErrorMessage(res.data.message || 'The transaction could not be completed.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = useConfirm();
  const switchMode = async (next) => {
    if (next === mode) return;
    if (cart.length > 0) {
      const ok = await confirm({
        title: next === 'stock_out' ? 'Switch to selling?' : 'Switch to receiving stock?',
        message: `The ${cart.length} item(s) in the list will be kept.`,
        confirmLabel: 'Switch',
      });
      if (!ok) return;
    }
    setMode(next);
    setErrorMessage(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Wrap>
      <div id="pos-file-sandbox" className="hidden" />

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-ink">Point of sale</h1>
          <p className="text-sm text-ink-muted truncate">{businessName && <>{businessName} · </>}{branchName}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SegmentedControl
            size="lg"
            label="Transaction type"
            value={mode}
            onChange={switchMode}
            fullWidth
            className="flex-1 sm:flex-none sm:w-auto"
            tabs={[
              { value: 'stock_out', label: 'Sell', icon: ShoppingCart, tone: 'accent' },
              { value: 'stock_in', label: 'Receive', icon: PackagePlus, tone: 'success' },
            ]}
          />
          <Button variant="secondary" size="lg" icon={History} to="/sales" title="Past sales and receipts">
            <span className="hidden sm:inline">Sales history</span>
          </Button>
          <IconButton
            variant="secondary"
            size="lg"
            icon={soundEnabled ? Volume2 : VolumeX}
            label={soundEnabled ? 'Mute scan sound' : 'Turn scan sound on'}
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled(s => !s)}
          />
        </div>
      </div>

      {!isSale && (
        <Alert tone="success" icon={ArrowDownToLine} className="mb-4">
          Receiving stock: items you add are counted into {branchName}'s stock. Nothing is charged.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem] gap-5 items-start">
        <ProductFinder
          searchInputRef={searchInputRef}
          fileInputRef={fileInputRef}
          search={search}
          setSearch={setSearch}
          onSubmit={handleSearchSubmit}
          looking={looking}
          cameraOpen={cameraOpen}
          setCameraOpen={setCameraOpen}
          cameraStatus={cameraStatus}
          cameras={cameras}
          selectedCamId={selectedCamId}
          setSelectedCamId={setSelectedCamId}
          onImage={handleImageUpload}
          categories={categories}
          category={category}
          setCategory={setCategory}
          productsLoading={productsLoading}
          products={products}
          filteredProducts={filteredProducts}
          maxTiles={MAX_TILES}
          toCartProduct={toCartProduct}
          cartQtyById={cartQtyById}
          isSale={isSale}
          unitPrice={unitPrice}
          onAdd={addTile}
        />

        <OrderPanel
          isSale={isSale}
          cart={cart}
          totalUnits={totalUnits}
          onClear={clearCart}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          lastAddedId={lastAddedId}
          unitPrice={unitPrice}
          updateQuantity={updateQuantity}
          removeItem={removeItem}
          priceTier={priceTier}
          setPriceTier={setPriceTier}
          stores={stores}
          storeId={storeId}
          setStoreId={setStoreId}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          isCashSale={isCashSale}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          grandTotal={grandTotal}
          cashShortSen={cashShortSen}
          changeDue={changeDue}
          showNote={showNote}
          setShowNote={setShowNote}
          saleNote={saleNote}
          setSaleNote={setSaleNote}
          onConfirm={handleConfirm}
          submitting={submitting}
          stockProblems={stockProblems}
        />
      </div>

      {/* Receipt */}
      {receipt && (() => {
        const isSaleReceipt = receipt.mode === 'stock_out' && receipt.sale;
        const close = () => { setReceipt(null); setTimeout(() => searchInputRef.current?.focus(), 0); };
        return (
          <ReceiptModal
            onClose={close}
            closeLabel={receipt.mode === 'stock_out' ? 'New sale' : 'Done'}
            closeVariant={receipt.mode === 'stock_out' ? 'primary' : 'success'}
            header={
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-success-soft ring-8 ring-success-soft/50 text-success-fg flex items-center justify-center mx-auto mb-3 animate-scale-in">
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold text-ink">{receipt.mode === 'stock_out' ? 'Payment complete' : 'Stock received'}</h2>
                {isSaleReceipt && receipt.sale.change_due > 0 && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm text-success-fg">
                    Give change <strong className="font-semibold tabular-nums">{rm(receipt.sale.change_due)}</strong>
                  </p>
                )}
              </div>
            }
          >
            {isSaleReceipt ? (
              <SaleReceipt sale={receipt.sale} />
            ) : (
              <div className="pos-receipt font-mono text-xs text-ink p-4 border border-dashed border-line-strong rounded-lg">
                <div className="text-center mb-3">
                  <div className="text-sm font-bold">{businessName || 'Stock received'}</div>
                  <div>{branchName}{receipt.storeName ? ` · ${receipt.storeName}` : ''}</div>
                  <div className="text-ink-muted mt-1">{new Date(receipt.timestamp).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  <div className="mt-1 font-bold">STOCK RECEIVED</div>
                </div>
                <div className="border-t border-dashed border-line-strong pt-2 space-y-1.5">
                  {receipt.items?.map((it, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{it.name}</span>
                        <span>+{it.quantity}</span>
                      </div>
                      <div className="text-ink-muted">Stock now {it.new_stock}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-line-strong mt-2 pt-2 space-y-0.5">
                  <div className="flex justify-between"><span>Units</span><span>{receipt.total_quantity}</span></div>
                  {receipt.note && <div className="text-ink-muted pt-1">Note: {receipt.note}</div>}
                </div>
              </div>
            )}
          </ReceiptModal>
        );
      })()}
    </Wrap>
  );
}

