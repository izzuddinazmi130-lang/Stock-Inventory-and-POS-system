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
          <h1 className="text-xl font-bold text-slate-900">Stock Movement Audit Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Detailed history of stock additions, dispatches, and inventory adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMovements} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Movement Types</option>
            <option value="in">Stock Additions (STOCK IN)</option>
            <option value="out">Dispatches (STOCK OUT)</option>
            <option value="adjust">Stock Adjustments</option>
            <option value="damage">Damage Write-offs</option>
          </select>
        </div>
        <span className="text-xs font-mono text-slate-500">Total Entries: {movements.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-slate-900 text-sm">Movement Transactions Log</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Product SKU & Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Facility</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Movement Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Qty Changed</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Qty Before &rarr; After</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Note / Reference</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Performed By</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-3 text-sm text-center py-8 text-slate-500 border-b border-slate-100">
                    No movement records found for selected filter.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <div className="font-bold">{m.item_name}</div>
                      <div className="font-mono text-xs text-indigo-500">{m.item_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600">
                        {m.branch_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      {m.movement_type === 'in' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700"><ArrowDownLeft className="w-3 h-3" /> STOCK IN</span>
                      ) : m.movement_type === 'out' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700"><ArrowUpRight className="w-3 h-3" /> DISPATCH</span>
                      ) : m.movement_type === 'damage' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">DAMAGE</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-50 text-violet-700">ADJUST</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 font-mono font-bold">
                      {m.movement_type === 'in' ? `+${m.quantity}` : `-${m.quantity}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 font-mono text-xs">
                      <span className="text-slate-500">{m.qty_before}</span> &rarr; <span className="text-emerald-600 font-bold">{m.qty_after}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 max-w-xs truncate">
                      {m.note || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 text-xs">
                      <span className="block font-medium">{m.performed_by_name || 'System Admin'}</span>
                      <span className="text-slate-500 font-mono text-[11px] block">{m.performed_by_email}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 border-b border-slate-100 font-mono">
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
