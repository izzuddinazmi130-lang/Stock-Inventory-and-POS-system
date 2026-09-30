import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileBarChart, RefreshCw, CreditCard, Banknote, MapPin, Calendar,
  ArrowLeft, Clock, CheckCircle2, AlertCircle, Phone, User, Info
} from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateOnly(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTimeOnly(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleTimeString('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function getStorePhase(store) {
  if (!store) return 'before';
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (store.status === 'ended' || (eTime > 0 && now > eTime)) {
    return 'after';
  }
  if (sTime > 0 && now < sTime) {
    return 'before';
  }
  if (sTime > 0 && eTime > 0 && now >= sTime && now <= eTime) {
    return 'during';
  }
  return store.status === 'active' ? 'during' : 'before';
}

function getTimingStatusText(store, phase) {
  if (!store) return '';
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (phase === 'before') {
    const diffMs = sTime - now;
    if (diffMs <= 0) return 'Starts shortly';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return `Starts in ${days} day${days > 1 ? 's' : ''}${remHours > 0 ? `, ${remHours}h` : ''}`;
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return `Starts in ${hours}h ${mins % 60}m`;
    return `Starts in ${Math.max(1, mins)} min${mins !== 1 ? 's' : ''}`;
  }

  if (phase === 'during') {
    const diffMs = eTime - now;
    if (diffMs <= 0) return 'Ending now';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return `Closes in ${days}d ${remHours}h`;
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return `Ends in ${hours}h ${mins % 60}m`;
    return `Ends in ${Math.max(1, mins)} mins`;
  }

  // Phase is 'after'
  if (store.ended_at || eTime > 0) {
    const closedTime = store.ended_at ? new Date(store.ended_at).getTime() : eTime;
    const diffMs = now - closedTime;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0) return `Concluded ${days} day${days > 1 ? 's' : ''} ago`;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return `Concluded ${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Recently concluded';
  }

  return 'Concluded';
}

export default function StoreReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [store, setStore] = useState(null);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ total_cash: 0, total_online: 0, total_sales: 0, total_items_sold: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // 1. Fetch store detail
      let storeData = null;
      try {
        const stRes = await api.get(`/stores/${id}`);
        if (stRes.data.success) {
          storeData = stRes.data.store || stRes.data.data;
          setStore(storeData);
        }
      } catch (storeErr) {
        console.error('Store detail fetch error:', storeErr);
        const errMsg = storeErr.response?.data?.message || storeErr.message || 'Failed to fetch store details';
        setMessage({ type: 'danger', text: errMsg });
        return;
      }

      // 2. Fetch report movements & transactions
      try {
        const repRes = await api.get(`/stores/${id}/report`);
        if (repRes.data.success) {
          setMovements(repRes.data.movements || repRes.data.data || []);
          if (repRes.data.summary) setSummary(repRes.data.summary);
        }
      } catch (repErr) {
        console.warn('Store movements fetch warning:', repErr);
        const repErrMsg = repErr.response?.data?.message || repErr.message || 'Could not load transaction breakdown';
        setMessage({ type: 'warning', text: repErrMsg });
      }
    } catch (err) {
      console.error('Unexpected error fetching report:', err);
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message || 'An error occurred while loading the report' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const phase = getStorePhase(store);
  const timingText = getTimingStatusText(store, phase);

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-slate-500 text-sm font-medium">Loading store event report...</p>
        </div>
      </Layout>
    );
  }

  if (!store) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-16 text-center">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Store Event Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            {message?.text || `Unable to locate store event #${id}. It may have been removed or you may lack permission.`}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to={isSuperAdmin ? '/businesses' : `/branches/${user?.branch_id}/stores`}
              className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={16} /> {isSuperAdmin ? 'Businesses' : 'My Stores'}
            </Link>
            <button
              onClick={fetchReport}
              className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Breadcrumb Navigation */}
      <nav className="text-sm text-slate-400 mb-4 flex items-center gap-1.5">
        {isSuperAdmin ? (
          <>
            <Link to="/businesses" className="hover:text-slate-900 transition-colors">Businesses</Link>
            <span>/</span>
            <Link to={`/businesses/${store.business_id}/branches`} className="hover:text-slate-900 transition-colors">{store.business_name || 'Business'}</Link>
          </>
        ) : (
          <span>{store.business_name || 'Business'}</span>
        )}
        <span>/</span>
        <Link to={`/branches/${store.branch_id}`} className="hover:text-slate-900 transition-colors">{store.branch_name || 'Branch'}</Link>
        <span>/</span>
        <Link to={`/branches/${store.branch_id}/stores`} className="hover:text-slate-900 transition-colors">Stores</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{store.name} Report</span>
      </nav>

      {message && (
        <div className={`p-3.5 mb-6 rounded-xl text-sm font-medium flex items-center justify-between ${
          message.type === 'danger'
            ? 'bg-rose-50 border border-rose-200 text-rose-800'
            : message.type === 'warning'
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'danger' ? <AlertCircle size={16} className="text-rose-600 flex-shrink-0" /> : <Info size={16} className="text-amber-600 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
        </div>
      )}

      {/* Header with Title and Dynamic Real-Time Status Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{store.name}</h1>
            
            {phase === 'during' && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE EVENT
              </span>
            )}
            {phase === 'before' && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                UPCOMING EVENT
              </span>
            )}
            {phase === 'after' && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                CONCLUDED EVENT
              </span>
            )}

            {timingText && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {timingText}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
            {store.venue && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <MapPin size={14} className="text-indigo-500" /> {store.venue}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <span className="font-mono">{formatDateTime(store.start_date)} &rarr; {formatDateTime(store.end_date)}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/branches/${store.branch_id}/stores`}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Stores
          </Link>
          <button
            onClick={fetchReport}
            className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Differentiated Informative Banner based on Date & Time Phase */}
      {phase === 'before' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block text-sm text-amber-900 mb-1">
              Event Scheduled — Not Yet Live ({timingText})
            </span>
            <p className="text-amber-800 leading-relaxed">
              This event is set to open on <strong>{formatDateTime(store.start_date)}</strong> and will run until <strong>{formatDateTime(store.end_date)}</strong>. Sales transactions, QR scan checkouts, and payment breakdowns will dynamically log here once the event goes live.
            </p>
          </div>
        </div>
      )}

      {phase === 'during' && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3 shadow-xs">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping flex-shrink-0 mt-1" />
          <div className="flex-1">
            <span className="font-bold block text-sm text-emerald-900 mb-1">
              Active Live Sales Window in Progress ({timingText})
            </span>
            <p className="text-emerald-800 leading-relaxed">
              Live customer transactions via QR and Cash are currently recording for this event until <strong>{formatDateTime(store.end_date)}</strong>. Real-time metrics below reflect active inventory movements.
            </p>
          </div>
        </div>
      )}

      {phase === 'after' && (
        <div className="mb-6 p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block text-sm text-slate-900 mb-1">
              Event Concluded — Final Sales &amp; Reconciliation Report
            </span>
            <p className="text-slate-600 leading-relaxed">
              This event concluded on <strong>{formatDateTime(store.ended_at || store.end_date)}</strong>. The metrics below represent the completed financial breakdown and finalized stock out records.
            </p>
          </div>
        </div>
      )}

      {/* Date & Operational Timing Details Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-500" /> Operational Schedule &amp; Contact Info
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="block text-[11px] font-semibold uppercase text-slate-400">Start Schedule</span>
            <span className="block text-sm font-bold text-slate-900 mt-1">{formatDateOnly(store.start_date)}</span>
            <span className="block text-xs font-mono text-indigo-600 mt-0.5">{formatTimeOnly(store.start_date)}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="block text-[11px] font-semibold uppercase text-slate-400">End Schedule</span>
            <span className="block text-sm font-bold text-slate-900 mt-1">{formatDateOnly(store.end_date)}</span>
            <span className="block text-xs font-mono text-indigo-600 mt-0.5">{formatTimeOnly(store.end_date)}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="block text-[11px] font-semibold uppercase text-slate-400">Person In Charge</span>
            <span className="flex text-sm font-bold text-slate-900 mt-1 items-center gap-1">
              <User size={13} className="text-slate-400" /> {store.person_in_charge || 'HQ Staff'}
            </span>
            {store.contact_phone ? (
              <span className="flex text-xs font-mono text-slate-500 mt-0.5 items-center gap-1">
                <Phone size={11} className="text-slate-400" /> {store.contact_phone}
              </span>
            ) : (
              <span className="block text-xs text-slate-400 mt-0.5">—</span>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="block text-[11px] font-semibold uppercase text-slate-400">Operational Phase</span>
            <span className="block text-sm font-bold mt-1 capitalize text-slate-900">
              {phase === 'before' ? 'Upcoming' : phase === 'during' ? 'Live Operational' : 'Concluded'}
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">{timingText}</span>
          </div>
        </div>

        {store.notes && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Notes: </span>
            <span>{store.notes}</span>
          </div>
        )}
      </div>

      {/* Revenue & Payment Method KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">QR / Online Banking</p>
            <p className="text-2xl font-bold text-slate-900">RM {summary.total_online.toFixed(2)}</p>
            <span className="text-[11px] text-emerald-600 font-medium">Digital e-Wallet Breakdown</span>
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
            <span className="text-[11px] text-slate-500 font-medium">{summary.total_items_sold || movements.length} total items sold</span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileBarChart size={18} className="text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Store Stock Movements &amp; Sales Transactions</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Total Entries: {movements.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">SKU / Item</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">Category</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">Movement</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">Quantity</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">Payment Method</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">Note / Reference</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!movements || movements.length === 0) ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400 bg-white text-xs">
                    {phase === 'before' ? (
                      <div className="flex flex-col items-center justify-center">
                        <Clock className="w-8 h-8 text-amber-400 mb-2" />
                        <p className="font-semibold text-slate-700 mb-0.5">Event Scheduled — No Transactions Yet</p>
                        <p className="text-slate-400 font-mono">Event opens on {formatDateTime(store.start_date)}. Stock out and sales will populate automatically.</p>
                      </div>
                    ) : phase === 'during' ? (
                      <div className="flex flex-col items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping mb-2" />
                        <p className="font-semibold text-slate-700 mb-0.5">Live Event Open — Awaiting First Transaction</p>
                        <p className="text-slate-400">Scan QR codes or log transactions to see live sales stream here.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 mb-0.5">Event Concluded</p>
                        <p className="text-slate-400">No sales or stock transactions were recorded for this store event.</p>
                      </div>
                    )}
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
                          {m.payment_method === 'cash' ? 'Cash' : 'QR / Online'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate border-b border-slate-100">{m.note || 'Store sale'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap border-b border-slate-100">{formatDateTime(m.created_at)}</td>
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
