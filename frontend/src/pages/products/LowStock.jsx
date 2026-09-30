import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useSocket } from '../../context/SocketContext';
import { AlertTriangle, PackageX, Search, RefreshCw, PackagePlus, CheckCircle, ArrowRight } from 'lucide-react';

const TABS = [
  { value: 'all', label: 'All alerts' },
  { value: 'out', label: 'Out of stock' },
  { value: 'low', label: 'Running low' },
];

const selectClass = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';

// Builds the Point of Sale hand-off link: /qr/scan?receive=<productId>:<qty>,...
const receiveLink = (rows) => `/qr/scan?receive=${rows.map(r => `${r.id}:${r.suggested_restock}`).join(',')}`;

export default function LowStock() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const { businesses = [] } = useBusiness() || {};
  const { socket } = useSocket() || {};
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ out: 0, low: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/branches').then(res => { if (res.data.success) setBranches(res.data.branches || []); }).catch(() => {});
  }, [isSuperAdmin]);

  const branchOptions = useMemo(
    () => (businessId ? branches.filter(b => String(b.business_id) === String(businessId)) : branches),
    [branches, businessId]
  );

  const load = useCallback(async () => {
    try {
      setError('');
      const params = {};
      if (isSuperAdmin && businessId) params.business_id = businessId;
      if (isSuperAdmin && branchId) params.branch_id = branchId;
      const res = await api.get('/products/low-stock', { params });
      if (res.data.success) {
        setItems(res.data.items || []);
        setCounts(res.data.counts || { out: 0, low: 0, total: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load low-stock products.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, businessId, branchId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Stock changes anywhere (sales, restocks, adjustments) refresh the list
  useEffect(() => {
    if (!socket) return;
    socket.on('inventory_updated', load);
    return () => socket.off('inventory_updated', load);
  }, [socket, load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (tab !== 'all' && i.stock_status !== tab) return false;
      if (!q) return true;
      return [i.name, i.sku, i.category, i.size, i.branch_name].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [items, tab, search]);

  const tabCount = { all: counts.total, out: counts.out, low: counts.low };

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Low stock</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Products at or below their “alert at” level{isSuperAdmin ? ' in each branch' : ''}. Restock them before customers find the shelf empty.
          </p>
        </div>
        {!isSuperAdmin && shown.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(receiveLink(shown))}
            className="inline-flex items-center gap-2 h-10 px-4 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 self-start sm:self-auto"
          >
            <PackagePlus className="w-4 h-4" /> Restock {shown.length === 1 ? 'this item' : `all ${shown.length}`}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <button type="button" onClick={() => setTab('out')} className={`text-left bg-white border rounded-xl p-4 flex items-center gap-4 transition-colors ${tab === 'out' ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200 hover:border-slate-300'}`}>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0"><PackageX className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{counts.out}</div>
            <div className="text-xs text-slate-500">Out of stock: can't be sold right now</div>
          </div>
        </button>
        <button type="button" onClick={() => setTab('low')} className={`text-left bg-white border rounded-xl p-4 flex items-center gap-4 transition-colors ${tab === 'low' ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200 hover:border-slate-300'}`}>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{counts.low}</div>
            <div className="text-xs text-slate-500">Running low: at or below the alert level</div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-col md:flex-row md:items-center gap-2">
        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg self-start">
          {TABS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors ${tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.label} <span className="ml-0.5 text-slate-400">{tabCount[t.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, SKU, size or category…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {isSuperAdmin && (
          <>
            <select value={businessId} onChange={e => { setBusinessId(e.target.value); setBranchId(''); }} className={selectClass} aria-label="Business">
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className={selectClass} aria-label="Branch">
              <option value="">All branches</option>
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-14 text-center text-sm text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Checking stock…</div>
        ) : shown.length === 0 ? (
          <div className="py-14 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-700">{items.length === 0 ? 'All stocked up' : 'Nothing matches'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{items.length === 0 ? 'No product is at or below its alert level.' : 'Try another tab or clear the search.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  {isSuperAdmin && <th className="px-4 py-2.5 font-semibold">Branch</th>}
                  <th className="px-4 py-2.5 font-semibold">In stock</th>
                  <th className="px-4 py-2.5 font-semibold">Alert at</th>
                  <th className="px-4 py-2.5 font-semibold">Suggested restock</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(i => (
                  <tr key={`${i.id}-${i.branch_id}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{i.name}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono text-indigo-600">{i.sku}</span>
                        {i.size && <> · Size {i.size}</>}
                        {i.category && <> · {i.category}</>}
                      </p>
                    </td>
                    {isSuperAdmin && <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{i.branch_name}</td>}
                    <td className="px-4 py-3 whitespace-nowrap"><StockBadge status={i.stock_status} quantity={i.quantity} /></td>
                    <td className="px-4 py-3 font-mono text-slate-600">{i.min_quantity}</td>
                    <td className="px-4 py-3 font-mono text-slate-900">+{i.suggested_restock}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isSuperAdmin ? (
                        <Link to={`/products?search=${encodeURIComponent(i.sku)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                          View product <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <Link to={receiveLink([i])} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                          <PackagePlus className="w-3.5 h-3.5" /> Restock
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isSuperAdmin && shown.length > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          “Restock” opens the Point of Sale in <strong>Receive stock</strong> mode with the suggested quantity filled in. Change it to what actually arrived, then confirm.
          The suggestion brings stock back to twice the alert level. Change the alert level in <Link to="/products" className="text-indigo-600 font-semibold">Products</Link>.
        </p>
      )}
    </Layout>
  );
}

export function StockBadge({ status, quantity }) {
  if (status === 'out') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-700">Out of stock</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">{quantity} left</span>;
}
