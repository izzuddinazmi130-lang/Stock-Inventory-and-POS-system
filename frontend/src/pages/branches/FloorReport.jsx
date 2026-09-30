import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Banknote, CreditCard, FileBarChart, RefreshCw,
  ShoppingBag, Wallet, Hash, Calendar, User, AlertCircle
} from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';

function formatDateTime(val) {
  if (!val) return '-';
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

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function paymentLabel(method) {
  if (method === 'cash') return 'Cash';
  if (method === 'qr') return 'QR Pay';
  if (method === 'online_banking') return 'Online Banking';
  return 'Unspecified';
}

function paymentClass(method) {
  if (method === 'cash') return 'bg-warning-soft text-warning-fg border-warning-line';
  if (method === 'qr') return 'bg-success-soft text-success-fg border-success-line';
  if (method === 'online_banking') return 'bg-info-soft text-info-fg border-info-line';
  return 'bg-sunken text-ink-secondary border-line';
}

export default function FloorReport() {
  const { id } = useParams();
  const [branch, setBranch] = useState(null);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({
    total_cash: 0,
    total_qr: 0,
    total_online: 0,
    total_sales: 0,
    total_items_sold: 0,
    total_transactions: 0
  });
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    payment_method: 'all',
    sort: 'date_desc'
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const [branchRes, reportRes] = await Promise.all([
        api.get(`/branches/${id}`),
        api.get(`/branches/${id}/floor-report`, {
          params: {
            start_date: filters.start_date || undefined,
            end_date: filters.end_date || undefined,
            payment_method: filters.payment_method,
            sort: filters.sort
          }
        })
      ]);

      if (branchRes.data.success) {
        setBranch(branchRes.data.branch || branchRes.data.data);
      }
      if (reportRes.data.success) {
        setMovements(reportRes.data.movements || reportRes.data.data || []);
        setSummary(reportRes.data.summary || summary);
      }
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || err.message || 'Failed to load branch floor report'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id, filters.start_date, filters.end_date, filters.payment_method, filters.sort]);

  const cards = [
    { label: 'Total Sales', value: money(summary.total_sales), icon: FileBarChart, color: 'text-accent bg-accent-soft' },
    { label: 'Cash', value: money(summary.total_cash), icon: Banknote, color: 'text-warning-fg bg-warning-soft' },
    { label: 'QR Pay', value: money(summary.total_qr), icon: Wallet, color: 'text-success-fg bg-success-soft' },
    { label: 'Online', value: money(summary.total_online), icon: CreditCard, color: 'text-info-fg bg-info-soft' },
    { label: 'Items Sold', value: Number(summary.total_items_sold || 0), icon: ShoppingBag, color: 'text-danger-fg bg-danger-soft' },
    { label: 'Transactions', value: Number(summary.total_transactions || 0), icon: Hash, color: 'text-ink-secondary bg-sunken' }
  ];

  return (
    <Layout>
      <nav className="text-sm text-ink-muted mb-4 flex items-center gap-1.5">
        <Link to="/dashboard" className="hover:text-ink transition-colors">{branch?.business_name || 'Dashboard'}</Link>
        <span>/</span>
        <Link to={`/branches/${id}/stores`} className="hover:text-ink transition-colors">{branch?.name || 'Branch'}</Link>
        <span>/</span>
        <span className="text-ink font-semibold">Branch Floor Sales</span>
      </nav>

      {message && (
        <div className="mb-6 p-3.5 bg-danger-soft border border-danger-line rounded-xl text-danger-fg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-danger-fg flex-shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Branch Floor (Main) Sales</h1>
          <p className="text-xs text-ink-muted mt-1">
            Walk-in POS sales for {branch?.name || 'this branch'} where no store event was selected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/branches/${id}/stores`}
            className="inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors"
          >
            <ArrowLeft size={16} /> Back to Stores
          </Link>
          <button
            onClick={fetchReport}
            className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Payment</label>
            <select
              value={filters.payment_method}
              onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="qr">QR Pay</option>
              <option value="online_banking">Online Banking</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Sort</label>
            <select
              value={filters.sort}
              onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Amount High to Low</option>
              <option value="amount_asc">Amount Low to High</option>
              <option value="qty_desc">Quantity High to Low</option>
              <option value="qty_asc">Quantity Low to High</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        {cards.map(card => (
          <div key={card.label} className="bg-surface border border-line rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{card.label}</span>
              <span className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-ink">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-accent" />
            <h3 className="font-semibold text-ink text-sm">Branch Floor Transactions</h3>
          </div>
          <span className="text-xs font-mono text-ink-muted">Showing {movements.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-subtle">
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line">Timestamp</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line">Item</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line">Payment</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-right">Qty</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-right">Amount</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-ink-muted text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                    Loading branch floor sales...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-ink-muted text-xs">
                    No branch floor sales found for the selected filters.
                  </td>
                </tr>
              ) : (
                movements.map(m => {
                  const amount = Number(m.selling_price || 0) * Number(m.quantity || 0);
                  return (
                    <tr key={m.id} className="hover:bg-subtle transition-colors bg-surface">
                      <td className="px-4 py-3 text-sm text-ink-muted font-mono whitespace-nowrap border-b border-line-soft">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-3 text-sm border-b border-line-soft">
                        <div className="text-ink font-bold">{m.item_name || 'Unknown item'}</div>
                        <div className="font-mono text-accent text-xs">{m.item_code || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm border-b border-line-soft">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${paymentClass(m.payment_method)}`}>
                          {paymentLabel(m.payment_method)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-ink font-bold font-mono border-b border-line-soft">{m.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-ink font-bold font-mono border-b border-line-soft">{money(amount)}</td>
                      <td className="px-4 py-3 text-sm text-ink-secondary border-b border-line-soft">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-ink-muted" />
                          {m.performed_by_name || 'System'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
