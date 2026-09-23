import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { 
  History, Shield, RefreshCw, Search, Eye, Calendar, X, 
  ArrowRight, User, AlertTriangle, Package, Boxes, LogIn, 
  LogOut, CheckCircle, Laptop, Clock, Filter, Store, Building2,
  FileText, ExternalLink
} from 'lucide-react';

// Format relative time (e.g. "Just now", "5m ago", "2h ago")
function formatRelativeTime(dateString) {
  if (!dateString) return '—';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
}

// Clean IP address
function formatIp(ip) {
  if (!ip) return '127.0.0.1';
  let clean = ip.replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1') return '127.0.0.1 (Localhost)';
  return clean;
}

// Parse device / user agent
function parseUserAgent(ua) {
  if (!ua) return 'Web Browser';
  let browser = 'Browser';
  let os = '';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}

// Comprehensive parser that translates raw database audit rows into relevant business events
function parseAuditRecord(log) {
  let oldData = null;
  let newData = null;
  try {
    if (log.old_values) {
      oldData = typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values;
    }
  } catch (e) {}
  try {
    if (log.new_values) {
      newData = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
    }
  } catch (e) {}

  const action = (log.action || '').toUpperCase();
  const rawEntity = (log.entity_type || '').toLowerCase();
  
  let category = 'system'; // 'auth' | 'inventory' | 'damage' | 'catalog' | 'users' | 'stores' | 'system'
  let badgeLabel = action;
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let ActionIcon = Shield;
  let summary = '';
  let targetLabel = '';
  let detailsBadges = [];

  if (action === 'LOGIN') {
    category = 'auth';
    badgeLabel = 'Sign In';
    badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    ActionIcon = LogIn;
    const email = newData?.email || log.user_email || '';
    summary = `User authenticated into HQ Command Center`;
    targetLabel = email ? `Account: ${email}` : `User #${log.entity_id || log.user_id}`;
    if (email) detailsBadges.push({ label: 'User', value: email });
  } else if (action === 'LOGOUT') {
    category = 'auth';
    badgeLabel = 'Sign Out';
    badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
    ActionIcon = LogOut;
    summary = `User session terminated safely`;
    targetLabel = log.user_name ? `${log.user_name}` : `User #${log.entity_id || log.user_id}`;
  } else if (action === 'CREATE_DAMAGE_REPORT') {
    category = 'damage';
    badgeLabel = 'Damage Logged';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    ActionIcon = AlertTriangle;
    const sku = newData?.sku || '';
    const qty = newData?.quantity || 1;
    const totalVal = newData?.total_value ? `RM ${parseFloat(newData.total_value).toFixed(2)}` : '';
    const reason = newData?.reason_category ? newData.reason_category.replace(/_/g, ' ') : '';
    summary = `Reported ${qty} damaged units for SKU: ${sku || `Product #${newData?.product_id}`}`;
    targetLabel = `Damage Report #DR-${log.entity_id}`;
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
    if (qty) detailsBadges.push({ label: 'Quantity', value: `-${qty} units` });
    if (totalVal) detailsBadges.push({ label: 'Loss', value: totalVal });
    if (reason) detailsBadges.push({ label: 'Reason', value: reason });
  } else if (action === 'CREATE_ITEM') {
    category = 'catalog';
    badgeLabel = 'Product Created';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    ActionIcon = Package;
    const name = newData?.name || newData?.item_name || '';
    const sku = newData?.sku || newData?.item_code || '';
    summary = `Added new item "${name || 'Product'}" to catalog`;
    targetLabel = sku ? `SKU: ${sku}` : `Product #${log.entity_id}`;
    if (name) detailsBadges.push({ label: 'Item', value: name });
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
    if (newData?.category) detailsBadges.push({ label: 'Category', value: newData.category });
  } else if (action === 'UPDATE_ITEM') {
    category = 'catalog';
    badgeLabel = 'Product Edited';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    ActionIcon = Package;
    const name = newData?.item_name || newData?.name || oldData?.name || oldData?.item_name || '';
    const sku = oldData?.sku || oldData?.item_code || '';
    summary = `Updated catalog details for "${name || 'Product'}"`;
    targetLabel = sku ? `SKU: ${sku}` : `Product #${log.entity_id}`;
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
    if (newData?.status) detailsBadges.push({ label: 'Status', value: newData.status });
    if (newData?.selling_price) detailsBadges.push({ label: 'Price', value: `RM ${parseFloat(newData.selling_price).toFixed(2)}` });
  } else if (action === 'DELETE_ITEM') {
    category = 'catalog';
    badgeLabel = 'Product Deleted';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    ActionIcon = Package;
    const name = oldData?.name || oldData?.item_name || '';
    const sku = oldData?.sku || oldData?.item_code || '';
    summary = `Permanently removed "${name || 'Product'}" from catalog`;
    targetLabel = sku ? `SKU: ${sku}` : `Product #${log.entity_id}`;
    if (name) detailsBadges.push({ label: 'Item', value: name });
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
  } else if (action === 'STOCK_IN') {
    category = 'inventory';
    badgeLabel = 'Stock Inward';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    ActionIcon = Boxes;
    summary = `Restocked inventory balance`;
    targetLabel = `Item #${log.entity_id}`;
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: 'Balance', value: `${oldData.old_qty} → ${newData.new_qty} units` });
    }
  } else if (action === 'STOCK_OUT' || action === 'QR_SCAN_DEDUCT') {
    category = 'inventory';
    badgeLabel = action === 'QR_SCAN_DEDUCT' ? 'QR Stock Out' : 'Stock Out';
    badgeClass = 'bg-sky-50 text-sky-700 border-sky-200';
    ActionIcon = Boxes;
    summary = action === 'QR_SCAN_DEDUCT' 
      ? `Stocked out inventory via QR scanner scan`
      : `Stocked out items for order fulfillment or sale`;
    targetLabel = `Item #${log.entity_id}`;
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: 'Balance', value: `${oldData.old_qty} → ${newData.new_qty} units` });
    }
  } else if (action.includes('STOCK_ADJUST') || action === 'STOCK_ADJUSTMENT') {
    category = 'inventory';
    badgeLabel = 'Stock Adjusted';
    badgeClass = 'bg-violet-50 text-violet-700 border-violet-200';
    ActionIcon = Boxes;
    summary = `Manual stock count adjustment recorded`;
    targetLabel = `Item #${log.entity_id}`;
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: 'Adjustment', value: `${oldData.old_qty} → ${newData.new_qty} units` });
    }
  } else if (action === 'APPROVE_USER' || action === 'USER_APPROVAL') {
    category = 'users';
    badgeLabel = 'User Approved';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    ActionIcon = CheckCircle;
    summary = `Approved operator registration and granted system access`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'REJECT_USER' || action === 'USER_REJECTION') {
    category = 'users';
    badgeLabel = 'User Declined';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    ActionIcon = User;
    summary = `Declined pending user registration request`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'DELETE_USER') {
    category = 'users';
    badgeLabel = 'User Removed';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    ActionIcon = User;
    const name = oldData?.full_name || '';
    const email = oldData?.email || '';
    summary = `Deactivated user account ${name ? `"${name}"` : ''}`;
    targetLabel = email ? email : `User #${log.entity_id}`;
    if (name) detailsBadges.push({ label: 'Name', value: name });
    if (email) detailsBadges.push({ label: 'Email', value: email });
  } else if (action === 'USER_SUSPENDED') {
    category = 'users';
    badgeLabel = 'User Suspended';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    ActionIcon = User;
    summary = `Suspended user account access`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'USER_ACTIVATED') {
    category = 'users';
    badgeLabel = 'User Activated';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    ActionIcon = CheckCircle;
    summary = `Reactivated suspended user account`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'CREATE_USER') {
    category = 'users';
    badgeLabel = 'User Created';
    badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    ActionIcon = User;
    const name = newData?.full_name || '';
    const email = newData?.email || '';
    summary = `Created user account for ${name || email || 'operator'}`;
    targetLabel = email ? email : `User #${log.entity_id}`;
    if (email) detailsBadges.push({ label: 'Email', value: email });
    if (newData?.role) detailsBadges.push({ label: 'Role', value: newData.role });
  } else if (action.includes('STORE')) {
    category = 'stores';
    badgeLabel = action.replace(/_/g, ' ');
    badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
    ActionIcon = Store;
    summary = `Updated pop-up store or event outlet details`;
    targetLabel = `Store #${log.entity_id}`;
  } else if (action.includes('BRANCH')) {
    category = 'branches';
    badgeLabel = action.replace(/_/g, ' ');
    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
    ActionIcon = Building2;
    summary = `Updated branch warehouse configuration`;
    targetLabel = `Branch #${log.entity_id}`;
  } else {
    summary = log.action ? log.action.replace(/_/g, ' ') : 'System event';
    targetLabel = rawEntity ? `${rawEntity} #${log.entity_id || ''}` : 'System';
  }

  return {
    category,
    badgeLabel,
    badgeClass,
    ActionIcon,
    summary,
    targetLabel,
    detailsBadges,
    cleanIp: formatIp(log.ip_address),
    deviceInfo: parseUserAgent(log.user_agent),
    oldData,
    newData
  };
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Activity' },
  { id: 'auth', label: 'Logins & Auth' },
  { id: 'damage', label: 'Damage Reports' },
  { id: 'inventory', label: 'Stock Movements' },
  { id: 'catalog', label: 'Product Catalog' },
  { id: 'users', label: 'User Accounts' }
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Inspect Modal State
  const [inspectLog, setInspectLog] = useState(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterDate) {
        params.start_date = filterDate;
        params.end_date = filterDate;
      }
      const res = await api.get('/audit', { params });
      if (res.data.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, filterDate]);

  // Parse logs with rich metadata
  const enrichedLogs = useMemo(() => {
    return logs.map(l => ({
      ...l,
      parsed: parseAuditRecord(l)
    }));
  }, [logs]);

  // Filter logs by active category tab
  const filteredLogs = useMemo(() => {
    if (activeCategory === 'all') return enrichedLogs;
    return enrichedLogs.filter(l => l.parsed.category === activeCategory);
  }, [enrichedLogs, activeCategory]);

  // Compute stats
  const stats = useMemo(() => {
    return {
      total: enrichedLogs.length,
      auth: enrichedLogs.filter(l => l.parsed.category === 'auth').length,
      damage: enrichedLogs.filter(l => l.parsed.category === 'damage').length,
      inventory: enrichedLogs.filter(l => l.parsed.category === 'inventory').length,
      catalog: enrichedLogs.filter(l => l.parsed.category === 'catalog').length,
      users: enrichedLogs.filter(l => l.parsed.category === 'users').length,
    };
  }, [enrichedLogs]);

  // Calculate field differences for inspect modal
  const fieldDiffs = useMemo(() => {
    if (!inspectLog) return [];
    const oldObj = inspectLog.parsed.oldData;
    const newObj = inspectLog.parsed.newData;
    if (!oldObj && !newObj) return [];

    const keys = Array.from(new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ]));

    return keys.map(key => {
      const oldVal = oldObj ? oldObj[key] : undefined;
      const newVal = newObj ? newObj[key] : undefined;
      const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
      return { key, oldVal, newVal, changed };
    }).filter(d => d.changed);
  }, [inspectLog]);

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>Security & Compliance</span>
            <span>/</span>
            <span>Audit Trail</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Audit Log</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time, immutable record of inventory operations, authentication events, and administrative changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchAuditLogs} 
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">
              Total Recorded Events
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <History className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 block tracking-tight">
              {stats.total.toLocaleString()}
            </span>
            <span className="text-xs mt-1 block text-slate-500">
              Security & operational events in buffer
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">
              Inventory & Loss Events
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Boxes className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 block tracking-tight">
              {(stats.inventory + stats.damage).toLocaleString()}
            </span>
            <span className="text-xs mt-1 block text-amber-700 font-medium">
              {stats.damage} damage reports · {stats.inventory} movements
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">
              Authentication & Logins
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Shield className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 block tracking-tight">
              {stats.auth.toLocaleString()}
            </span>
            <span className="text-xs mt-1 block text-emerald-700 font-medium">
              Verified sessions logged
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
          {CATEGORY_TABS.map(tab => {
            const count = tab.id === 'all' ? stats.total : (stats[tab.id] || 0);
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Inputs row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by operator, email, SKU, action, or note..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Date:</span>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Reset Filters */}
          {(searchQuery || filterDate || activeCategory !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDate('');
                setActiveCategory('all');
              }}
              className="h-10 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
            >
              <X size={14} />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Audit Activity Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Activity Feed</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredLogs.length} events
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 whitespace-nowrap">
                  Time
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 whitespace-nowrap">
                  Operator / Actor
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 whitespace-nowrap">
                  Event Category
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200">
                  Activity & Relevant Details
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 whitespace-nowrap">
                  Host & Device
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-center whitespace-nowrap">
                  Inspect
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-400 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-indigo-600" />
                      <span>Loading audit activity log...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-slate-700">No matching audit events</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try clearing filters or search terms</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const { 
                    badgeLabel, badgeClass, ActionIcon, summary, targetLabel, 
                    detailsBadges, cleanIp, deviceInfo 
                  } = log.parsed;

                  const actorName = log.user_name || 'System Operator';
                  const actorEmail = log.user_email || log.user_role || 'system';
                  const actorInitials = actorName
                    .split(' ')
                    .map(w => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'SY';

                  const dateFormatted = new Date(log.created_at).toLocaleDateString('en-MY', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const timeFormatted = new Date(log.created_at).toLocaleTimeString('en-MY', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Column 1: Time */}
                      <td className="px-4 py-3.5 border-b border-slate-100 text-sm whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          <span>{formatRelativeTime(log.created_at)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{dateFormatted}</div>
                        <div className="text-[10px] text-slate-400">{timeFormatted}</div>
                      </td>

                      {/* Column 2: Actor / Operator */}
                      <td className="px-4 py-3.5 border-b border-slate-100 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
                            {actorInitials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">{actorName}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[170px]" title={actorEmail}>
                              {actorEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Category Badge */}
                      <td className="px-4 py-3.5 border-b border-slate-100 text-sm whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeClass}`}>
                          <ActionIcon size={12} />
                          <span>{badgeLabel}</span>
                        </span>
                      </td>

                      {/* Column 4: Meaningful Activity Summary & Relevant Details */}
                      <td className="px-4 py-3.5 border-b border-slate-100 text-sm">
                        <div className="font-medium text-slate-900 text-xs">
                          {summary}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {targetLabel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700">
                              {targetLabel}
                            </span>
                          )}
                          {detailsBadges.map((badge, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-600"
                            >
                              <strong className="text-slate-800">{badge.label}:</strong>
                              <span>{badge.value}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Column 5: Host & Device */}
                      <td className="px-4 py-3.5 border-b border-slate-100 text-sm whitespace-nowrap">
                        <div className="text-xs font-mono text-slate-600 font-medium">
                          {cleanIp}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1" title={log.user_agent}>
                          <Laptop size={11} />
                          <span className="truncate max-w-[130px]">{deviceInfo}</span>
                        </div>
                      </td>

                      {/* Column 6: Inspect Action */}
                      <td className="px-4 py-3.5 border-b border-slate-100 text-center whitespace-nowrap">
                        <button
                          onClick={() => setInspectLog(log)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                          title="Inspect raw details and field diff"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AUDIT RECORD INSPECTION MODAL                                             */}
      {/* ========================================================================= */}
      {inspectLog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 relative my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${inspectLog.parsed.badgeClass}`}>
                    <inspectLog.parsed.ActionIcon size={14} />
                    {inspectLog.parsed.badgeLabel}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Log #{inspectLog.id}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {inspectLog.parsed.summary}
                </h2>
                <p className="text-xs text-slate-400">
                  {new Date(inspectLog.created_at).toLocaleString('en-MY')} ({formatRelativeTime(inspectLog.created_at)})
                </p>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Operator & Machine Profile */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Actor & Network Metadata
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">OPERATOR</span>
                    <span className="font-semibold text-slate-900 block mt-0.5">
                      {inspectLog.user_name || 'System / Unlinked'}
                    </span>
                    <span className="text-slate-500 block text-[11px]">
                      {inspectLog.user_email || inspectLog.user_role}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ORIGIN HOST & IP</span>
                    <span className="font-mono font-semibold text-slate-900 block mt-0.5">
                      {inspectLog.parsed.cleanIp}
                    </span>
                    <span className="text-slate-500 block text-[11px] truncate" title={inspectLog.user_agent}>
                      {inspectLog.parsed.deviceInfo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Entity & Badges */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Target Entity Reference
                </span>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="font-mono text-xs font-semibold text-slate-800">
                    {inspectLog.parsed.targetLabel}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Table: {inspectLog.entity_type || 'N/A'} (ID: {inspectLog.entity_id || 'N/A'})
                  </span>
                </div>
              </div>

              {/* Specific Field Changes Diff */}
              {fieldDiffs.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Field Modifications ({fieldDiffs.length})
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2 text-[10px] font-semibold uppercase text-slate-500">Field</th>
                          <th className="p-2 text-[10px] font-semibold uppercase text-slate-500">Previous Value</th>
                          <th className="p-2 text-[10px] font-semibold uppercase text-slate-500">Updated Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fieldDiffs.map((diff, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-medium text-slate-700">{diff.key}</td>
                            <td className="p-2 font-mono text-rose-600 line-through">
                              {diff.oldVal === null || diff.oldVal === undefined ? 'null' : String(diff.oldVal)}
                            </td>
                            <td className="p-2 font-mono font-bold text-emerald-700">
                              {diff.newVal === null || diff.newVal === undefined ? 'null' : String(diff.newVal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Technical JSON Payload (Collapsible) */}
              <details className="border border-slate-200 rounded-xl p-3 bg-slate-50 group">
                <summary className="font-semibold text-slate-700 cursor-pointer select-none text-[11px] flex items-center justify-between">
                  <span>View Technical JSON Payload</span>
                  <span className="text-slate-400 text-[10px]">Click to toggle</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                  {inspectLog.new_values && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">NEW VALUES:</span>
                      <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed">
                        {JSON.stringify(inspectLog.parsed.newData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {inspectLog.old_values && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">OLD VALUES:</span>
                      <pre className="p-2 bg-slate-900 text-rose-300 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed">
                        {JSON.stringify(inspectLog.parsed.oldData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectLog(null)}
                className="h-9 px-4 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
