import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { History, Shield, RefreshCw, User, AlertTriangle, Package, Boxes, LogIn, LogOut, CheckCircle, Laptop, Store, Building2, ShoppingCart, KeyRound } from 'lucide-react';
import {
  Badge, BusinessBranchFilter, Button, Card, FilterBar, Pagination, Input, KpiCard, Modal, PageHeader, SearchInput, Tabs,
  Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';
import { t as tr, locale } from '../../i18n';

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

  if (diffSec < 30) return tr('Just now');
  if (diffSec < 60) return tr('{diffSec}s ago', { diffSec });
  if (diffMin < 60) return tr('{diffMin}m ago', { diffMin });
  if (diffHour < 24) return tr('{diffHour}h ago', { diffHour });
  if (diffDay < 7) return tr('{diffDay}d ago', { diffDay });
  return past.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// Clean IP address
function formatIp(ip) {
  if (!ip) return '127.0.0.1';
  let clean = ip.replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1') return tr('127.0.0.1 (Localhost)');
  return clean;
}

// Parse device / user agent
function parseUserAgent(ua) {
  if (!ua) return tr('Web Browser');
  let browser = tr('Browser');
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
  } catch {}
  try {
    if (log.new_values) {
      newData = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
    }
  } catch {}

  const action = (log.action || '').toUpperCase();
  const rawEntity = (log.entity_type || '').toLowerCase();
  
  let category = 'system'; // 'auth' | 'inventory' | 'damage' | 'catalog' | 'users' | 'stores' | 'system'
  let badgeLabel = action;
  let tone = 'neutral';
  let ActionIcon = Shield;
  let summary = '';
  let targetLabel = '';
  let detailsBadges = [];

  if (action === 'LOGIN') {
    category = 'auth';
    badgeLabel = tr('Sign In');
    tone = 'accent';
    ActionIcon = LogIn;
    const email = newData?.email || log.user_email || '';
    summary = tr('Signed in');
    targetLabel = email ? tr('Account: {email}', { email }) : tr('User #{value}', { value: log.entity_id || log.user_id });
    if (email) detailsBadges.push({ label: tr('User'), value: email });
  } else if (action === 'LOGOUT') {
    category = 'auth';
    badgeLabel = tr('Sign Out');
    tone = 'neutral';
    ActionIcon = LogOut;
    summary = tr('Signed out');
    targetLabel = log.user_name ? `${log.user_name}` : tr('User #{value}', { value: log.entity_id || log.user_id });
  } else if (['CHANGE_PASSWORD', 'RESET_PASSWORD', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_BY_EMAIL'].includes(action)) {
    category = 'auth';
    tone = action === 'PASSWORD_RESET_REQUESTED' ? 'neutral' : 'warning';
    ActionIcon = KeyRound;
    const email = newData?.email || log.user_email || '';
    if (action === 'CHANGE_PASSWORD') { badgeLabel = tr('Password changed'); summary = newData?.after_reset ? tr('Replaced the temporary password with their own') : tr('Changed their own password'); }
    else if (action === 'RESET_PASSWORD') { badgeLabel = tr('Password reset'); summary = tr('HQ set a temporary password for {name}', { name: newData?.full_name || email || tr('a user') }); }
    else if (action === 'PASSWORD_RESET_REQUESTED') { badgeLabel = tr('Reset code sent'); summary = tr('Asked for a password reset code by email'); }
    else { badgeLabel = tr('Password reset'); summary = tr('Reset the password with an emailed code'); }
    targetLabel = email ? tr('Account: {email}', { email }) : tr('User #{value}', { value: log.entity_id || log.user_id });
  } else if (action === 'CREATE_DAMAGE_REPORT') {
    category = 'damage';
    badgeLabel = tr('Damage Logged');
    tone = 'danger';
    ActionIcon = AlertTriangle;
    const sku = newData?.sku || '';
    const qty = newData?.quantity || 1;
    const totalVal = newData?.total_value ? `RM ${parseFloat(newData.total_value).toFixed(2)}` : '';
    const reason = newData?.reason_category ? newData.reason_category.replace(/_/g, ' ') : '';
    summary = tr('Reported {qty} damaged units for SKU: {sku}', { qty, sku: sku || tr('Product #{id}', { id: newData?.product_id }) });
    targetLabel = tr('Damage Report #DR-{entity_id}', { entity_id: log.entity_id });
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
    if (qty) detailsBadges.push({ label: tr('Quantity'), value: `-${qty} units` });
    if (totalVal) detailsBadges.push({ label: tr('Loss'), value: totalVal });
    if (reason) detailsBadges.push({ label: tr('Reason'), value: reason });
  } else if (action === 'CREATE_ITEM') {
    category = 'catalog';
    badgeLabel = tr('Product Created');
    tone = 'success';
    ActionIcon = Package;
    const name = newData?.name || newData?.item_name || '';
    const sku = newData?.sku || newData?.item_code || '';
    summary = tr('Added new item “{name}” to catalog', { name: name || tr('Product') });
    targetLabel = sku ? tr('SKU: {sku}', { sku }) : tr('Product #{entity_id}', { entity_id: log.entity_id });
    if (name) detailsBadges.push({ label: tr('Item'), value: name });
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
    if (newData?.category) detailsBadges.push({ label: tr('Category'), value: newData.category });
  } else if (action === 'UPDATE_ITEM') {
    category = 'catalog';
    badgeLabel = tr('Product Edited');
    tone = 'warning';
    ActionIcon = Package;
    const name = newData?.item_name || newData?.name || oldData?.name || oldData?.item_name || '';
    const sku = oldData?.sku || oldData?.item_code || '';
    summary = tr('Updated catalog details for “{name}”', { name: name || tr('Product') });
    targetLabel = sku ? tr('SKU: {sku}', { sku }) : tr('Product #{entity_id}', { entity_id: log.entity_id });
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
    if (newData?.status) detailsBadges.push({ label: tr('Status'), value: newData.status });
    if (newData?.selling_price) detailsBadges.push({ label: tr('Price'), value: `RM ${parseFloat(newData.selling_price).toFixed(2)}` });
  } else if (action === 'DELETE_ITEM') {
    category = 'catalog';
    badgeLabel = tr('Product Deleted');
    tone = 'danger';
    ActionIcon = Package;
    const name = oldData?.name || oldData?.item_name || '';
    const sku = oldData?.sku || oldData?.item_code || '';
    summary = tr('Permanently removed “{name}” from catalog', { name: name || tr('Product') });
    targetLabel = sku ? tr('SKU: {sku}', { sku }) : tr('Product #{entity_id}', { entity_id: log.entity_id });
    if (name) detailsBadges.push({ label: tr('Item'), value: name });
    if (sku) detailsBadges.push({ label: 'SKU', value: sku });
  } else if (action === 'STOCK_IN') {
    category = 'inventory';
    badgeLabel = tr('Stock Inward');
    tone = 'success';
    ActionIcon = Boxes;
    summary = tr('Restocked inventory balance');
    targetLabel = tr('Item #{entity_id}', { entity_id: log.entity_id });
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: tr('Balance'), value: tr('{from} → {to} units', { from: oldData.old_qty, to: newData.new_qty }) });
    }
  } else if (action === 'STOCK_OUT' || action === 'QR_SCAN_DEDUCT') {
    category = 'inventory';
    badgeLabel = action === 'QR_SCAN_DEDUCT' ? tr('QR Stock Out') : tr('Stock Out');
    tone = 'info';
    ActionIcon = Boxes;
    summary = action === 'QR_SCAN_DEDUCT' 
      ? tr('Stocked out inventory via QR scanner scan')
      : tr('Stocked out items for order fulfillment or sale');
    targetLabel = tr('Item #{entity_id}', { entity_id: log.entity_id });
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: tr('Balance'), value: tr('{from} → {to} units', { from: oldData.old_qty, to: newData.new_qty }) });
    }
  } else if (action.includes('STOCK_ADJUST') || action === 'STOCK_ADJUSTMENT') {
    category = 'inventory';
    badgeLabel = tr('Stock Adjusted');
    tone = 'violet';
    ActionIcon = Boxes;
    summary = tr('Manual stock count adjustment recorded');
    targetLabel = tr('Item #{entity_id}', { entity_id: log.entity_id });
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: tr('Adjustment'), value: tr('{from} → {to} units', { from: oldData.old_qty, to: newData.new_qty }) });
    }
  } else if (action === 'APPROVE_USER' || action === 'USER_APPROVAL') {
    category = 'users';
    badgeLabel = tr('User Approved');
    tone = 'success';
    ActionIcon = CheckCircle;
    summary = tr('Approved operator registration and granted system access');
    targetLabel = tr('User #{entity_id}', { entity_id: log.entity_id });
  } else if (action === 'REJECT_USER' || action === 'USER_REJECTION') {
    category = 'users';
    badgeLabel = tr('User Declined');
    tone = 'danger';
    ActionIcon = User;
    summary = tr('Declined pending user registration request');
    targetLabel = tr('User #{entity_id}', { entity_id: log.entity_id });
  } else if (action === 'DELETE_USER') {
    category = 'users';
    badgeLabel = tr('User Removed');
    tone = 'danger';
    ActionIcon = User;
    const name = oldData?.full_name || '';
    const email = oldData?.email || '';
    summary = tr('Deactivated user account {value}', { value: name ? `"${name}"` : '' });
    targetLabel = email ? email : tr('User #{entity_id}', { entity_id: log.entity_id });
    if (name) detailsBadges.push({ label: tr('Name'), value: name });
    if (email) detailsBadges.push({ label: tr('Email'), value: email });
  } else if (action === 'USER_SUSPENDED') {
    category = 'users';
    badgeLabel = tr('User Suspended');
    tone = 'warning';
    ActionIcon = User;
    summary = tr('Suspended user account access');
    targetLabel = tr('User #{entity_id}', { entity_id: log.entity_id });
  } else if (action === 'USER_ACTIVATED') {
    category = 'users';
    badgeLabel = tr('User Activated');
    tone = 'success';
    ActionIcon = CheckCircle;
    summary = tr('Reactivated suspended user account');
    targetLabel = tr('User #{entity_id}', { entity_id: log.entity_id });
  } else if (action === 'CREATE_USER') {
    category = 'users';
    badgeLabel = tr('User Created');
    tone = 'accent';
    ActionIcon = User;
    const name = newData?.full_name || '';
    const email = newData?.email || '';
    summary = tr('Created user account for {value}', { value: name || email || 'operator' });
    targetLabel = email ? email : tr('User #{entity_id}', { entity_id: log.entity_id });
    if (email) detailsBadges.push({ label: tr('Email'), value: email });
    if (newData?.role) detailsBadges.push({ label: tr('Role'), value: newData.role });
  } else if (action === 'POS_SALE_TRANSACTION' || action === 'POS_STOCK_IN_TRANSACTION') {
    const sale = action === 'POS_SALE_TRANSACTION';
    category = 'inventory';
    badgeLabel = sale ? tr('POS sale') : tr('POS restock');
    tone = sale ? 'info' : 'success';
    ActionIcon = sale ? ShoppingCart : Boxes;
    const units = oldData?.total_quantity;
    summary = sale
      ? (units == null ? tr('Sold items at the point of sale') : tr('Sold {units} {units|item|items} at the point of sale', { units }))
      : (units == null ? tr('Received stock at the point of sale') : tr('Received {units} {units|unit|units} at the point of sale', { units }));
    targetLabel = newData?.receipt_no ? tr('Receipt {receipt_no}', { receipt_no: newData.receipt_no }) : '';
    if (sale && newData?.grand_total !== undefined) detailsBadges.push({ label: tr('Total'), value: `RM ${parseFloat(newData.grand_total).toFixed(2)}` });
    if (sale && newData?.payment_method) detailsBadges.push({ label: tr('Paid'), value: newData.payment_method.replace('_', ' ') });
    if (sale && newData?.price_tier && newData.price_tier !== 'customer') detailsBadges.push({ label: tr('Price type'), value: newData.price_tier });
  } else if (action.includes('STORE')) {
    category = 'stores';
    badgeLabel = action.replace(/_/g, ' ');
    tone = 'violet';
    ActionIcon = Store;
    summary = tr('Updated pop-up store or event outlet details');
    targetLabel = tr('Store #{entity_id}', { entity_id: log.entity_id });
  } else if (action.includes('BRANCH')) {
    category = 'branches';
    badgeLabel = action.replace(/_/g, ' ');
    tone = 'info';
    ActionIcon = Building2;
    summary = tr('Updated branch warehouse configuration');
    targetLabel = tr('Branch #{entity_id}', { entity_id: log.entity_id });
  } else {
    summary = log.action ? log.action.replace(/_/g, ' ') : tr('System event');
    targetLabel = rawEntity ? `${rawEntity} #${log.entity_id || ''}` : tr('System');
  }

  return {
    category,
    badgeLabel,
    tone,
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
  { id: 'all', label: tr('All activity') },
  { id: 'auth', label: tr('Sign-ins') },
  { id: 'damage', label: tr('Damage') },
  { id: 'inventory', label: tr('Stock') },
  { id: 'catalog', label: tr('Products') },
  { id: 'users', label: tr('Users') }
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    api.get('/businesses').then(res => { if (res.data.success) setBusinesses(res.data.businesses || res.data.data || []); }).catch(() => {});
    api.get('/branches').then(res => { if (res.data.success) setBranches(res.data.branches || res.data.data || []); }).catch(() => {});
  }, []);
  
  // Inspect Modal State
  const [inspectLog, setInspectLog] = useState(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (businessId) params.business_id = businessId;
      if (branchId) params.branch_id = branchId;
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
      setLoadError(err.response?.data?.message || tr('Could not load the activity log.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, filterDate, businessId, branchId]);

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

  // Show 50 events at a time: drawing hundreds of rich rows at once made the page slow to open
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [activeCategory, searchQuery, filterDate, businessId, branchId]);
  const pageLogs = useMemo(() => filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredLogs, page]);

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

  const hasFilters = Boolean(searchQuery || filterDate || businessId || branchId || activeCategory !== 'all');
  const resetFilters = () => { setSearchQuery(''); setFilterDate(''); setBusinessId(''); setBranchId(''); setActiveCategory('all'); };
  const firstLoad = loading && logs.length === 0;

  return (
    <Layout>
      <PageHeader
        title={tr('Activity log')}
        description={tr('A permanent record of sign-ins, stock changes, damage reports and admin actions.')}
        actions={<Button variant="secondary" icon={RefreshCw} onClick={fetchAuditLogs} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>{tr('Refresh')}</Button>}
      />

      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={firstLoad} label={tr('Activities')} value={stats.total} icon={History} tone="accent" meta={tr('In the current view')} />
        <KpiCard loading={firstLoad} label={tr('Stock and damage')} value={stats.inventory + stats.damage} icon={Boxes} tone="warning" meta={tr('{damage} damage · {inventory} stock', { damage: stats.damage, inventory: stats.inventory })} />
        <KpiCard loading={firstLoad} label={tr('Sign-ins and sign-outs')} value={stats.auth} icon={Shield} tone="success" meta={tr('Account sessions')} />
      </div>

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <SearchInput wrapperClassName="md:flex-1 md:min-w-[16rem]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={tr('Search by person, email, SKU, action or note…')} aria-label={tr('Search the activity log')} />
        <BusinessBranchFilter
          businesses={businesses}
          branches={branches}
          businessId={businessId}
          branchId={branchId}
          onBusinessChange={id => { setBusinessId(id); setBranchId(''); }}
          onBranchChange={setBranchId}
          businessClassName="md:w-44"
        />
        <Input type="date" className="md:w-44" aria-label={tr('Date')} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-5 pt-3 border-b border-line-soft">
          <Tabs
            label={tr('Event type')}
            value={activeCategory}
            onChange={setActiveCategory}
            className="border-b-0"
            tabs={CATEGORY_TABS.map(t => ({ value: t.id, label: t.label, count: t.id === 'all' ? stats.total : (stats[t.id] || 0) }))}
          />
        </div>
        <Table minWidth="58rem">
          <THead>
            <TR>
              <TH>{tr('When')}</TH>
              <TH>{tr('Who')}</TH>
              <TH>{tr('Event')}</TH>
              <TH>{tr('Details')}</TH>
              <TH>{tr('Device')}</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={5}
              loading={firstLoad}
              error={!loading && loadError && logs.length === 0 ? loadError : null}
              onRetry={fetchAuditLogs}
              empty={!loading && !loadError && filteredLogs.length === 0}
              emptyIcon={History}
              emptyTitle={tr('No matching activity')}
              emptyDescription={tr('Try another date, tab or search.')}
              emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={resetFilters}>{tr('Clear filters')}</Button> : null}
            />
            {pageLogs.map((log, i) => {
              const { badgeLabel, tone, ActionIcon, summary, targetLabel, detailsBadges, cleanIp, deviceInfo } = log.parsed;
              const actorName = log.user_name || tr('System');
              const actorEmail = log.user_email || log.user_role || 'system';
              const initials = actorName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'SY';
              const when = new Date(log.created_at);
              return (
                <TR key={log.id} index={i} onClick={() => setInspectLog(log)}>
                  <TD className="whitespace-nowrap">
                    <div className="text-sm text-ink">{formatRelativeTime(log.created_at)}</div>
                    <div className="text-caption text-ink-muted tabular-nums">
                      {when.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-sunken text-ink-secondary flex items-center justify-center font-semibold text-caption flex-shrink-0">{initials}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink">{actorName}</div>
                        <div className="text-caption text-ink-muted truncate max-w-[10rem]" title={actorEmail}>{actorEmail}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap"><Badge tone={tone} size="sm" icon={ActionIcon}>{badgeLabel}</Badge></TD>
                  <TD className="max-w-[22rem]">
                    <div className="text-sm text-ink">{summary}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {targetLabel && <Badge size="sm" className="font-mono">{targetLabel}</Badge>}
                      {detailsBadges.map((badge, idx) => (
                        <Badge key={idx} size="sm"><span className="text-ink-muted">{badge.label}:</span>{badge.value}</Badge>
                      ))}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <div className="text-caption font-mono text-ink-secondary">{cleanIp}</div>
                    <div className="text-caption text-ink-muted flex items-center gap-1" title={log.user_agent}>
                      <Laptop className="w-3 h-3" aria-hidden="true" /><span className="truncate max-w-[8rem]">{deviceInfo}</span>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <Pagination
          page={Math.min(page, totalPages)}
          totalPages={totalPages}
          onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          prevLabel={tr('Newer')}
          nextLabel={tr('Older')}
          summary={filteredLogs.length ? tr('{n} {n|activity|activities}', { n: filteredLogs.length }) : undefined}
        />
      </Card>

      {inspectLog && (
        <Modal
          size="lg"
          icon={inspectLog.parsed.ActionIcon}
          title={inspectLog.parsed.summary}
          description={<>{new Date(inspectLog.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' })} · {formatRelativeTime(inspectLog.created_at)} · <span className="font-mono">{tr('Log #{id}', { id: inspectLog.id })}</span></>}
          onClose={() => setInspectLog(null)}
          footer={<Button variant="secondary" onClick={() => setInspectLog(null)}>{tr('Close')}</Button>}
        >
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={inspectLog.parsed.tone} icon={inspectLog.parsed.ActionIcon}>{inspectLog.parsed.badgeLabel}</Badge>
            {inspectLog.parsed.targetLabel && <Badge className="font-mono">{inspectLog.parsed.targetLabel}</Badge>}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-subtle rounded-lg">
              <dt className="text-caption text-ink-muted">{tr('Done by')}</dt>
              <dd className="font-medium text-ink mt-0.5">{inspectLog.user_name || tr('System')}</dd>
              <dd className="text-caption text-ink-muted">{inspectLog.user_email || inspectLog.user_role}</dd>
            </div>
            <div className="p-3 bg-subtle rounded-lg">
              <dt className="text-caption text-ink-muted">{tr('From')}</dt>
              <dd className="font-mono font-medium text-ink mt-0.5">{inspectLog.parsed.cleanIp}</dd>
              <dd className="text-caption text-ink-muted truncate" title={inspectLog.user_agent}>{inspectLog.parsed.deviceInfo}</dd>
            </div>
            <div className="p-3 bg-subtle rounded-lg sm:col-span-2">
              <dt className="text-caption text-ink-muted">{tr('Record')}</dt>
              <dd className="font-mono text-caption text-ink mt-0.5">{inspectLog.entity_type || 'N/A'}{' '}{tr('· ID')}{' '}{inspectLog.entity_id || 'N/A'}</dd>
            </div>
          </dl>

          {fieldDiffs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-2">{tr('What changed')}{' '}<span className="text-ink-muted font-normal tabular-nums">({fieldDiffs.length})</span></h3>
              <div className="border border-line rounded-lg overflow-hidden">
                <Table dense>
                  <THead><TR><TH>{tr('Field')}</TH><TH>{tr('Before')}</TH><TH>{tr('After')}</TH></TR></THead>
                  <TBody>
                    {fieldDiffs.map((diff, i) => (
                      <TR key={i}>
                        <TD className="font-mono text-caption text-ink-secondary">{diff.key}</TD>
                        <TD className="font-mono text-caption text-danger-fg line-through break-all">{diff.oldVal === null || diff.oldVal === undefined ? 'null' : String(diff.oldVal)}</TD>
                        <TD className="font-mono text-caption font-semibold text-success-fg break-all">{diff.newVal === null || diff.newVal === undefined ? 'null' : String(diff.newVal)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </section>
          )}

          <details className="border border-line rounded-lg bg-subtle group">
            <summary className="px-3 py-2.5 text-sm font-medium text-ink-secondary cursor-pointer select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
              {tr('Raw data (JSON)')}
            </summary>
            <div className="px-3 pb-3 space-y-2">
              {inspectLog.new_values && (
                <div>
                  <p className="text-caption text-ink-muted mb-1">{tr('New values')}</p>
                  <pre className="p-3 bg-ink text-white/90 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">{JSON.stringify(inspectLog.parsed.newData, null, 2)}</pre>
                </div>
              )}
              {inspectLog.old_values && (
                <div>
                  <p className="text-caption text-ink-muted mb-1">{tr('Old values')}</p>
                  <pre className="p-3 bg-ink text-white/70 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">{JSON.stringify(inspectLog.parsed.oldData, null, 2)}</pre>
                </div>
              )}
            </div>
          </details>
        </Modal>
      )}
    </Layout>
  );
}
