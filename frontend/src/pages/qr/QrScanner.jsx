import React, { useEffect, useRef, useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera, QrCode, UploadCloud, CheckCircle, AlertCircle,
  ShoppingCart, Plus, Minus, Trash2, RefreshCw, X, Tag,
  Building, ArrowUpRight, ArrowDownLeft, DollarSign, CreditCard,
  Wallet, Banknote, Store, RotateCcw, Receipt, Check, Search,
  Volume2, VolumeX, AlertTriangle, Printer, ArrowLeftRight,
  FileBarChart, Package, History, ShieldAlert, User
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QrScanner({ embedded = false }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const Wrap = embedded ? React.Fragment : Layout;

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN OVERSIGHT DATA STATES
  // ═══════════════════════════════════════════════════════════════════════════
  const [adminBranches, setAdminBranches] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    total_transactions: 0,
    stock_in_qty: 0,
    stock_out_qty: 0
  });
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

      if (branchRes.data.success) {
        setAdminBranches(branchRes.data.branches || branchRes.data.data || []);
      }
      if (reportRes.data.success) {
        setRecentMovements(reportRes.data.movements || []);
      }
      if (summaryRes.data.success && summaryRes.data.data) {
        setSummaryStats(summaryRes.data.data);
      }
    } catch (err) {
      console.error('Super admin stream error:', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSuperAdminData();
    }
  }, [isSuperAdmin, filterBranchId, filterMovementType]);

  // Branch context
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id ? String(user.branch_id) : '');
  const [activeBranch, setActiveBranch] = useState(null);

  // Available stores for this branch
  const [stores, setStores] = useState([]);
  const [branchProducts, setBranchProducts] = useState([]);

  // POS Mode & Settings
  const [mode, setMode] = useState('stock_out'); // 'stock_out' (Sale) or 'stock_in' (Restock)
  const [priceTier, setPriceTier] = useState('customer'); // 'customer', 'dealer', 'staff'
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'qr', 'online_banking'
  const [storeId, setStoreId] = useState('');
  const [saleNote, setSaleNote] = useState('');

  // POS Cart: array of { id, sku, name, category, in_stock, price_customer, price_dealer, price_staff, cost_price, quantity }
  const [cart, setCart] = useState([]);

  // Scanner UI States
  const [activeTab, setActiveTab] = useState('camera'); // 'camera', 'upload', 'manual'
  const [manualInput, setManualInput] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Camera States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamId, setSelectedCamId] = useState('');
  const [statusBadge, setStatusBadge] = useState({ text: 'Ready', color: 'bg-violet-50 text-violet-700' });

  // Upload States
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadState, setUploadState] = useState('');

  // Transaction submission states
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);

  const html5QrCodeRef = useRef(null);
  const scanCooldownRef = useRef(false);

  // Automatic branch resolution: Branch Admins seamlessly inherit their account branch
  const effectiveBranchId = useMemo(() => {
    if (!isSuperAdmin) return user?.branch_id ? String(user.branch_id) : '';
    return selectedBranchId;
  }, [isSuperAdmin, user?.branch_id, selectedBranchId]);

  const branchName = user?.branch_name || activeBranch?.name || 'Assigned Branch';
  const businessName = user?.business_name || activeBranch?.business_name || '';
  const branchCode = user?.branch_code || activeBranch?.branch_code || (user?.branch_id ? `BR-${user.branch_id}` : 'BR-MAIN');

  // Sound Chime Feedback
  const playBeep = (freq = 880, duration = 0.18) => {
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

  // Fetch branches list for Super Admin & active branch info
  useEffect(() => {
    api.get('/branches').then(res => {
      if (res.data.success) {
        const bList = res.data.branches || res.data.data || [];
        setBranches(bList);
        if (isSuperAdmin && !selectedBranchId && bList.length > 0) {
          setSelectedBranchId(String(bList[0].id));
        }
      }
    }).catch(() => {});
  }, [isSuperAdmin]);

  // Resolve current active branch
  useEffect(() => {
    const targetBranchId = user?.branch_id ? String(user.branch_id) : effectiveBranchId;
    if (targetBranchId && branches.length > 0) {
      const found = branches.find(b => String(b.id) === String(targetBranchId));
      setActiveBranch(found || null);
    }
  }, [user?.branch_id, effectiveBranchId, branches]);

  // Fetch stores & products when branch changes
  useEffect(() => {
    const targetBranchId = user?.branch_id ? String(user.branch_id) : effectiveBranchId;
    if (targetBranchId) {
      api.get(`/branches/${targetBranchId}/stores`).then(res => {
        if (res.data.success) {
          const sList = (res.data.stores || res.data.data || []).filter(s => s.status === 'active' || s.status === 'upcoming');
          setStores(sList);
        }
      }).catch(() => {
        setStores([]);
      });

      api.get('/products', { params: { branch_id: targetBranchId } }).then(res => {
        if (res.data.success) {
          setBranchProducts(res.data.items || []);
        }
      }).catch(() => {
        setBranchProducts([]);
      });
    } else {
      setStores([]);
      setBranchProducts([]);
    }
  }, [user?.branch_id, effectiveBranchId]);

  // Enumerate camera devices
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        setSelectedCamId(devices[0].id);
      }
    }).catch(() => {});

    return () => {
      stopCamera();
    };
  }, []);

  // Camera start / stop
  const startCamera = async () => {
    try {
      setStatusBadge({ text: 'Starting Camera...', color: 'bg-amber-50 text-amber-700' });
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("camera-reader-viewport");
      }

      const camConfig = selectedCamId ? { deviceId: { exact: selectedCamId } } : { facingMode: "environment" };

      await html5QrCodeRef.current.start(
        camConfig,
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScannedCode(decodedText);
        },
        () => {}
      );

      setIsCameraActive(true);
      setStatusBadge({ text: 'Scanning Active', color: 'bg-emerald-50 text-emerald-700' });
    } catch (err) {
      console.error('Camera start error:', err);
      setStatusBadge({ text: 'Camera Unavailable', color: 'bg-rose-50 text-rose-700' });
      alert('Could not access camera. Please check camera permissions or use Upload QR Image.');
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActive) {
      try {
        await html5QrCodeRef.current.stop();
        setIsCameraActive(false);
        setStatusBadge({ text: 'Camera Paused', color: 'bg-violet-50 text-violet-700' });
      } catch (err) {}
    }
  };

  // Add Product to POS Cart
  const addProductToCart = (product) => {
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.id === product.id);
      if (existingIdx >= 0) {
        // Increment existing
        const updated = [...prevCart];
        const curItem = updated[existingIdx];
        const newQty = curItem.quantity + 1;

        // In stock_out mode, warn if exceeds in_stock
        if (mode === 'stock_out' && newQty > curItem.in_stock) {
          setErrorMessage(`Warning: Selected quantity (${newQty}) exceeds in-stock quantity (${curItem.in_stock}) for '${curItem.name}'.`);
        } else {
          setErrorMessage(null);
        }

        updated[existingIdx] = { ...curItem, quantity: newQty };
        return updated;
      } else {
        // Add new
        if (mode === 'stock_out' && product.in_stock <= 0) {
          setErrorMessage(`Notice: '${product.name}' is currently out of stock (0 units). Stock out will fail unless restocked.`);
        } else {
          setErrorMessage(null);
        }
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  // Handle scanned code (from Camera or Upload)
  const handleScannedCode = async (rawCode) => {
    if (scanCooldownRef.current) return;
    scanCooldownRef.current = true;
    setTimeout(() => { scanCooldownRef.current = false; }, 1200);

    playBeep(880, 0.15);
    setErrorMessage(null);

    try {
      const targetBranchId = user?.branch_id ? String(user.branch_id) : effectiveBranchId;
      const res = await api.get('/qr/lookup', {
        params: {
          code: rawCode,
          branch_id: targetBranchId || undefined
        }
      });

      if (res.data.success && res.data.product) {
        addProductToCart(res.data.product);
      } else {
        setErrorMessage(`Product not found for scanned code: '${rawCode}'.`);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || `Failed to lookup scanned code: '${rawCode}'`);
    }
  };

  // Hardware QR scanners usually act like keyboards and finish with Enter or Tab.
  // Capture scans even when the manual input is not focused, without interfering
  // with normal typing in form controls.
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyAt = 0;

    const handleHardwareKey = event => {
      const target = event.target;
      const isFormControl = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      );
      if (isFormControl) return;

      const now = Date.now();
      if (now - lastKeyAt > 100) scanBuffer = '';
      lastKeyAt = now;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (scanBuffer.length >= 3) {
          event.preventDefault();
          const code = scanBuffer;
          scanBuffer = '';
          handleScannedCode(code);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        scanBuffer += event.key;
      }
    };

    document.addEventListener('keydown', handleHardwareKey, true);
    return () => document.removeEventListener('keydown', handleHardwareKey, true);
  }, [handleScannedCode]);

  // Manual SKU Search Submit
  const handleManualSearch = async (e) => {
    if (e) e.preventDefault();
    if (!manualInput.trim()) return;

    try {
      setManualSearching(true);
      setErrorMessage(null);
      const targetBranchId = user?.branch_id ? String(user.branch_id) : effectiveBranchId;
      const res = await api.get('/qr/lookup', {
        params: {
          code: manualInput.trim(),
          branch_id: targetBranchId || undefined
        }
      });

      if (res.data.success && res.data.product) {
        playBeep(750, 0.12);
        addProductToCart(res.data.product);
        setManualInput('');
      } else {
        setErrorMessage(`Product not found for SKU: '${manualInput}'.`);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || `Failed to find product for SKU: '${manualInput}'`);
    } finally {
      setManualSearching(false);
    }
  };

  // File Upload Decoder
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadFile(file);
    setUploadState('Analyzing image...');
    setStatusBadge({ text: 'Decoding File...', color: 'bg-amber-50 text-amber-700' });

    try {
      const html5QrCode = new Html5Qrcode("file-scanner-sandbox");
      const decodedText = await html5QrCode.scanFile(file, false);
      setUploadState('Decoded Successfully!');
      setStatusBadge({ text: 'QR Decoded', color: 'bg-emerald-50 text-emerald-700' });
      handleScannedCode(decodedText);
    } catch (err) {
      setUploadState('No valid QR matrix found in this image.');
      setStatusBadge({ text: 'No QR Found', color: 'bg-rose-50 text-rose-700' });
    }
  };

  // Quantity Adjusters
  const updateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      removeItem(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMessage(null);
    setSaleNote('');
  };

  // Pricing Helpers
  const getItemUnitPrice = (item, tier = priceTier) => {
    if (mode === 'stock_in') return item.cost_price || 0;
    if (tier === 'dealer') return item.price_dealer || item.price_customer || 0;
    if (tier === 'staff') return item.price_staff || item.price_customer || 0;
    return item.price_customer || 0;
  };

  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = getItemUnitPrice(item);
      return sum + (unitPrice * item.quantity);
    }, 0);
  }, [cart, priceTier, mode]);

  const totalQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Check if any cart item has insufficient stock in stock_out mode
  const stockErrors = useMemo(() => {
    if (mode !== 'stock_out') return [];
    return cart.filter(item => item.quantity > item.in_stock);
  }, [cart, mode]);

  // Submit POS Transaction
  const handleConfirmTransaction = async () => {
    if (cart.length === 0) {
      setErrorMessage('The transaction cart is empty. Scan products to proceed.');
      return;
    }

    const targetBranchId = user?.branch_id ? parseInt(user.branch_id, 10) : (effectiveBranchId ? parseInt(effectiveBranchId, 10) : null);
    if (!targetBranchId) {
      setErrorMessage('Your account is not assigned to any branch. Please contact system administrator.');
      return;
    }

    if (mode === 'stock_out' && stockErrors.length > 0) {
      const names = stockErrors.map(e => `'${e.name}' (Qty: ${e.quantity}, Available: ${e.in_stock})`).join(', ');
      setErrorMessage(`Cannot complete sale: Insufficient stock for ${names}. Adjust quantities or restock.`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        mode,
        price_tier: priceTier,
        payment_method: paymentMethod,
        branch_id: targetBranchId,
        store_id: storeId ? parseInt(storeId, 10) : null,
        note: saleNote.trim() || (mode === 'stock_out' ? 'Counter POS Sale' : 'Inventory Restock Intake'),
        items: cart.map(item => ({
          product_id: item.id,
          sku: item.sku,
          quantity: item.quantity,
          price_tier: priceTier,
          selling_price: getItemUnitPrice(item)
        }))
      };

      const res = await api.post('/qr/pos-transaction', payload);

      if (res.data.success) {
        playBeep(1200, 0.25);
        setSuccessReceipt(res.data);
        setCart([]);
        setSaleNote('');
      } else {
        setErrorMessage(res.data.message || 'Transaction could not be completed.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER A: SUPER ADMIN OVERSIGHT VIEW (VIEW-ONLY, NO SCANNER)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isSuperAdmin) {
    return (
      <Wrap>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900">Branch POS &amp; Transaction Flow</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-white">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                SUPER ADMIN OVERSIGHT
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Centralized monitoring of branch point-of-sale transactions and real-time inventory movements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSuperAdminData}
              disabled={loadingMovements}
              className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingMovements ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
              <span>Refresh Stream</span>
            </button>
            <Link
              to="/reports"
              className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Full Movement Reports</span>
            </Link>
          </div>
        </div>

        {/* Role Notice Callout */}
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="font-semibold block mb-0.5">Floor POS Scanning is Assigned to Branch Admins</strong>
            <span>
              Interactive POS floor scanning (camera barcode lookup, sales register checkout, and stock intake) is operated on-site by Branch Admins. As Super Admin, your view is dedicated to monitoring real-time inventory flows and branch transaction feeds across all outlets.
            </span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Transactions</span>
              <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><ArrowLeftRight className="w-4 h-4" /></span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{summaryStats.total_transactions}</span>
              <span className="text-xs text-slate-500 block mt-0.5">Recorded across all branches</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock Out</span>
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600"><ArrowUpRight className="w-4 h-4" /></span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-rose-600">{summaryStats.stock_out_qty}</span>
              <span className="text-xs text-slate-500 block mt-0.5">Units sold or stocked out</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock In (Intakes)</span>
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><ArrowDownLeft className="w-4 h-4" /></span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-emerald-600">{summaryStats.stock_in_qty}</span>
              <span className="text-xs text-slate-500 block mt-0.5">Units received into inventory</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Branches</span>
              <span className="p-2 rounded-lg bg-blue-50 text-blue-600"><Building className="w-4 h-4" /></span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{adminBranches.length}</span>
              <span className="text-xs text-slate-500 block mt-0.5">Configured branch outlets</span>
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Link
            to="/reports"
            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Stock Movements</h4>
              <p className="text-xs text-slate-500 mt-0.5">View full audit logs of POS sales and transfers</p>
            </div>
          </Link>

          <Link
            to="/products"
            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Branch Inventory</h4>
              <p className="text-xs text-slate-500 mt-0.5">Inspect stock balances across all locations</p>
            </div>
          </Link>

          <Link
            to="/businesses"
            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-violet-600 transition-colors">Businesses &amp; Branches</h4>
              <p className="text-xs text-slate-500 mt-0.5">Manage branches, pop-up stores, and outlets</p>
            </div>
          </Link>

          <Link
            to="/audit"
            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Audit Trail</h4>
              <p className="text-xs text-slate-500 mt-0.5">Trace operational actions and user logins</p>
            </div>
          </Link>
        </div>

        {/* Real-Time Branch Transaction Feed */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Live Branch Transaction Feed</h3>
              <p className="text-xs text-slate-500 mt-0.5">Showing recent POS checkouts and stock intakes</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterBranchId}
                onChange={e => setFilterBranchId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Branches</option>
                {adminBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Business'})</option>
                ))}
              </select>

              <select
                value={filterMovementType}
                onChange={e => setFilterMovementType(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Timestamp</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Branch &amp; Business</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Product &amp; SKU</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Type</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">Quantity</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingMovements ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Loading real-time stream...</span>
                    </td>
                  </tr>
                ) : recentMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <ArrowLeftRight className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <span>No transactions recorded for the selected filter.</span>
                    </td>
                  </tr>
                ) : (
                  recentMovements.map(m => {
                    const isOut = m.movement_type === 'out';
                    const isIn = m.movement_type === 'in';
                    const dateObj = new Date(m.created_at);

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{m.branch_name}</span>
                          <span className="text-[11px] text-slate-500">{m.business_name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{m.item_name}</span>
                          <span className="font-mono text-[11px] text-indigo-600 font-semibold">{m.item_code}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isOut && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
                              <ArrowUpRight className="w-3 h-3" /> Sale / Out
                            </span>
                          )}
                          {isIn && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                              <ArrowDownLeft className="w-3 h-3" /> Stock In
                            </span>
                          )}
                          {!isOut && !isIn && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700">
                              {m.movement_type?.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {isOut ? `-${m.quantity}` : `+${m.quantity}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {m.selling_price ? `RM ${parseFloat(m.selling_price).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER B: BRANCH ADMIN INTERACTIVE POS TERMINAL
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <Wrap>
      {/* Header & Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900">Branch POS & QR Scanner</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              LIVE TERMINAL
            </span>
          </div>
          <p className="text-sm text-slate-500">Optical camera scanning & POS counter transactions for floor stock out and stock intake</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold rounded-lg border transition-colors ${
              soundEnabled ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}
            title={soundEnabled ? 'Mute scan chimes' : 'Unmute scan chimes'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Chime On' : 'Chime Muted'}</span>
          </button>

          <Link
            to="/qr/generate"
            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <QrCode className="w-4 h-4 text-slate-400" />
            <span>Generate Labels</span>
          </Link>
        </div>
      </div>

      {/* Role & Branch Banner */}
      <div className="mb-6 p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Branch Terminal</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-base font-bold text-slate-900">
              {branchName}
              {businessName && (
                <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {businessName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase">Branch Code</span>
          <span className="font-mono font-bold text-slate-800 text-sm">{branchCode}</span>
        </div>
      </div>

      {/* Error / Alert notification */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Pre-Scan Mode & Settings Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Mode Selector */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Transaction Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => { setMode('stock_out'); setErrorMessage(null); }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'stock_out'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Stock Out (POS Sale)</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('stock_in'); setErrorMessage(null); }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'stock_in'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Stock In (Restock)</span>
              </button>
            </div>
          </div>

          {/* Pricing Tier Selector (Visible during Stock Out) */}
          {mode === 'stock_out' ? (
            <div className="md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Applied Price Tier</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPriceTier('customer')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                    priceTier === 'customer'
                      ? 'bg-white text-indigo-700 shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setPriceTier('dealer')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                    priceTier === 'dealer'
                      ? 'bg-white text-indigo-700 shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dealer
                </button>
                <button
                  type="button"
                  onClick={() => setPriceTier('staff')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                    priceTier === 'staff'
                      ? 'bg-white text-indigo-700 shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Staff
                </button>
              </div>
            </div>
          ) : (
            <div className="md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Restock Mode Notice</label>
              <div className="h-[42px] px-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Intake will increase in-stock balance without billing customer prices.</span>
              </div>
            </div>
          )}

          {/* Payment Method / Store Location */}
          <div className="md:col-span-3">
            {mode === 'stock_out' ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cash">Cash Payment</option>
                  <option value="qr">QR Pay / E-Wallet</option>
                  <option value="online_banking">Card / Online Banking</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Destination Floor</label>
                <div className="h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-xs font-semibold text-slate-700">
                  Main Warehouse / {branchName}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Optional Pop-up Store selector if active stores exist */}
        {stores.length > 0 && mode === 'stock_out' && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <Store className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-medium text-slate-600">Tag Sale to Pop-up Store Event:</span>
            <select
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Branch Floor (Main / Walk-in)</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>
            {!storeId && effectiveBranchId && (
              <Link
                to={`/branches/${effectiveBranchId}/floor-report`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Branch Floor Report
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Main Terminal Grid: Scanner (Left) & POS Cart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Scanner Panel */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-slate-900 text-sm">Optical Scanner</h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.color}`}>
                {statusBadge.text}
              </span>
            </div>

            <div className="p-5">
              {/* Tab Switcher: Camera, Upload, Manual */}
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('camera');
                    setStatusBadge({ text: 'Ready', color: 'bg-violet-50 text-violet-700' });
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'camera' ? 'bg-white rounded-lg shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" /> Live
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('upload');
                    stopCamera();
                    setStatusBadge({ text: 'Upload Image', color: 'bg-violet-50 text-violet-700' });
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'upload' ? 'bg-white rounded-lg shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('manual');
                    stopCamera();
                    setStatusBadge({ text: 'Manual SKU', color: 'bg-violet-50 text-violet-700' });
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'manual' ? 'bg-white rounded-lg shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" /> Manual
                </button>
              </div>

              {/* Tab 1: Live Camera */}
              {activeTab === 'camera' && (
                <div>
                  {cameras.length > 1 && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Select Camera</label>
                      <select
                        value={selectedCamId}
                        onChange={e => setSelectedCamId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {cameras.map(c => <option key={c.id} value={c.id}>{c.label || c.id}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="relative min-h-[260px] bg-slate-950 rounded-xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center">
                    <div id="camera-reader-viewport" className="w-full h-full rounded-xl overflow-hidden" />

                    {!isCameraActive && (
                      <div className="text-center p-6 text-white">
                        <Camera className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <h4 className="text-sm font-bold text-slate-200 mb-1">Camera Stream Standby</h4>
                        <p className="text-xs text-slate-400 max-w-xs">Click activate camera below to start optical scanning of barcodes and QR labels.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 justify-center">
                    {!isCameraActive ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-2 h-10 px-5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Camera className="w-4 h-4" /> Activate Live Camera
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-2 h-10 px-5 bg-white text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        Pause Camera
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: File Upload */}
              {activeTab === 'upload' && (
                <div>
                  <div
                    onClick={() => document.getElementById('qr-file-input').click()}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-white rounded-xl p-8 text-center cursor-pointer transition-all"
                  >
                    <UploadCloud className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Drop QR Image Label</h4>
                    <p className="text-xs text-slate-500 mb-3">Supports PNG, JPG, JPEG, SVG format</p>
                    <button type="button" className="inline-flex items-center gap-2 h-8 px-3 bg-white border border-slate-200 text-indigo-700 text-xs font-bold rounded-lg hover:bg-slate-50 shadow-sm">Browse Files</button>
                    <input
                      type="file"
                      id="qr-file-input"
                      accept="image/*,.svg"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                  </div>

                  {uploadFile && (
                    <div className="mt-4 p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm">
                      <div>
                        <span className="font-bold text-slate-900 block">{uploadFile.name}</span>
                        <span className="text-slate-500 font-mono">{(uploadFile.size / 1024).toFixed(1)} KB</span>
                        {uploadState && <span className="block mt-1 font-semibold text-emerald-600">{uploadState}</span>}
                      </div>
                      <button onClick={() => { setUploadFile(null); setUploadState(''); }}>
                        <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      </button>
                    </div>
                  )}

                  <div id="file-scanner-sandbox" className="hidden" />
                </div>
              )}

              {/* Tab 3: Manual SKU Entry */}
              {activeTab === 'manual' && (
                <div>
                  <form onSubmit={handleManualSearch} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Product SKU or Barcode Code</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. KA-KA001 or type code..."
                          value={manualInput}
                          onChange={e => setManualInput(e.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-10 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {manualInput && (
                          <button
                            type="button"
                            onClick={() => setManualInput('')}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={manualSearching || !manualInput.trim()}
                      className="w-full h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {manualSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>Add Product by SKU</span>
                    </button>
                  </form>

                  {/* Branch Quick-Add Chips */}
                  {branchProducts.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                        Quick Add Items ({branchName}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {branchProducts.slice(0, 6).map(bp => (
                          <button
                            key={bp.id}
                            type="button"
                            onClick={() => {
                              setManualInput(bp.item_code || bp.sku);
                              handleScannedCode(bp.item_code || bp.sku);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 transition-colors"
                          >
                            <span>{bp.item_code || bp.sku}</span>
                            <span className="text-[10px] text-slate-400">({bp.item_name || bp.name})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: POS Cart, Details & Checkout */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">POS Transaction Cart</h3>
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                  {cart.length} item{cart.length !== 1 ? 's' : ''} ({totalQuantity} unit{totalQuantity !== 1 ? 's' : ''})
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-5 flex-1 overflow-y-auto max-h-[460px]">
              {cart.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">POS Cart is Empty</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Point your camera to a QR code on the left, upload an image label, or type a SKU to add products to this transaction.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => {
                    const unitPrice = getItemUnitPrice(item);
                    const lineTotal = unitPrice * item.quantity;
                    const isExceedingStock = mode === 'stock_out' && item.quantity > item.in_stock;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isExceedingStock
                            ? 'bg-rose-50/70 border-rose-200'
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-600">{item.sku}</span>
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>
                              {mode === 'stock_out' && (
                                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                                  {priceTier} tier
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-0.5">{item.name}</h4>
                            {(item.colour || item.size || item.model) && (
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                                {item.colour && <span className="rounded-full bg-pink-50 px-2 py-0.5 text-pink-700">Colour: {item.colour}</span>}
                                {item.size && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Size: {item.size}</span>}
                                {item.model && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700">Model: {item.model}</span>}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Stock & Price Details Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-500">
                              In Stock: <strong className={`font-mono font-bold ${item.in_stock <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>{item.in_stock}</strong>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500">
                              Unit: <strong className="font-mono text-slate-900">RM {unitPrice.toFixed(2)}</strong>
                            </span>
                          </div>

                          {/* Quantity Controls and Line Total */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-md bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 shadow-sm transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-12 h-7 bg-transparent text-center font-mono font-bold text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-7 h-7 rounded-md bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 shadow-sm transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-right min-w-[80px]">
                              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Subtotal</span>
                              <span className="text-sm font-extrabold font-mono text-slate-900">
                                RM {lineTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isExceedingStock && (
                          <div className="mt-2 text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Requested ({item.quantity}) exceeds available floor stock ({item.in_stock}).</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Footer: Summary & Confirm / Cancel Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200">
              <div className="space-y-3 mb-4">
                {/* Sale Note Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction Note / Reference (Optional)</label>
                  <input
                    type="text"
                    value={saleNote}
                    onChange={e => setSaleNote(e.target.value)}
                    placeholder={mode === 'stock_out' ? 'e.g. Counter walk-in sale #01' : 'e.g. Supplier delivery ref #...'}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Grand Total Row */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Due</span>
                    <span className="text-xs text-slate-500">
                      {mode === 'stock_out' ? `Sale (${priceTier.toUpperCase()} PRICE)` : 'Restock Units Intake'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold font-mono text-indigo-700 block">
                      RM {grandTotal.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-400">Total units: {totalQuantity}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Confirm and Cancel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0 || submitting}
                  className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <X className="w-4 h-4" /> Cancel & Clear
                </button>

                <button
                  type="button"
                  onClick={handleConfirmTransaction}
                  disabled={cart.length === 0 || submitting || (mode === 'stock_out' && stockErrors.length > 0)}
                  className={`h-11 rounded-xl text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 ${
                    mode === 'stock_out'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : mode === 'stock_out' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Complete Sale (RM {grandTotal.toFixed(2)})</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>Confirm & Receive Stock (+{totalQuantity})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Success Receipt Modal */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {successReceipt.mode === 'stock_out' ? 'Sale Completed!' : 'Stock Received!'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{successReceipt.message}</p>
            </div>

            {/* Receipt Summary Breakdown */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs mb-4 space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Transaction Time:</span>
                <span className="font-mono text-slate-900">{new Date(successReceipt.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Mode:</span>
                <span className="font-bold text-slate-900 uppercase">{successReceipt.mode === 'stock_out' ? `Sale (${successReceipt.price_tier})` : 'Stock In'}</span>
              </div>
              {successReceipt.mode === 'stock_out' && (
                <div className="flex justify-between text-slate-600">
                  <span>Payment Method:</span>
                  <span className="font-semibold text-slate-900 uppercase">{successReceipt.payment_method}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Total Items Processed:</span>
                <span className="font-mono font-bold text-slate-900">{successReceipt.total_items} item(s) / {successReceipt.total_quantity} unit(s)</span>
              </div>

              {/* Items List Preview */}
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                {successReceipt.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-700">
                    <span className="truncate max-w-[200px]">{it.name} (x{it.quantity})</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {successReceipt.mode === 'stock_out' ? `RM ${it.line_total?.toFixed(2)}` : `Stock: ${it.new_stock}`}
                    </span>
                  </div>
                ))}
              </div>

              {successReceipt.mode === 'stock_out' && (
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
                  <span>Grand Total Paid:</span>
                  <span className="text-indigo-700 font-mono">RM {parseFloat(successReceipt.grand_total || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setSuccessReceipt(null)}
                className="h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>New Transaction</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Wrap>
  );
}

