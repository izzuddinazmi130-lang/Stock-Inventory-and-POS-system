import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import {
  FileBarChart, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Layers, AlertTriangle, RotateCcw, Calendar, Clock
} from 'lucide-react';

const TIMELINE_OPTIONS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: '1 Week' },
  { id: '30days', label: '30 Days' },
  { id: '90days', label: '90 Days' }
];

const TIMELINE_LABELS = {
  all: 'All Time',
  today: 'Today',
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
  '90days': 'Last 90 Days'
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateRangeParams = (range) => {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  if (range === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  } else if (range === '7days') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return { startDate: formatLocalDate(d), endDate: todayStr };
  } else if (range === '30days') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { startDate: formatLocalDate(d), endDate: todayStr };
  } else if (range === '90days') {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return { startDate: formatLocalDate(d), endDate: todayStr };
  }
  return { startDate: '', endDate: '' };
};

export default function ReportsAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket } = useSocket();

  const queryBusinessId = searchParams.get('business_id') || '';
  const queryBranchId = searchParams.get('branch_id') || '';
  const queryStoreId = searchParams.get('store_id') || '';

  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({
    total_transactions: 0,
    stock_in_qty: 0,
    stock_out_qty: 0,
    adjust_qty: 0,
    damaged_qty: 0,
    damaged_count: 0
  });

  // Filter state
  const [businessId, setBusinessId] = useState(queryBusinessId);
  const [branchId, setBranchId] = useState(queryBranchId);
  const [storeId, setStoreId] = useState(queryStoreId);
  const [movementType, setMovementType] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // all, today, 7days, 30days, 90days

  // Options dropdowns
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [stores, setStores] = useState([]);

  // Sync from URL search parameters if changed
  useEffect(() => {
    if (queryBusinessId) setBusinessId(queryBusinessId);
    if (queryBranchId) setBranchId(queryBranchId);
    if (queryStoreId) setStoreId(queryStoreId);
  }, [queryBusinessId, queryBranchId, queryStoreId]);

  // If only branchId was provided in query string, resolve businessId from branch details
  useEffect(() => {
    if (queryBranchId && !queryBusinessId) {
      api.get(`/branches/${queryBranchId}`).then(res => {
        if (res.data.success && res.data.data?.business_id) {
          setBusinessId(String(res.data.data.business_id));
        }
      }).catch(() => {});
    }
  }, [queryBranchId, queryBusinessId]);

  // Fetch businesses on mount
  useEffect(() => {
    api.get('/businesses').then(res => {
      if (res.data.success) {
        setBusinesses(res.data.businesses || res.data.data || []);
      }
    }).catch(() => {});
  }, []);

  // Fetch branches when businessId changes
  useEffect(() => {
    if (businessId) {
      api.get(`/businesses/${businessId}/branches`).then(res => {
        if (res.data.success) {
          setBranches(res.data.branches || res.data.data || []);
        }
      }).catch(() => {});
    } else {
      setBranches([]);
    }
  }, [businessId]);

  // Fetch stores when branchId changes
  useEffect(() => {
    if (branchId) {
      api.get(`/branches/${branchId}/stores`).then(res => {
        if (res.data.success) {
          setStores(res.data.stores || res.data.data || []);
        }
      }).catch(() => {});
    } else {
      setStores([]);
    }
  }, [branchId]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRangeParams(dateRange);
      
      let queryParams = `movement_type=${movementType}`;
      if (businessId) queryParams += `&business_id=${businessId}`;
      if (branchId) queryParams += `&branch_id=${branchId}`;
      if (storeId) queryParams += `&store_id=${storeId}`;
      if (startDate) queryParams += `&start_date=${startDate}`;
      if (endDate) queryParams += `&end_date=${endDate}`;

      const [movRes, sumRes] = await Promise.all([
        api.get(`/reports/movement?${queryParams}`),
        api.get(`/reports/summary?${queryParams}`)
      ]);

      if (movRes.data.success) {
        setMovements(movRes.data.movements || []);
      }
      if (sumRes.data.success) {
        setSummary(sumRes.data.data || {});
      }
    } catch (err) {
      console.error('Fetch report error:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, branchId, storeId, movementType, dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Real-time synchronization via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      fetchReports();
    };

    socket.on('inventory_updated', handleRefresh);
    socket.on('product_deleted', handleRefresh);
    socket.on('damage_reported', handleRefresh);
    socket.on('damage_deleted', handleRefresh);
    socket.on('branch_updated', handleRefresh);

    return () => {
      socket.off('inventory_updated', handleRefresh);
      socket.off('product_deleted', handleRefresh);
      socket.off('damage_reported', handleRefresh);
      socket.off('damage_deleted', handleRefresh);
      socket.off('branch_updated', handleRefresh);
    };
  }, [socket, fetchReports]);

  const handleResetFilters = () => {
    setBusinessId('');
    setBranchId('');
    setStoreId('');
    setMovementType('all');
    setDateRange('all');
    setSearchParams({});
  };

  const hasActiveFilters = businessId || branchId || storeId || movementType !== 'all' || dateRange !== 'all';
  const activeBranchName = branches.find(b => String(b.id) === String(branchId))?.name;
  const activeBusinessName = businesses.find(b => String(b.id) === String(businessId))?.name;

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports and Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of stock movements, inventory changes, and business performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReports} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
          </button>
        </div>
      </div>

      {/* Deep Link Filter Notification Banner */}
      {hasActiveFilters && (
        <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-indigo-700">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>
              Filtered Report Scope: <strong className="font-bold">{activeBusinessName || 'Selected Business'}</strong>
              {activeBranchName && <> &rarr; <strong className="font-bold">{activeBranchName}</strong></>}
              {dateRange !== 'all' && <> &bull; Timeline: <strong className="font-bold">{TIMELINE_LABELS[dateRange]}</strong></>}
            </span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
          </button>
        </div>
      )}

      {/* Key Metrics Section with Timeline Control */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Key Performance Metrics</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  {TIMELINE_LABELS[dateRange] || 'All Time'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Aggregate stock activity and write-off metrics for the selected timeline</p>
            </div>
          </div>

          {/* Timeline Selector Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start sm:self-auto border border-slate-200">
            {TIMELINE_OPTIONS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDateRange(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  dateRange === t.id
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Total Transactions</span>
              <span className="text-2xl font-bold text-slate-900">{summary.total_transactions}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Activity records &bull; {TIMELINE_LABELS[dateRange]}</span>
            </div>
          </div>

          <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Stock Added</span>
              <span className="text-2xl font-bold text-emerald-600">+{summary.stock_in_qty}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Units added &bull; {TIMELINE_LABELS[dateRange]}</span>
            </div>
          </div>

          <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Items Stocked Out</span>
              <span className="text-2xl font-bold text-rose-600">-{summary.stock_out_qty}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Units stocked out &bull; {TIMELINE_LABELS[dateRange]}</span>
            </div>
          </div>

          <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Damaged Goods</span>
              <span className="text-2xl font-bold text-amber-600">{summary.damaged_qty} units</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{summary.damaged_count} damage records &bull; {TIMELINE_LABELS[dateRange]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Control Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Filter Report View</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors font-semibold"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Business Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Business</label>
            <select
              value={businessId}
              onChange={(e) => { setBusinessId(e.target.value); setBranchId(''); setStoreId(''); }}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Overall (All Businesses)</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setStoreId(''); }}
              disabled={!businessId && branches.length === 0}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Store Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pop-up Store</label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              disabled={!branchId || stores.length === 0}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Activity Type Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Activity Type</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Movements</option>
              <option value="in">Stock Additions (In)</option>
              <option value="out">Stock Out</option>
              <option value="adjust">Adjustments</option>
              <option value="damage">Damage Write-offs</option>
            </select>
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Timeframe</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">1 Week (Last 7 Days)</option>
              <option value="30days">30 Days (Last Month)</option>
              <option value="90days">90 Days (Last Quarter)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Movement Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-900 text-sm">Movement Activity Log</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Total Entries: {movements.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Product Details</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Business & Branch</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Movement Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Quantity</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Stock Level</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Performed By</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 text-sm border-b border-slate-100">
                    Fetching activity records...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 text-sm border-b border-slate-100">
                    <p className="font-semibold text-slate-900 mb-1">No movement records found</p>
                    <p className="text-slate-500 text-xs">No activity matches the selected filter parameters. Try resetting filters.</p>
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
                      <span className="text-slate-900 text-xs font-medium block">{m.business_name || 'Business'}</span>
                      <span className="text-slate-500 text-xs block">{m.branch_name}</span>
                      {m.store_name && <span className="text-amber-600 text-[11px] font-mono block">Store: {m.store_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      {m.movement_type === 'in' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 w-fit"><ArrowDownLeft className="w-3 h-3" /> STOCK IN</span>
                      ) : m.movement_type === 'out' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 w-fit"><ArrowUpRight className="w-3 h-3" /> STOCK OUT</span>
                      ) : m.movement_type === 'damage' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 w-fit">DAMAGE</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-50 text-violet-700 w-fit">ADJUST</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 font-mono font-bold">
                      {m.movement_type === 'in' ? (
                        <span className="text-emerald-600">+{m.quantity}</span>
                      ) : m.movement_type === 'out' ? (
                        <span className="text-rose-600">-{m.quantity}</span>
                      ) : (
                        <span className="text-violet-600">{m.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 font-mono text-xs">
                      <span className="text-slate-500">{m.qty_before}</span> &rarr; <span className="text-emerald-600 font-bold">{m.qty_after}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 text-xs">
                      <span className="block font-medium">{m.performed_by_name || 'System'}</span>
                      <span className="text-slate-500 font-mono text-[11px] block">{m.performed_by_email || '—'}</span>
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
