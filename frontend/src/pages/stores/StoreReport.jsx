import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileBarChart, RefreshCw, CreditCard, Banknote, MapPin, Calendar, ArrowLeft } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';

export default function StoreReport() {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ total_cash: 0, total_online: 0, total_sales: 0, total_items_sold: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const [stRes, repRes] = await Promise.all([
        api.get(`/stores/${id}`),
        api.get(`/stores/${id}/report`)
      ]);

      if (stRes.data.success) {
        setStore(stRes.data.store || stRes.data.data);
      }
      if (repRes.data.success) {
        setMovements(repRes.data.movements || repRes.data.data || []);
        if (repRes.data.summary) setSummary(repRes.data.summary);
      }
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to fetch store report' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-slate-400 text-sm">Loading store sales report...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <nav className="text-sm text-slate-400 mb-4 flex items-center gap-1.5">
        <Link to="/businesses" className="hover:text-slate-900 transition-colors">Businesses</Link>
        <span>/</span>
        <Link to={`/businesses/${store?.business_id || 1}/branches`} className="hover:text-slate-900 transition-colors">{store?.business_name || 'Business'}</Link>
        <span>/</span>
        <Link to={`/branches/${store?.branch_id}`} className="hover:text-slate-900 transition-colors">{store?.branch_name || 'Branch'}</Link>
        <span>/</span>
        <Link to={`/branches/${store?.branch_id}/stores`} className="hover:text-slate-900 transition-colors">{store?.name || 'Stores'}</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Store Event Report</span>
      </nav>

      {message && (
        <div className="p-3 mb-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-semibold">
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{store?.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${store?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : store?.status === 'upcoming' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              {store?.status ? store.status.toUpperCase() : 'EVENT'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-1">
            {store?.venue && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-indigo-500" /> {store.venue}</span>}
            {store?.start_date && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> {new Date(store.start_date).toLocaleDateString()} — {new Date(store.end_date).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Link to={`/branches/${store?.branch_id}/stores`} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={16} /> Back to Stores
          </Link>
          <button onClick={fetchReport} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">QR / Online Banking</p>
            <p className="text-2xl font-bold text-slate-900">RM {summary.total_online.toFixed(2)}</p>
            <span className="text-[11px] text-emerald-600 font-medium">Digital Payment Breakdown</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Banknote size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cash Sales</p>
            <p className="text-2xl font-bold text-slate-900">RM {summary.total_cash.toFixed(2)}</p>
            <span className="text-[11px] text-amber-600 font-medium">Physical Cash Collected</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileBarChart size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Store Revenue</p>
            <p className="text-2xl font-bold text-indigo-600">RM {summary.total_sales.toFixed(2)}</p>
            <span className="text-[11px] text-slate-500 font-medium">{summary.total_items_sold || movements.length} total sales records</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileBarChart size={18} className="text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Store Stock Movements & Sales Transactions</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Total Entries: {movements.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">SKU / Item</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Category</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Movement Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Quantity</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Payment Method</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Note / Reference</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!movements || movements.length === 0) ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500 bg-white text-sm">
                    No sales or stock transactions recorded for this store event yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors bg-white">
                    <td className="px-4 py-3 text-sm border-b border-slate-100">
                      <div className="text-slate-900 font-bold">{m.item_name}</div>
                      <div className="font-mono text-indigo-600 text-xs">{m.item_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">{m.category || 'General'}</td>
                    <td className="px-4 py-3 text-sm border-b border-slate-100">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        m.movement_type === 'in' ? 'bg-emerald-50 text-emerald-700' : m.movement_type === 'out' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {m.movement_type === 'in' ? 'STOCK IN' : m.movement_type === 'out' ? 'STOCK OUT' : 'ADJUST'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-bold font-mono border-b border-slate-100">{m.quantity}</td>
                    <td className="px-4 py-3 text-sm border-b border-slate-100">
                      {m.payment_method ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          m.payment_method === 'cash' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {m.payment_method === 'cash' ? '💵 Cash' : '💳 QR / Online'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate border-b border-slate-100">{m.note || 'Store sale'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap border-b border-slate-100">{new Date(m.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
