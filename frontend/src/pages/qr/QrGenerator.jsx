import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Printer, Camera, Package, RefreshCw, Building, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QrGenerator({ embedded = false }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const Wrap = embedded ? React.Fragment : Layout;
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('product_id') || '';

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(initialProductId);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        if (res.data.success) {
          setItems(res.data.items);
          if (!selectedId && res.data.items.length > 0) {
            setSelectedId(res.data.items[0].id);
          }
        }
      } catch (err) {}
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const generateQr = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/qr/generate/${selectedId}`);
        if (res.data.success) {
          setQrData(res.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    generateQr();
  }, [selectedId]);

  return (
    <Wrap>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">QR Code Label Generator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate high-density asset barcode labels for shelf inventory &amp; POS scanning</p>
        </div>
        <div className="flex items-center gap-2">
          {!isSuperAdmin ? (
            <Link to="/qr/scan" className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <Camera className="w-4 h-4" />
              <span>Open POS Scanner</span>
            </Link>
          ) : (
            <Link to="/reports" className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
              <span>View Stock Movements</span>
            </Link>
          )}
          {qrData && (
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Printer className="w-4 h-4" />
              <span>Print Label</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Selector */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm"><Package className="w-4 h-4 text-indigo-500 inline mr-2" />Select Product ({items.length})</h3>
            </div>
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <label className="block text-sm font-medium text-slate-700 mb-1">Choose Item from Inventory</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Product --</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.branch_name}] {item.item_code} - {item.item_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100">
              {items.map((item) => {
                const isSelected = parseInt(selectedId) === parseInt(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-3.5 flex items-center justify-between transition-all ${
                      isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-indigo-600 font-bold">{item.item_code}</span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600">
                          <Building className="w-3 h-3 inline mr-1" />{item.branch_name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-900 font-medium">{item.item_name}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 font-mono">{item.quantity} in stock</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Printable QR Label */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-full flex flex-col items-center justify-center p-8 text-center">
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs w-full text-left">
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-12">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500">Rendering vector SVG QR label...</p>
              </div>
            ) : qrData && qrData.item ? (
              <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">HQ Asset Tag</span>
                  <span className="font-mono text-xs font-bold text-slate-600">SKU: {qrData.item.item_code}</span>
                </div>

                <h3 className="font-bold text-slate-900 text-base mb-1">{qrData.item.item_name}</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {qrData.item.category}
                  {qrData.item.branch_name && <> &bull; <Building className="w-3 h-3 inline" /> {qrData.item.branch_name}</>}
                </p>

                {/* SVG Render */}
                <div className="bg-white p-3 border border-slate-200 rounded-xl inline-block mb-4 shadow-sm" dangerouslySetInnerHTML={{ __html: qrData.qr_svg }} />

                <div className="bg-slate-50 p-2 rounded-lg font-mono text-xs font-bold text-indigo-600 mb-4 tracking-wider border border-slate-100">
                  {qrData.qr_code}
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Selling Price</span>
                  <span className="font-extrabold text-slate-900 text-sm">RM {parseFloat(qrData.item.selling_price || 0).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-slate-400">
                <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-xs">Select a product on the left to generate its QR label.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Wrap>
  );
}
