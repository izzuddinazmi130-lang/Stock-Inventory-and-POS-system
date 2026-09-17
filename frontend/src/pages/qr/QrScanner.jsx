import React, { useEffect, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, QrCode, UploadCloud, CheckCircle, AlertCircle, ShoppingCart, MinusCircle, RefreshCw, X, Tag, Building } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QrScanner() {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'upload'
  const [qrInput, setQrInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('Store Walk-in / Counter Sale');
  const [autoSubmit, setAutoSubmit] = useState(false);

  // States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamId, setSelectedCamId] = useState('');
  const [statusBadge, setStatusBadge] = useState({ text: 'Ready', color: 'bg-violet-50 text-violet-700' });

  // Lookup & Deduction States
  const [productPreview, setProductPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [deductResult, setDeductResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Upload Preview State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadState, setUploadState] = useState('');

  const html5QrCodeRef = useRef(null);

  // Sound Chime Feedback
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  };

  // Enumerate cameras
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        setSelectedCamId(devices[0].id);
      }
    }).catch(err => {});

    return () => {
      stopCamera();
    };
  }, []);

  // Handle camera start
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
          handleSuccessfulScan(decodedText);
        },
        () => {}
      );

      setIsCameraActive(true);
      setStatusBadge({ text: 'Scanning Active', color: 'bg-emerald-50 text-emerald-700' });
    } catch (err) {
      console.error('Camera start error:', err);
      setStatusBadge({ text: 'Camera Unavailable', color: 'bg-rose-50 text-rose-700' });
      alert('Could not access camera. Please check browser permissions or use Upload QR Image.');
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

  // Handle successful scan
  const handleSuccessfulScan = (decodedText) => {
    playBeep();
    setQrInput(decodedText);
    lookupProduct(decodedText);

    if (autoSubmit) {
      setTimeout(() => {
        handleDeductSubmit(null, decodedText);
      }, 400);
    }
  };

  // Product Lookup
  const lookupProduct = async (code) => {
    if (!code || code.trim().length < 2) {
      setProductPreview(null);
      return;
    }
    let cleanCode = code.trim();
    // Parse HQ-ITEM-{branchCode}-{item_code} — branch code can be alphanumeric
    const match = cleanCode.match(/^HQ-ITEM-[^-]+-(.+)$/);
    if (match) cleanCode = match[1];

    try {
      const res = await api.get(`/products?search=${encodeURIComponent(cleanCode)}`);
      if (res.data.success && res.data.items.length > 0) {
        const found = res.data.items.find(i => i.item_code.toLowerCase() === cleanCode.toLowerCase()) || res.data.items[0];
        setProductPreview(found);
      } else {
        setProductPreview(null);
      }
    } catch (err) {
      setProductPreview(null);
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
      handleSuccessfulScan(decodedText);
    } catch (err) {
      setUploadState('No valid QR matrix found.');
      setStatusBadge({ text: 'No QR Found', color: 'bg-rose-50 text-rose-700' });
    }
  };

  // Submit Stock Deduction
  const handleDeductSubmit = async (e, scannedCode = null) => {
    if (e) e.preventDefault();
    const targetCode = scannedCode || qrInput;

    if (!targetCode) {
      setMessage({ type: 'danger', text: 'Please scan or enter a valid QR code / SKU.' });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      const res = await api.post('/qr/scan-deduct', {
        qr_code: targetCode,
        quantity,
        note
      });

      if (res.data.success) {
        setDeductResult(res.data);
        setMessage({ type: 'success', text: res.data.message });
        lookupProduct(targetCode);
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">QR Code Scanner & Direct Dispatch</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live optical webcam scanning and image file upload deduction for floor dispatch</p>
        </div>
        <Link to="/qr/generate" className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <QrCode className="w-4 h-4" />
          <span>Generate QR Labels</span>
        </Link>
      </div>

      {/* Alerts */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="hover:opacity-75 transition-opacity"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Universal Scanner Panel */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-slate-900 text-sm">Universal QR Code Scanner</h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.color}`}>{statusBadge.text}</span>
            </div>

            <div className="p-5">
              {/* Tab Switcher */}
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('camera');
                    setStatusBadge({ text: 'Ready', color: 'bg-violet-50 text-violet-700' });
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'camera' ? 'bg-white rounded-lg shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" /> Live Camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('upload');
                    stopCamera();
                    setStatusBadge({ text: 'Drop / Upload QR', color: 'bg-violet-50 text-violet-700' });
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'upload' ? 'bg-white rounded-lg shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Upload QR Image
                </button>
              </div>

              {/* 1. Camera Viewport */}
              {activeTab === 'camera' && (
                <div>
                  {cameras.length > 1 && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Camera Device</label>
                      <select value={selectedCamId} onChange={e => setSelectedCamId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {cameras.map(c => <option key={c.id} value={c.id}>{c.label || c.id}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="relative min-h-[300px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center">
                    <div id="camera-reader-viewport" className="w-full h-full rounded-xl overflow-hidden" />

                    {!isCameraActive && (
                      <div className="text-center p-6">
                        <Camera className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Optical Camera Ready</h3>
                        <p className="text-xs text-slate-500 max-w-xs">Click "Activate Camera" to enable video capture & scan barcode labels.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 justify-center">
                    {!isCameraActive ? (
                      <button type="button" onClick={startCamera} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                        <Camera className="w-4 h-4" /> Activate Camera
                      </button>
                    ) : (
                      <button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                        Stop Camera
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 2. File Upload Viewport */}
              {activeTab === 'upload' && (
                <div>
                  <div
                    onClick={() => document.getElementById('qr-file-input').click()}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50 rounded-xl p-8 text-center cursor-pointer transition-all"
                  >
                    <UploadCloud className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Select or Drag & Drop QR Image</h3>
                    <p className="text-xs text-slate-500 mb-4">Supports PNG, JPG, JPEG, SVG labels</p>
                    <button type="button" className="inline-flex items-center gap-2 h-8 px-3 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors">Choose File</button>
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
                      <button onClick={() => { setUploadFile(null); setUploadState(''); }}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>
                    </div>
                  )}

                  <div id="file-scanner-sandbox" className="hidden" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stock Deduction Dispatch Form */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-slate-900 text-sm">Stock Deduction Dispatch</h3>
              </div>
              <span className="text-xs text-slate-500">Auto or Manual Entry</span>
            </div>

            <div className="p-5">
              {/* Product Preview Card */}
              {productPreview && (
                <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-50 text-violet-700"><Tag className="w-3 h-3" /> {productPreview.category}</span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600"><Building className="w-3 h-3" /> {productPreview.branch_name}</span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-base mb-1">{productPreview.item_name}</h5>
                  <div className="flex items-center gap-4 text-xs pt-2 border-t border-slate-200">
                    <span className="text-slate-500">SKU: <strong className="font-mono text-slate-900">{productPreview.item_code}</strong></span>
                    <span className="text-slate-500">In Stock: <strong className="font-mono text-emerald-600">{productPreview.quantity} units</strong></span>
                    <span className="text-slate-500">Price: <strong className="font-mono text-slate-900">RM {parseFloat(productPreview.selling_price || 0).toFixed(2)}</strong></span>
                  </div>
                </div>
              )}

              <form onSubmit={handleDeductSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scanned QR Code or Item SKU *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Point camera, upload image, or type SKU (e.g. KA-A1)"
                      value={qrInput}
                      onChange={e => {
                        setQrInput(e.target.value);
                        lookupProduct(e.target.value);
                      }}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    {qrInput && (
                      <button type="button" onClick={() => { setQrInput(''); setProductPreview(null); }} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sale Note / Destination</label>
                    <input
                      type="text"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="auto-submit"
                    checked={autoSubmit}
                    onChange={e => setAutoSubmit(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="auto-submit" className="text-xs text-slate-600 cursor-pointer select-none">
                    Instant Dispatch: automatically submit deduction upon successful QR scan
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <MinusCircle className="w-5 h-5" />
                    <span>{submitting ? 'Deducting Stock...' : 'Confirm & Deduct Stock'}</span>
                  </button>
                </div>
              </form>

              {deductResult && (
                <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3" /> Transaction Recorded</span>
                    <span className="font-mono text-xs text-slate-500">{new Date().toLocaleTimeString()}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{deductResult.item.item_name}</h3>
                  <div className="flex gap-4 text-xs font-mono text-slate-600">
                    <span>SKU: {deductResult.item.item_code}</span>
                    <span>Deducted: <strong className="text-rose-600">-{deductResult.qty_deducted}</strong></span>
                    <span>New Stock: <strong className="text-emerald-600">{deductResult.new_stock} units</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
