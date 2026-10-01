import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { History, Shield, RefreshCw, User, AlertTriangle, Package, Boxes, LogIn, LogOut, CheckCircle, Laptop, Store, Building2, ShoppingCart } from 'lucide-react';
import {
  Badge, Button, Card, FilterBar, Input, KpiCard, Modal, PageHeader, SearchInput, Tabs,
  Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';

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
  let tone = 'neutral';
  let ActionIcon = Shield;
  let summary = '';
  let targetLabel = '';
  let detailsBadges = [];

  if (action === 'LOGIN') {
    category = 'auth';
    badgeLabel = 'Sign In';
    tone = 'accent';
    ActionIcon = LogIn;
    const email = newData?.email || log.user_email || '';
    summary = 'Signed in';
    targetLabel = email ? `Account: ${email}` : `User #${log.entity_id || log.user_id}`;
    if (email) detailsBadges.push({ label: 'User', value: email });
  } else if (action === 'LOGOUT') {
    category = 'auth';
    badgeLabel = 'Sign Out';
    tone = 'neutral';
    ActionIcon = LogOut;
    summary = 'Signed out';
    targetLabel = log.user_name ? `${log.user_name}` : `User #${log.entity_id || log.user_id}`;
  } else if (action === 'CREATE_DAMAGE_REPORT') {
    category = 'damage';
    badgeLabel = 'Damage Logged';
    tone = 'danger';
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
    tone = 'success';
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
    tone = 'warning';
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
    tone = 'danger';
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
    tone = 'success';
    ActionIcon = Boxes;
    summary = `Restocked inventory balance`;
    targetLabel = `Item #${log.entity_id}`;
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: 'Balance', value: `${oldData.old_qty} → ${newData.new_qty} units` });
    }
  } else if (action === 'STOCK_OUT' || action === 'QR_SCAN_DEDUCT') {
    category = 'inventory';
    badgeLabel = action === 'QR_SCAN_DEDUCT' ? 'QR Stock Out' : 'Stock Out';
    tone = 'info';
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
    tone = 'violet';
    ActionIcon = Boxes;
    summary = `Manual stock count adjustment recorded`;
    targetLabel = `Item #${log.entity_id}`;
    if (oldData?.old_qty !== undefined && newData?.new_qty !== undefined) {
      detailsBadges.push({ label: 'Adjustment', value: `${oldData.old_qty} → ${newData.new_qty} units` });
    }
  } else if (action === 'APPROVE_USER' || action === 'USER_APPROVAL') {
    category = 'users';
    badgeLabel = 'User Approved';
    tone = 'success';
    ActionIcon = CheckCircle;
    summary = `Approved operator registration and granted system access`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'REJECT_USER' || action === 'USER_REJECTION') {
    category = 'users';
    badgeLabel = 'User Declined';
    tone = 'danger';
    ActionIcon = User;
    summary = `Declined pending user registration request`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'DELETE_USER') {
    category = 'users';
    badgeLabel = 'User Removed';
    tone = 'danger';
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
    tone = 'warning';
    ActionIcon = User;
    summary = `Suspended user account access`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'USER_ACTIVATED') {
    category = 'users';
    badgeLabel = 'User Activated';
    tone = 'success';
    ActionIcon = CheckCircle;
    summary = `Reactivated suspended user account`;
    targetLabel = `User #${log.entity_id}`;
  } else if (action === 'CREATE_USER') {
    category = 'users';
    badgeLabel = 'User Created';
    tone = 'accent';
    ActionIcon = User;
    const name = newData?.full_name || '';
    const email = newData?.email || '';
    summary = `Created user account for ${name || email || 'operator'}`;
    targetLabel = email ? email : `User #${log.entity_id}`;
    if (email) detailsBadges.push({ label: 'Email', value: email });
    if (newData?.role) detailsBadges.push({ label: 'Role', value: newData.role });
  } else if (action === 'POS_SALE_TRANSACTION' || action === 'POS_STOCK_IN_TRANSACTION') {
    const sale = action === 'POS_SALE_TRANSACTION';
    category = 'inventory';
    badgeLabel = sale ? 'POS sale' : 'POS restock';
    tone = sale ? 'info' : 'success';
    ActionIcon = sale ? ShoppingCart : Boxes;
    const units = oldData?.total_quantity;
    summary = sale
      ? `Sold ${units ?? ''} item${units === 1 ? '' : 's'} at the point of sale`.replace('  ', ' ')
      : `Received ${units ?? ''} unit${units === 1 ? '' : 's'} at the point of sale`.replace('  ', ' ');
    targetLabel = newData?.receipt_no ? `Receipt ${newData.receipt_no}` : '';
    if (sale && newData?.grand_total !== undefined) detailsBadges.push({ label: 'Total', value: `RM ${parseFloat(newData.grand_total).toFixed(2)}` });
    if (sale && newData?.payment_method) detailsBadges.push({ label: 'Paid', value: newData.payment_method.replace('_', ' ') });
    if (sale && newData?.price_tier && newData.price_tier !== 'customer') detailsBadges.push({ label: 'Price list', value: newData.price_tier });
  } else if (action.includes('STORE')) {
    category = 'stores';
    badgeLabel = action.replace(/_/g, ' ');
    tone = 'violet';
    ActionIcon = Store;
    summary = `Updated pop-up store or event outlet details`;
    targetLabel = `Store #${log.entity_id}`;
  } else if (action.includes('BRANCH')) {
    category = 'branches';
    badgeLabel = action.replace(/_/g, ' ');
    tone = 'info';
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
  { id: 'all', label: 'All activity' },
  { id: 'auth', label: 'Sign-ins' },
  { id: 'damage', label: 'Damage' },
  { id: 'inventory', label: 'Stock' },
  { id: 'catalog', label: 'Products' },
  { id: 'users', label: 'Users' }
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Inspect Modal State
  const [inspectLog, setInspectLog] = useState(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setLoadError('');
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
      setLoadError(err.response?.data?.message || 'Could not load the audit log.');
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

  const hasFilters = Boolean(searchQuery || filterDate || activeCategory !== 'all');
  const resetFilters = () => { setSearchQuery(''); setFilterDate(''); setActiveCategory('all'); };
  const firstLoad = loading && logs.length === 0;

  return (
    <Layout>
      <PageHeader
        title="Audit log"
        description="A permanent record of sign-ins, stock changes, damage reports and admin actions."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={fetchAuditLogs} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>}
      />

      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={firstLoad} label="Events" value={stats.total} icon={History} tone="accent" meta="In the current view" />
        <KpiCard loading={firstLoad} label="Stock and damage" value={stats.inventory + stats.damage} icon={Boxes} tone="warning" meta={`${stats.damage} damage · ${stats.inventory} stock`} />
        <KpiCard loading={firstLoad} label="Sign-ins and sign-outs" value={stats.auth} icon={Shield} tone="success" meta="Account sessions" />
      </div>

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <SearchInput wrapperClassName="md:flex-1 md:min-w-[16rem]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by person, email, SKU, action or note…" aria-label="Search the audit log" />
        <Input type="date" className="md:w-44" aria-label="Date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-5 pt-3 border-b border-line-soft">
          <Tabs
            label="Event type"
            value={activeCategory}
            onChange={setActiveCategory}
            className="border-b-0"
            tabs={CATEGORY_TABS.map(t => ({ value: t.id, label: t.label, count: t.id === 'all' ? stats.total : (stats[t.id] || 0) }))}
          />
        </div>
        <Table minWidth="58rem">
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>Event</TH>
              <TH>Details</TH>
              <TH>Device</TH>
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
              emptyTitle="No matching events"
              emptyDescription="Try another date, tab or search."
              emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={resetFilters}>Clear filters</Button> : null}
            />
            {filteredLogs.map((log, i) => {
              const { badgeLabel, tone, ActionIcon, summary, targetLabel, detailsBadges, cleanIp, deviceInfo } = log.parsed;
              const actorName = log.user_name || 'System';
              const actorEmail = log.user_email || log.user_role || 'system';
              const initials = actorName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'SY';
              const when = new Date(log.created_at);
              return (
                <TR key={log.id} index={i} onClick={() => setInspectLog(log)}>
                  <TD className="whitespace-nowrap">
                    <div className="text-sm text-ink">{formatRelativeTime(log.created_at)}</div>
                    <div className="text-caption text-ink-muted tabular-nums">
                      {when.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} · {when.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
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
      </Card>

      {inspectLog && (
        <Modal
          size="lg"
          icon={inspectLog.parsed.ActionIcon}
          title={inspectLog.parsed.summary}
          description={<>{new Date(inspectLog.created_at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'medium' })} · {formatRelativeTime(inspectLog.created_at)} · <span className="font-mono">Log #{inspectLog.id}</span></>}
          onClose={() => setInspectLog(null)}
          footer={<Button variant="secondary" onClick={() => setInspectLog(null)}>Close</Button>}
        >
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={inspectLog.parsed.tone} icon={inspectLog.parsed.ActionIcon}>{inspectLog.parsed.badgeLabel}</Badge>
            {inspectLog.parsed.targetLabel && <Badge className="font-mono">{inspectLog.parsed.targetLabel}</Badge>}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-subtle rounded-lg">
              <dt className="text-caption text-ink-muted">Done by</dt>
              <dd className="font-medium text-ink mt-0.5">{inspectLog.user_name || 'System'}</dd>
              <dd className="text-caption text-ink-muted">{inspectLog.user_email || inspectLog.user_role}</dd>
            </div>
            <div className="p-3 bg-subtle rounded-lg">
              <dt className="text-caption text-ink-muted">From</dt>
              <dd className="font-mono font-medium text-ink mt-0.5">{inspectLog.parsed.cleanIp}</dd>
              <dd className="text-caption text-ink-muted truncate" title={inspectLog.user_agent}>{inspectLog.parsed.deviceInfo}</dd>
            </div>
            <div className="p-3 bg-subtle rounded-lg sm:col-span-2">
              <dt className="text-caption text-ink-muted">Record</dt>
              <dd className="font-mono text-caption text-ink mt-0.5">{inspectLog.entity_type || 'N/A'} · ID {inspectLog.entity_id || 'N/A'}</dd>
            </div>
          </dl>

          {fieldDiffs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-2">What changed <span className="text-ink-muted font-normal tabular-nums">({fieldDiffs.length})</span></h3>
              <div className="border border-line rounded-lg overflow-hidden">
                <Table dense>
                  <THead><TR><TH>Field</TH><TH>Before</TH><TH>After</TH></TR></THead>
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
              Raw data (JSON)
            </summary>
            <div className="px-3 pb-3 space-y-2">
              {inspectLog.new_values && (
                <div>
                  <p className="text-caption text-ink-muted mb-1">New values</p>
                  <pre className="p-3 bg-ink text-white/90 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">{JSON.stringify(inspectLog.parsed.newData, null, 2)}</pre>
                </div>
              )}
              {inspectLog.old_values && (
                <div>
                  <p className="text-caption text-ink-muted mb-1">Old values</p>
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
