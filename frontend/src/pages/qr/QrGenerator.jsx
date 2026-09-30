import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Printer, Package, RefreshCw, Search, Minus, Plus, Building, AlertTriangle } from 'lucide-react';

// Only the label sheet is printed: everything else on the page (the app root) is hidden.
const PRINT_CSS = `
.qr-print-root { display: none; }
@media print {
  @page { margin: 8mm; }
  body > *:not(.qr-print-root) { display: none !important; }
  body { background: #fff !important; }
  .qr-print-root { display: flex !important; flex-wrap: wrap; gap: 4mm; }
  .qr-print-label {
    width: 70mm; height: 36mm; box-sizing: border-box;
    border: 0.3mm dashed #999; border-radius: 2mm; padding: 2.5mm;
    display: flex; gap: 2.5mm; align-items: center;
    break-inside: avoid; page-break-inside: avoid;
    font-family: 'Inter', system-ui, sans-serif; color: #000;
  }
  .qr-print-label .qr-box { width: 30mm; height: 30mm; flex-shrink: 0; }
  .qr-print-label .qr-box svg { width: 100%; height: 100%; display: block; }
  .qr-print-label .info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1mm; }
  .qr-print-label .name { font-size: 9pt; font-weight: 700; line-height: 1.2; max-height: 2.4em; overflow: hidden; }
  .qr-print-label .variant { font-size: 7.5pt; color: #333; }
  .qr-print-label .sku { font-family: ui-monospace, monospace; font-size: 7.5pt; }
  .qr-print-label .price { font-size: 12pt; font-weight: 800; margin-top: auto; }
}`;

const money = (v) => `RM ${(parseFloat(v) || 0).toFixed(2)}`;
const rowKey = (item) => `${item.id}-${item.branch_id}`;

// Size / colour etc. shown under the product name, e.g. "Size L · Red"
function variantLine(item) {
  if (!item) return '';
  const v = item.variants || {};
  const parts = [];
  if (v.size || item.size) parts.push(`Size ${v.size || item.size}`);
  Object.entries(v).forEach(([k, val]) => {
    if (k !== 'size' && val) parts.push(String(val));
  });
  return parts.join(' · ');
}

// The label itself, used both for the on-screen preview and the print sheet
function Label({ item, qrSvg, showPrice, print = false }) {
  const variants = variantLine(item);
  if (print) {
    return (
      <div className="qr-print-label">
        <div className="qr-box" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="info">
          <div className="name">{item.item_name}</div>
          {variants && <div className="variant">{variants}</div>}
          <div className="sku">{item.item_code}</div>
          {showPrice && <div className="price">{money(item.selling_price)}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-md aspect-[70/36] bg-white rounded-xl border-2 border-dashed border-slate-300 p-4 flex items-center gap-4 text-slate-900">
      <div className="h-full aspect-square flex-shrink-0 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className="min-w-0 flex-1 h-full flex flex-col py-1">
        <p className="font-bold text-base leading-snug line-clamp-2">{item.item_name}</p>
        {variants && <p className="text-sm text-slate-600 mt-0.5 truncate">{variants}</p>}
        <p className="font-mono text-xs text-slate-500 mt-1">{item.item_code}</p>
        {showPrice && <p className="mt-auto text-xl font-extrabold">{money(item.selling_price)}</p>}
      </div>
    </div>
  );
}

export default function QrGenerator({ embedded = false }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const Wrap = embedded ? React.Fragment : Layout;
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('product_id') || '';

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        if (res.data.success) {
          const list = res.data.items || [];
          setItems(list);
          const wanted = initialProductId && list.find(i => String(i.id) === String(initialProductId));
          const first = wanted || list[0];
          if (first) setSelectedKey(rowKey(first));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load products.');
      } finally {
        setItemsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const selectedItem = useMemo(() => items.find(i => rowKey(i) === selectedKey) || null, [items, selectedKey]);

  useEffect(() => {
    if (!selectedItem) return;
    let cancelled = false;
    const generateQr = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/qr/generate/${selectedItem.id}`, {
          params: isSuperAdmin ? { branch_id: selectedItem.branch_id } : undefined
        });
        if (!cancelled && res.data.success) setQrData(res.data);
      } catch (err) {
        if (!cancelled) {
          setQrData(null);
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    generateQr();
    return () => { cancelled = true; };
  }, [selectedItem, isSuperAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.item_name || '').toLowerCase().includes(q) ||
      (i.item_code || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      variantLine(i).toLowerCase().includes(q)
    );
  }, [items, search]);

  // Details come from the product list (it has size/variants); the QR comes from /qr/generate
  const labelItem = selectedItem && qrData ? { ...qrData.item, ...selectedItem } : null;
  const canPrint = !!(labelItem && qrData?.qr_svg && !loading);
  const noPrice = labelItem && !(parseFloat(labelItem.selling_price) > 0);

  const setCopiesSafe = (n) => setCopies(Math.min(100, Math.max(1, parseInt(n, 10) || 1)));

  return (
    <Wrap>
      <style>{PRINT_CSS}</style>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Print QR labels</h1>
        <p className="text-sm text-slate-500 mt-0.5">Pick a product, check the label, then print. Stick the label on the item or shelf so it can be scanned at the Point of Sale.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left: product picker ── */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
              Choose a product
            </h2>
            <span className="text-xs text-slate-400">{filtered.length} of {items.length}</span>
          </div>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, SKU, size or category…"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {itemsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading products…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                {items.length === 0 ? 'No products yet.' : 'No products match your search.'}
              </div>
            ) : filtered.map(item => {
              const isSelected = rowKey(item) === selectedKey;
              const variants = variantLine(item);
              return (
                <button
                  key={rowKey(item)}
                  type="button"
                  onClick={() => setSelectedKey(rowKey(item))}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 border-l-4 transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-500' : 'border-transparent hover:bg-slate-50'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>{item.item_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      <span className="font-mono text-indigo-600">{item.item_code}</span>
                      {variants && <> · {variants}</>}
                      {isSuperAdmin && item.branch_name && <> · {item.branch_name}</>}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium ${parseInt(item.quantity, 10) > 0 ? 'text-slate-500' : 'text-amber-600'}`}>
                    {parseInt(item.quantity, 10) || 0} in stock
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Right: preview + print options ── */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden lg:sticky lg:top-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
              Check the label and print
            </h2>
          </div>

          {error && (
            <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="bg-slate-50 m-4 rounded-xl border border-slate-100 min-h-[240px] flex items-center justify-center p-6">
            {loading ? (
              <div className="text-center">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Preparing label…</p>
              </div>
            ) : labelItem ? (
              <Label item={labelItem} qrSvg={qrData.qr_svg} showPrice={showPrice} />
            ) : (
              <div className="text-center text-slate-400">
                <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Choose a product to see its label.</p>
              </div>
            )}
          </div>

          {labelItem && (
            <div className="px-4 pb-1 -mt-1 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>{labelItem.category}</span>
              {labelItem.branch_name && <span className="inline-flex items-center gap-1"><Building className="w-3 h-3" />{labelItem.branch_name}</span>}
              <span>Label size 70 × 36 mm</span>
            </div>
          )}

          {noPrice && showPrice && (
            <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              This product has no customer price yet, so the label will show RM 0.00. Set a price in Products, or untick “Show price”.
            </div>
          )}

          <div className="p-4 mt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Copies</span>
              <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
                <button type="button" onClick={() => setCopiesSafe(copies - 1)} className="h-9 w-9 flex items-center justify-center text-slate-600 hover:bg-slate-50" aria-label="Fewer copies">
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={e => setCopiesSafe(e.target.value)}
                  className="h-9 w-14 border-x border-slate-200 text-center text-sm font-mono focus:outline-none"
                  aria-label="Number of copies"
                />
                <button type="button" onClick={() => setCopiesSafe(copies + 1)} className="h-9 w-9 flex items-center justify-center text-slate-600 hover:bg-slate-50" aria-label="More copies">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Show price
            </label>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={!canPrint}
              className="sm:ml-auto inline-flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              Print {copies} label{copies === 1 ? '' : 's'}
            </button>
          </div>
        </section>
      </div>

      {/* Print-only sheet, mounted outside the app root so nothing else prints */}
      {canPrint && createPortal(
        <div className="qr-print-root">
          {Array.from({ length: copies }, (_, i) => (
            <Label key={i} item={labelItem} qrSvg={qrData.qr_svg} showPrice={showPrice} print />
          ))}
        </div>,
        document.body
      )}
    </Wrap>
  );
}
