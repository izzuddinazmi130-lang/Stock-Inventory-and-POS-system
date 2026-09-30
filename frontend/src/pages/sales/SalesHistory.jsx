import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useSocket } from '../../context/SocketContext';
import { SaleReceipt, ReceiptModal, PAYMENT_LABELS, rm, formatDateTime } from '../../components/pos/Receipt';
import {
  Receipt, Search, ShoppingCart, RefreshCw, ChevronLeft, ChevronRight, Banknote, QrCode, CreditCard,
  TrendingUp, Package, AlertTriangle
} from 'lucide-react';

const PAYMENT_ICONS = { cash: Banknote, qr: QrCode, online_banking: CreditCard };

// Local YYYY-MM-DD (not UTC, so "today" is the shop's today)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function periodRange(period) {
  const now = new Date();
  const today = ymd(now);
  if (period === 'today') return { from: today, to: today };
  if (period === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: ymd(y), to: ymd(y) };
  }
  if (period === '7d') {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { from: ymd(s), to: today };
  }
  if (period === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return { from: '', to: '' }; // 'all'
}

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const selectClass = 'h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent';

export default function SalesHistory() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const { businesses = [] } = useBusiness() || {};
  const { socket } = useSocket() || {};

  // Filters
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState(ymd(new Date()));
  const [customTo, setCustomTo] = useState(ymd(new Date()));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);

  // Data
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSale, setOpenSale] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const range = period === 'custom' ? { from: customFrom, to: customTo } : periodRange(period);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/branches').then(res => { if (res.data.success) setBranches(res.data.branches || []); }).catch(() => {});
  }, [isSuperAdmin]);

  const branchOptions = useMemo(
    () => (businessId ? branches.filter(b => String(b.business_id) === String(businessId)) : branches),
    [branches, businessId]
  );

  // Search waits until typing pauses
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page, limit: 25 };
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      if (search) params.search = search;
      if (payment) params.payment_method = payment;
      if (isSuperAdmin && businessId) params.business_id = businessId;
      if (isSuperAdmin && branchId) params.branch_id = branchId;
      const res = await api.get('/sales', { params });
      if (res.data.success) {
        setSales(res.data.sales || []);
        setSummary(res.data.summary);
        setTotalPages(res.data.total_pages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load sales.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, range.from, range.to, search, payment, businessId, branchId, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // New sales appear on their own
  useEffect(() => {
    if (!socket) return;
    const onMovement = (payload) => { if (payload?.action === 'stock_out') load(); };
    socket.on('stock_movement', onMovement);
    return () => socket.off('stock_movement', onMovement);
  }, [socket, load]);

  const openReceipt = async (id) => {
    try {
      setOpeningId(id);
      const res = await api.get(`/sales/${id}`);
      if (res.data.success) setOpenSale(res.data.sale);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open that receipt.');
    } finally {
      setOpeningId(null);
    }
  };

  const changeFilter = (setter) => (value) => { setter(value); setPage(1); };
  const rangeLabel = range.from
    ? (range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`)
    : 'All time';

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Sales history</h1>
          <p className="text-sm text-ink-muted mt-0.5">Every sale from the Point of Sale, with its receipt. Click a sale to view or reprint the receipt.</p>
        </div>
        {!isSuperAdmin && (
          <Link to="/qr/scan" className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent-hover self-start sm:self-auto">
            <ShoppingCart className="w-4 h-4" /> Open Point of Sale
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-surface border border-line rounded-xl p-3 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => changeFilter(setPeriod)(p.value)}
              className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${period === p.value ? 'bg-accent border-accent text-white' : 'bg-surface border-line text-ink-secondary hover:bg-subtle'}`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 ml-1">
              <input type="date" value={customFrom} max={customTo} onChange={e => changeFilter(setCustomFrom)(e.target.value)} className={selectClass} aria-label="From date" />
              <span className="text-xs text-ink-muted">to</span>
              <input type="date" value={customTo} min={customFrom} onChange={e => changeFilter(setCustomTo)(e.target.value)} className={selectClass} aria-label="To date" />
            </div>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by receipt number, product name or SKU…"
              className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <select value={payment} onChange={e => changeFilter(setPayment)(e.target.value)} className={selectClass} aria-label="Payment method">
            <option value="">All payments</option>
            {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {isSuperAdmin && (
            <>
              <select value={businessId} onChange={e => { changeFilter(setBusinessId)(e.target.value); setBranchId(''); }} className={selectClass} aria-label="Business">
                <option value="">All businesses</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={branchId} onChange={e => changeFilter(setBranchId)(e.target.value)} className={selectClass} aria-label="Branch">
                <option value="">All branches</option>
                {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <SummaryCard icon={Receipt} label="Sales" value={summary ? summary.sales_count : '—'} sub={rangeLabel} />
        <SummaryCard icon={TrendingUp} label="Revenue" value={summary ? rm(summary.revenue) : '—'} sub="Total charged" />
        <SummaryCard icon={ShoppingCart} label="Average sale" value={summary ? rm(summary.average) : '—'} sub="Per receipt" />
        <SummaryCard icon={Package} label="Units sold" value={summary ? summary.units : '—'} sub="All items" />
      </div>
      {summary && summary.revenue > 0 && <PaymentSplit byPayment={summary.by_payment} total={summary.revenue} />}

      {error && (
        <div className="mb-4 p-3 bg-danger-soft border border-danger-line rounded-lg text-danger-fg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Sales list */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-subtle border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-2.5 font-semibold">Receipt</th>
                <th className="px-4 py-2.5 font-semibold">Date &amp; time</th>
                <th className="px-4 py-2.5 font-semibold">Items</th>
                <th className="px-4 py-2.5 font-semibold">Payment</th>
                {isSuperAdmin && <th className="px-4 py-2.5 font-semibold">Branch</th>}
                <th className="px-4 py-2.5 font-semibold">Served by</th>
                <th className="px-4 py-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loading && sales.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} className="py-14 text-center text-ink-muted text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading sales…
                </td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} className="py-14 text-center">
                  <Receipt className="w-9 h-9 mx-auto mb-2 text-ink-subtle" />
                  <p className="text-sm font-semibold text-ink-secondary">No sales found</p>
                  <p className="text-xs text-ink-muted mt-0.5">Try another date range or clear the search.</p>
                </td></tr>
              ) : sales.map(s => {
                const PayIcon = PAYMENT_ICONS[s.payment_method] || Receipt;
                const preview = s.items_preview || [];
                return (
                  <tr
                    key={s.id}
                    onClick={() => openReceipt(s.id)}
                    onKeyDown={e => { if (e.key === 'Enter') openReceipt(s.id); }}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-accent-soft/50 focus:bg-accent-soft/50 focus:outline-none"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-accent">{s.receipt_no}</span>
                      {openingId === s.id && <RefreshCw className="w-3 h-3 animate-spin inline ml-1.5 text-ink-muted" />}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="truncate text-ink">{preview[0] || '—'}</p>
                      {preview.length > 1 && <p className="text-xs text-ink-muted">+ {preview.length - 1} more</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                        <PayIcon className="w-3.5 h-3.5 text-ink-muted" /> {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                      </span>
                    </td>
                    {isSuperAdmin && <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{s.branch_name}</td>}
                    <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{s.cashier_name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-ink">{rm(s.total_amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line-soft text-sm">
            <span className="text-ink-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 px-3 inline-flex items-center gap-1 rounded-lg border border-line text-ink-secondary hover:bg-subtle disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" /> Newer
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 px-3 inline-flex items-center gap-1 rounded-lg border border-line text-ink-secondary hover:bg-subtle disabled:opacity-40">
                Older <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {openSale && (
        <ReceiptModal
          onClose={() => setOpenSale(null)}
          header={
            <div className="text-center">
              <h3 className="text-lg font-bold text-ink">Receipt {openSale.receipt_no}</h3>
              <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(openSale.created_at)}</p>
            </div>
          }
        >
          <SaleReceipt sale={openSale} />
        </ReceiptModal>
      )}
    </Layout>
  );
}

function formatDay(value) {
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d) ? value : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SummaryCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div className="mt-2 text-xl font-bold text-ink font-mono tracking-tight truncate">{value}</div>
      <div className="text-xs text-ink-muted mt-0.5 truncate">{sub}</div>
    </div>
  );
}

// One bar showing how today's money came in
function PaymentSplit({ byPayment, total }) {
  const parts = [
    { key: 'cash', color: 'bg-success' },
    { key: 'qr', color: 'bg-accent' },
    { key: 'online_banking', color: 'bg-warning' },
  ];
  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 mb-5">
      <div className="flex h-2 rounded-full overflow-hidden bg-sunken">
        {parts.map(p => byPayment[p.key] > 0 && (
          <div key={p.key} className={p.color} style={{ width: `${(byPayment[p.key] / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
        {parts.map(p => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${p.color}`} />
            {PAYMENT_LABELS[p.key]} <strong className="font-mono text-ink">{rm(byPayment[p.key])}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
