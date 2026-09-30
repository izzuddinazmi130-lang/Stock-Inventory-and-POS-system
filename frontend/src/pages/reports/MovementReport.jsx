import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FileBarChart, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';

export default function MovementReport() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/movement?movement_type=${filterType}`);
      if (res.data.success) {
        setMovements(res.data.movements);
      }
    } catch (err) {
      console.error('Movement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [filterType]);

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Stock Movement Audit Report</h1>
          <p className="text-sm text-ink-muted mt-0.5">Detailed history of stock additions, stock outs, and inventory adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMovements} className="inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-ink-muted" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="all">All Movement Types</option>
            <option value="in">Stock Additions (STOCK IN)</option>
            <option value="out">Stock Out</option>
            <option value="adjust">Stock Adjustments</option>
            <option value="damage">Damage Write-offs</option>
          </select>
        </div>
        <span className="text-xs font-mono text-ink-muted">Total Entries: {movements.length}</span>
      </div>

      {/* Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-ink text-sm">Movement Transactions Log</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Product SKU & Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Facility</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Movement Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Qty Changed</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Qty Before &rarr; After</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Note / Reference</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Performed By</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-3 text-sm text-center py-8 text-ink-muted border-b border-line-soft">
                    No movement records found for selected filter.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-subtle transition-colors">
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <div className="font-bold">{m.item_name}</div>
                      <div className="font-mono text-xs text-accent">{m.item_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-sunken text-ink-secondary">
                        {m.branch_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      {m.movement_type === 'in' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-success-soft text-success-fg"><ArrowDownLeft className="w-3 h-3" /> STOCK IN</span>
                      ) : m.movement_type === 'out' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-danger-soft text-danger-fg"><ArrowUpRight className="w-3 h-3" /> STOCK OUT</span>
                      ) : m.movement_type === 'damage' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg">DAMAGE</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-soft text-violet-fg">ADJUST</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft font-mono font-bold">
                      {m.movement_type === 'in' ? `+${m.quantity}` : `-${m.quantity}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft font-mono text-xs">
                      <span className="text-ink-muted">{m.qty_before}</span> &rarr; <span className="text-success-fg font-bold">{m.qty_after}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft max-w-xs truncate">
                      {m.note || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft text-xs">
                      <span className="block font-medium">{m.performed_by_name || 'System Admin'}</span>
                      <span className="text-ink-muted font-mono text-[11px] block">{m.performed_by_email}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted border-b border-line-soft font-mono">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
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
