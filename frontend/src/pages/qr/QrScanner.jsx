import React, { useEffect, useRef, useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera, QrCode, CheckCircle, AlertCircle, ShoppingCart, Plus, Minus, Trash2, RefreshCw, X,
  Building, ArrowUpRight, ArrowDownLeft, CreditCard, Banknote, Store, Search, Volume2, VolumeX,
  AlertTriangle, Printer, ArrowLeftRight, FileBarChart, Package, History, ShieldAlert, User,
  ImageUp, StickyNote, PackagePlus
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { SaleReceipt, ReceiptModal } from '../../components/pos/Receipt';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'qr', label: 'QR / e-Wallet', icon: QrCode },
  { value: 'online_banking', label: 'Card / Online', icon: CreditCard },
];
const PRICE_TIERS = [
  { value: 'customer', label: 'Customer' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'staff', label: 'Staff' },
];
const MAX_TILES = 60;

const rm = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;
const toSen = (n) => Math.round((parseFloat(n) || 0) * 100);

// Quick "customer handed me…" amounts: the next round notes above the total
function cashSuggestions(total) {
  const t = toSen(total);
  const out = [];
  for (const step of [500, 1000, 5000, 10000]) {
    const v = Math.ceil(t / step) * step;
    if (v > t && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 3).map(v => v / 100);
}

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
  if (user?.role === 'super_admin') return <SuperAdminOverview Wrap={Wrap} />;
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
    } catch (e) {}
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
      try { await html5QrCodeRef.current.stop(); } catch (e) {}
      try { html5QrCodeRef.current.clear(); } catch (e) {}
    }
    cameraActiveRef.current = false;
    html5QrCodeRef.current = null;
  };

  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices?.length) { setCameras(devices); setSelectedCamId(devices[devices.length - 1].id); }
    }).catch(() => {});
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start the camera once its viewport is on screen; restart when the chosen camera changes
  useEffect(() => {
    if (!cameraOpen) { stopCamera(); return; }
    let cancelled = false;
    (async () => {
      await stopCamera();
      if (cancelled) return;
      setCameraStatus('Starting camera…');
      try {
        html5QrCodeRef.current = new Html5Qrcode('pos-camera-viewport');
        await html5QrCodeRef.current.start(
          selectedCamId ? { deviceId: { exact: selectedCamId } } : { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 220, height: 220 } },
          (decodedText) => scanHandlerRef.current?.(decodedText),
          () => {}
        );
        cameraActiveRef.current = true;
        if (cancelled) { stopCamera(); return; }
        setCameraStatus('Point the camera at a product QR code');
      } catch (err) {
        if (!cancelled) setCameraStatus('Camera not available. Check the browser camera permission.');
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
    } catch (err) {
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

  const switchMode = (next) => {
    if (next === mode) return;
    if (cart.length > 0 && !window.confirm(`Switch to ${next === 'stock_out' ? 'selling' : 'receiving stock'}? The ${cart.length} item(s) in the list will be kept.`)) return;
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
          <h1 className="text-xl font-bold text-ink">Point of Sale</h1>
          <p className="text-sm text-ink-muted truncate">
            {businessName && <>{businessName} · </>}{branchName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-sunken border border-line rounded-xl" role="tablist" aria-label="Transaction type">
            <button
              type="button" role="tab" aria-selected={isSale}
              onClick={() => switchMode('stock_out')}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${isSale ? 'bg-accent text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
            >
              <ShoppingCart className="w-4 h-4" /> Sell
            </button>
            <button
              type="button" role="tab" aria-selected={!isSale}
              onClick={() => switchMode('stock_in')}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${!isSale ? 'bg-success text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
            >
              <PackagePlus className="w-4 h-4" /> Receive stock
            </button>
          </div>
          <Link
            to="/sales"
            className="h-11 px-3 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-secondary hover:bg-subtle"
            title="Past sales and receipts"
          >
            <History className="w-4 h-4" /> <span className="hidden sm:inline">Sales history</span>
          </Link>
          <button
            type="button"
            onClick={() => setSoundEnabled(s => !s)}
            className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-line bg-surface text-ink-muted hover:bg-subtle"
            title={soundEnabled ? 'Mute scan sound' : 'Turn scan sound on'}
            aria-label={soundEnabled ? 'Mute scan sound' : 'Turn scan sound on'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isSale && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-success-soft border border-success-line text-sm text-success-fg flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 flex-shrink-0" />
          Receiving stock: items you add are counted into {branchName}'s stock. Nothing is charged.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem] gap-5 items-start">
        {/* ── LEFT: find products ─────────────────────────────────────── */}
        <section className="bg-surface border border-line rounded-xl shadow-sm min-w-0">
          <div className="p-4 border-b border-line-soft space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Scan a barcode, or search by name or SKU…"
                  className="h-12 w-full rounded-xl border border-line bg-subtle pl-11 pr-10 text-base text-ink placeholder:text-ink-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label="Scan or search products"
                />
                {looking
                  ? <RefreshCw className="w-4 h-4 text-accent animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  : search && (
                    <button type="button" onClick={() => { setSearch(''); searchInputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-secondary" aria-label="Clear search">
                      <X className="w-4 h-4" />
                    </button>
                  )}
              </div>
              <button
                type="button"
                onClick={() => setCameraOpen(o => !o)}
                className={`h-12 px-3 sm:px-4 inline-flex items-center gap-2 rounded-xl border text-sm font-semibold transition-colors ${cameraOpen ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-secondary border-line hover:bg-subtle'}`}
                title="Scan with camera"
              >
                <Camera className="w-5 h-5" /><span className="hidden sm:inline">Camera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-12 px-3 inline-flex items-center rounded-xl border border-line bg-surface text-ink-secondary hover:bg-subtle"
                title="Scan a QR code from a photo"
                aria-label="Scan a QR code from a photo"
              >
                <ImageUp className="w-5 h-5" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files?.[0])} />
            </form>

            {cameraOpen && (
              <div className="rounded-xl overflow-hidden border border-line bg-ink">
                <div id="pos-camera-viewport" className="w-full min-h-[240px]" />
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-ink text-xs text-ink-subtle">
                  <span className="truncate">{cameraStatus}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {cameras.length > 1 && (
                      <select value={selectedCamId} onChange={e => setSelectedCamId(e.target.value)} className="h-7 max-w-[10rem] rounded-lg bg-ink-hover border border-ink-secondary text-ink-subtle text-xs px-1.5">
                        {cameras.map(c => <option key={c.id} value={c.id}>{c.label || 'Camera'}</option>)}
                      </select>
                    )}
                    <button type="button" onClick={() => setCameraOpen(false)} className="h-7 px-2.5 rounded-lg bg-ink-hover text-white font-semibold hover:bg-ink-secondary">Close</button>
                  </div>
                </div>
              </div>
            )}

            {categories.length > 2 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                {categories.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${category === c ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-secondary border-line hover:border-line-strong'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            {productsLoading ? (
              <div className="py-16 text-center text-sm text-ink-muted"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading products…</div>
            ) : products.length === 0 ? (
              <div className="py-16 text-center text-sm text-ink-muted">
                <Package className="w-8 h-8 text-ink-subtle mx-auto mb-2" />
                No products in this branch yet.
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-sm text-ink-muted">
                No products match “{search}”. Press <kbd className="px-1.5 py-0.5 rounded-lg border border-line-strong text-xs">Enter</kbd> to look the code up anyway.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.slice(0, MAX_TILES).map(p => {
                    const item = toCartProduct(p);
                    const inCart = cartQtyById[item.id] || 0;
                    const soldOut = isSale && item.in_stock - inCart <= 0;
                    const low = item.in_stock > 0 && item.in_stock <= (parseInt(p.minimum_quantity ?? p.min_quantity ?? 5, 10) || 0);
                    return (
                      <button
                        key={`${p.id}-${p.branch_id}`}
                        type="button"
                        onClick={() => addTile(p)}
                        disabled={soldOut}
                        className={`relative text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 min-h-[7.5rem] ${
                          inCart ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line bg-surface hover:border-accent-line hover:shadow-sm'
                        } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none`}
                      >
                        {inCart > 0 && (
                          <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow">{inCart}</span>
                        )}
                        <span className="text-sm font-semibold text-ink leading-snug line-clamp-2">{item.name}</span>
                        {(item.size || item.colour) && (
                          <span className="text-[11px] text-ink-muted truncate">{[item.size && `Size ${item.size}`, item.colour].filter(Boolean).join(' · ')}</span>
                        )}
                        <span className="mt-auto flex items-end justify-between gap-2">
                          <span className="text-base font-bold text-ink font-mono">{rm(unitPrice(item))}</span>
                          <span className={`text-[11px] font-semibold whitespace-nowrap ${item.in_stock <= 0 ? 'text-danger-fg' : low ? 'text-warning-fg' : 'text-ink-muted'}`}>
                            {item.in_stock <= 0 ? 'Out of stock' : `${item.in_stock} left`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {filteredProducts.length > MAX_TILES && (
                  <p className="text-xs text-ink-muted text-center mt-3">Showing {MAX_TILES} of {filteredProducts.length}. Type in the search box to narrow down.</p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── RIGHT: the order ──────────────────────────────────────── */}
        <section className="bg-surface border border-line rounded-xl shadow-sm flex flex-col lg:sticky lg:top-0 lg:max-h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
            <div>
              <h2 className="font-bold text-ink">{isSale ? 'Current sale' : 'Stock being received'}</h2>
              <p className="text-xs text-ink-muted">{cart.length === 0 ? 'No items yet' : `${cart.length} product${cart.length === 1 ? '' : 's'} · ${totalUnits} unit${totalUnits === 1 ? '' : 's'}`}</p>
            </div>
            {cart.length > 0 && (
              <button type="button" onClick={clearCart} className="text-xs font-semibold text-ink-muted hover:text-danger-fg">Clear all</button>
            )}
          </div>

          {errorMessage && (
            <div className="mx-4 mt-3 p-3 rounded-lg bg-danger-soft border border-danger-line text-danger-fg text-sm flex items-start justify-between gap-2" role="alert">
              <span className="flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[10rem]">
            {cart.length === 0 ? (
              <div className="h-full py-10 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-xl bg-sunken text-ink-subtle flex items-center justify-center mb-3">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-ink-secondary">Scan or tap a product to add it</p>
                <p className="text-xs text-ink-muted mt-1">A barcode scanner works anywhere on this page.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {cart.map(item => {
                  const price = unitPrice(item);
                  const over = isSale && item.quantity > item.in_stock;
                  return (
                    <li key={item.id} className={`py-3 px-2 -mx-2 rounded-lg transition-colors ${lastAddedId === item.id ? 'bg-accent-soft' : ''} ${over ? 'bg-danger-soft' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-ink leading-snug">{item.name}</div>
                          <div className="text-[11px] text-ink-muted mt-0.5">
                            {[item.size && `Size ${item.size}`, item.colour, item.model].filter(Boolean).join(' · ')}
                            {(item.size || item.colour || item.model) && ' · '}
                            <span className="font-mono">{item.sku}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink font-mono">{rm(price * item.quantity)}</div>
                          <div className="text-[11px] text-ink-muted font-mono">{rm(price)} each</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-line bg-surface">
                          <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-9 h-9 flex items-center justify-center text-ink-secondary hover:bg-subtle rounded-l-lg" aria-label={`One less ${item.name}`}>
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                            className="w-12 h-9 text-center font-mono font-semibold text-sm text-ink border-x border-line focus:outline-none"
                            aria-label={`Quantity of ${item.name}`}
                          />
                          <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-9 h-9 flex items-center justify-center text-ink-secondary hover:bg-subtle rounded-r-lg" aria-label={`One more ${item.name}`}>
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button type="button" onClick={() => removeItem(item.id)} className="p-2 text-ink-muted hover:text-danger-fg" aria-label={`Remove ${item.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {over && (
                        <p className="mt-1.5 text-xs font-medium text-danger-fg flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Only {item.in_stock} in stock
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Options + total + pay */}
          <div className="border-t border-line-soft px-4 py-4 space-y-3 bg-subtle/70 rounded-b-xl">
            {isSale && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-muted">Price list</span>
                  <div className="inline-flex p-0.5 bg-line/70 rounded-lg">
                    {PRICE_TIERS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setPriceTier(t.value)}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${priceTier === t.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {stores.length > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-ink-muted flex items-center gap-1"><Store className="w-3.5 h-3.5 text-warning-fg" /> Selling at</span>
                    <select value={storeId} onChange={e => setStoreId(e.target.value)} className="h-8 max-w-[14rem] rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent">
                      <option value="">Main shop floor</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.status === 'upcoming' ? ' (upcoming)' : ''}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <span className="text-xs font-semibold text-ink-muted block mb-1.5">Payment</span>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map(pm => {
                      const active = paymentMethod === pm.value;
                      return (
                        <button
                          key={pm.value}
                          type="button"
                          onClick={() => setPaymentMethod(pm.value)}
                          aria-pressed={active}
                          className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${active ? 'border-accent bg-accent-soft text-accent-fg ring-1 ring-accent' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'}`}
                        >
                          <pm.icon className="w-5 h-5" />
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isCashSale && cart.length > 0 && (
                  <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="pos-cash" className="text-xs font-semibold text-ink-muted">Cash received</label>
                      <div className="relative w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted text-xs font-semibold pointer-events-none">RM</span>
                        <input
                          id="pos-cash"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={cashReceived}
                          onChange={e => setCashReceived(e.target.value)}
                          placeholder={grandTotal.toFixed(2)}
                          className={`h-9 w-full rounded-lg border bg-surface pl-9 pr-2 text-right text-sm font-mono font-semibold text-ink focus:outline-none focus:ring-2 ${cashShortSen > 0 ? 'border-danger-line focus:ring-danger' : 'border-line focus:ring-accent'}`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCashReceived('')}
                        className={`h-8 px-2.5 rounded-lg border text-xs font-semibold ${cashReceived === '' ? 'border-accent bg-accent-soft text-accent-fg' : 'border-line text-ink-secondary hover:bg-subtle'}`}
                      >
                        Exact
                      </button>
                      {cashSuggestions(grandTotal).map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCashReceived(v.toFixed(2))}
                          className={`h-8 px-2.5 rounded-lg border text-xs font-semibold font-mono ${toSen(cashReceived) === toSen(v) && cashReceived !== '' ? 'border-accent bg-accent-soft text-accent-fg' : 'border-line text-ink-secondary hover:bg-subtle'}`}
                        >
                          RM {v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}
                        </button>
                      ))}
                    </div>
                    {cashShortSen > 0 ? (
                      <div className="flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2 text-danger-fg">
                        <span className="text-xs font-semibold">Still to pay</span>
                        <span className="font-mono font-bold">{rm(cashShortSen / 100)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg bg-success-soft px-3 py-2 text-success-fg">
                        <span className="text-xs font-semibold">Change to give</span>
                        <span className="font-mono text-lg font-extrabold">{rm(changeDue)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {showNote ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={saleNote}
                  onChange={e => setSaleNote(e.target.value)}
                  placeholder={isSale ? 'Note, e.g. customer name or order no.' : 'Note, e.g. supplier delivery no.'}
                  className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button type="button" onClick={() => { setShowNote(false); setSaleNote(''); }} className="p-1.5 text-ink-muted hover:text-ink-secondary" aria-label="Remove note"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowNote(true)} className="text-xs font-semibold text-accent hover:text-accent-fg inline-flex items-center gap-1">
                <StickyNote className="w-3.5 h-3.5" /> Add a note
              </button>
            )}

            <div className="flex items-end justify-between pt-1">
              <span className="text-sm font-semibold text-ink-secondary">{isSale ? 'Total' : 'Stock value (cost)'}</span>
              <span className={`text-3xl font-extrabold font-mono tracking-tight ${isSale ? 'text-ink' : 'text-success-fg'}`}>{rm(grandTotal)}</span>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={cart.length === 0 || submitting || stockProblems.length > 0 || cashShortSen > 0}
              className={`w-full h-14 rounded-xl text-white text-base font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isSale ? 'bg-accent hover:bg-accent-hover' : 'bg-success hover:bg-success-hover'}`}
            >
              {submitting ? <><RefreshCw className="w-5 h-5 animate-spin" /> Processing…</>
                : isSale ? <><CheckCircle className="w-5 h-5" /> Charge {rm(grandTotal)}</>
                : <><ArrowDownLeft className="w-5 h-5" /> Receive {totalUnits} unit{totalUnits === 1 ? '' : 's'}</>}
            </button>
            {stockProblems.length > 0 && (
              <p className="text-xs text-danger-fg text-center">Fix the items marked in red to continue.</p>
            )}
          </div>
        </section>
      </div>

      {/* Receipt */}
      {receipt && (() => {
        const isSaleReceipt = receipt.mode === 'stock_out' && receipt.sale;
        const close = () => { setReceipt(null); setTimeout(() => searchInputRef.current?.focus(), 0); };
        return (
          <ReceiptModal
            onClose={close}
            closeLabel={receipt.mode === 'stock_out' ? 'New sale' : 'Done'}
            closeClassName={receipt.mode === 'stock_out' ? 'bg-accent hover:bg-accent-hover' : 'bg-success hover:bg-success-hover'}
            header={
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-success-muted text-success-fg flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-ink">{receipt.mode === 'stock_out' ? 'Payment complete' : 'Stock received'}</h3>
                {isSaleReceipt && receipt.sale.change_due > 0 && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-success-soft border border-success-line px-3 py-1 text-sm text-success-fg">
                    Give change <strong className="font-mono">{rm(receipt.sale.change_due)}</strong>
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

// ═══════════════════════════════════════════════════════════════════════════
// SUPER ADMIN OVERSIGHT VIEW (view-only; POS is operated by branch admins)
// ═══════════════════════════════════════════════════════════════════════════
function SuperAdminOverview({ Wrap }) {
  const [adminBranches, setAdminBranches] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [summaryStats, setSummaryStats] = useState({ total_transactions: 0, stock_in_qty: 0, stock_out_qty: 0 });
  const [filterBranchId, setFilterBranchId] = useState('all');
  const [filterMovementType, setFilterMovementType] = useState('all');

  const fetchSuperAdminData = async () => {
    try {
      setLoadingMovements(true);
      const [branchRes, reportRes, summaryRes] = await Promise.all([
        api.get('/branches'),
        api.get('/reports/movement', {
          params: {
            branch_id: filterBranchId !== 'all' ? filterBranchId : undefined,
            movement_type: filterMovementType !== 'all' ? filterMovementType : undefined
          }
        }),
        api.get('/reports/summary')
      ]);
      if (branchRes.data.success) setAdminBranches(branchRes.data.branches || branchRes.data.data || []);
      if (reportRes.data.success) setRecentMovements(reportRes.data.movements || []);
      if (summaryRes.data.success && summaryRes.data.data) setSummaryStats(summaryRes.data.data);
    } catch (err) {
      console.error('Super admin stream error:', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    fetchSuperAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterMovementType]);

  return (
    <Wrap>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-ink">Branch POS &amp; Transaction Flow</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-ink text-white">
              <ShieldAlert className="w-3.5 h-3.5 text-warning" />
              SUPER ADMIN OVERSIGHT
            </span>
          </div>
          <p className="text-sm text-ink-muted">
            Centralized monitoring of branch point-of-sale transactions and real-time inventory movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSuperAdminData}
            disabled={loadingMovements}
            className="inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMovements ? 'animate-spin text-accent' : 'text-ink-muted'}`} />
            <span>Refresh Stream</span>
          </button>
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-sm"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Full Movement Reports</span>
          </Link>
        </div>
      </div>

      {/* Role Notice Callout */}
      <div className="mb-6 p-4 rounded-xl bg-warning-soft border border-warning-line text-warning-fg flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-warning-fg flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="font-semibold block mb-0.5">Floor POS Scanning is Assigned to Branch Admins</strong>
          <span>
            Interactive POS floor scanning (camera barcode lookup, sales register checkout, and stock intake) is operated on-site by Branch Admins. As Super Admin, your view is dedicated to monitoring real-time inventory flows and branch transaction feeds across all outlets.
          </span>
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Total Transactions</span>
            <span className="p-2 rounded-lg bg-accent-soft text-accent"><ArrowLeftRight className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-ink">{summaryStats.total_transactions}</span>
            <span className="text-xs text-ink-muted block mt-0.5">Recorded across all branches</span>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Stock Out</span>
            <span className="p-2 rounded-lg bg-danger-soft text-danger-fg"><ArrowUpRight className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-danger-fg">{summaryStats.stock_out_qty}</span>
            <span className="text-xs text-ink-muted block mt-0.5">Units sold or stocked out</span>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Stock In (Intakes)</span>
            <span className="p-2 rounded-lg bg-success-soft text-success-fg"><ArrowDownLeft className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-success-fg">{summaryStats.stock_in_qty}</span>
            <span className="text-xs text-ink-muted block mt-0.5">Units received into inventory</span>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Active Branches</span>
            <span className="p-2 rounded-lg bg-info-soft text-info-fg"><Building className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-ink">{adminBranches.length}</span>
            <span className="text-xs text-ink-muted block mt-0.5">Configured branch outlets</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Link
          to="/reports"
          className="p-4 rounded-xl bg-surface border border-line hover:border-accent hover:shadow-sm transition-all flex items-start gap-3 group"
        >
          <div className="p-2.5 rounded-lg bg-accent-soft text-accent group-hover:bg-accent group-hover:text-white transition-colors">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink group-hover:text-accent transition-colors">Stock Movements</h4>
            <p className="text-xs text-ink-muted mt-0.5">View full audit logs of POS sales and transfers</p>
          </div>
        </Link>

        <Link
          to="/products"
          className="p-4 rounded-xl bg-surface border border-line hover:border-accent hover:shadow-sm transition-all flex items-start gap-3 group"
        >
          <div className="p-2.5 rounded-lg bg-info-soft text-info-fg group-hover:bg-info group-hover:text-white transition-colors">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink group-hover:text-info-fg transition-colors">Branch Inventory</h4>
            <p className="text-xs text-ink-muted mt-0.5">Inspect stock balances across all locations</p>
          </div>
        </Link>

        <Link
          to="/businesses"
          className="p-4 rounded-xl bg-surface border border-line hover:border-accent hover:shadow-sm transition-all flex items-start gap-3 group"
        >
          <div className="p-2.5 rounded-lg bg-violet-soft text-violet-fg group-hover:bg-violet group-hover:text-white transition-colors">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink group-hover:text-violet-fg transition-colors">Businesses &amp; Branches</h4>
            <p className="text-xs text-ink-muted mt-0.5">Manage branches, pop-up stores, and outlets</p>
          </div>
        </Link>

        <Link
          to="/audit"
          className="p-4 rounded-xl bg-surface border border-line hover:border-accent hover:shadow-sm transition-all flex items-start gap-3 group"
        >
          <div className="p-2.5 rounded-lg bg-success-soft text-success-fg group-hover:bg-success group-hover:text-white transition-colors">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink group-hover:text-success-fg transition-colors">Audit Trail</h4>
            <p className="text-xs text-ink-muted mt-0.5">Trace operational actions and user logins</p>
          </div>
        </Link>
      </div>

      {/* Real-Time Branch Transaction Feed */}
      <div className="bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-line-soft flex flex-col md:flex-row md:items-center justify-between gap-3 bg-subtle/50">
          <div>
            <h3 className="font-bold text-ink text-sm">Live Branch Transaction Feed</h3>
            <p className="text-xs text-ink-muted mt-0.5">Showing recent POS checkouts and stock intakes</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterBranchId}
              onChange={e => setFilterBranchId(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Branches</option>
              {adminBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Business'})</option>
              ))}
            </select>

            <select
              value={filterMovementType}
              onChange={e => setFilterMovementType(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Types</option>
              <option value="out">Sales &amp; Stock Out</option>
              <option value="in">Intakes &amp; Restocks (In)</option>
              <option value="adjust">Stock Adjustments</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-subtle border-b border-line">
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Timestamp</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Branch &amp; Business</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Product &amp; SKU</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Type</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted text-right">Quantity</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted text-right">Selling Price</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-xs">
              {loadingMovements ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                    <span>Loading real-time stream...</span>
                  </td>
                </tr>
              ) : recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <ArrowLeftRight className="w-8 h-8 text-ink-subtle mx-auto mb-2" />
                    <span>No transactions recorded for the selected filter.</span>
                  </td>
                </tr>
              ) : (
                recentMovements.map(m => {
                  const isOut = m.movement_type === 'out';
                  const isIn = m.movement_type === 'in';
                  const dateObj = new Date(m.created_at);

                  return (
                    <tr key={m.id} className="hover:bg-subtle/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-ink-secondary whitespace-nowrap">
                        {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-ink block">{m.branch_name}</span>
                        <span className="text-[11px] text-ink-muted">{m.business_name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-ink block">{m.item_name}</span>
                        <span className="font-mono text-[11px] text-accent font-semibold">{m.item_code}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isOut && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-danger-soft text-danger-fg">
                            <ArrowUpRight className="w-3 h-3" /> Sale / Out
                          </span>
                        )}
                        {isIn && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success-soft text-success-fg">
                            <ArrowDownLeft className="w-3 h-3" /> Stock In
                          </span>
                        )}
                        {!isOut && !isIn && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-soft text-violet-fg">
                            {m.movement_type?.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                        {isOut ? `-${m.quantity}` : `+${m.quantity}`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                        {m.selling_price ? `RM ${parseFloat(m.selling_price).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-ink-secondary">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-ink-muted" />
                          <span>{m.performed_by_name || 'Admin'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Wrap>
  );
}
