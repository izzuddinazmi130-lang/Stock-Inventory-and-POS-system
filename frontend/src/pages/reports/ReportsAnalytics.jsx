import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { History, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import {
  Button, Card, CardHeader, FilterBar, KpiCard, PageHeader, ScopeBadge, SegmentedControl, Select, StatusPill,
  Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../components/ui';

const TIMELINE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 days' },
  { value: '30days', label: '30 days' },
  { value: '90days', label: '90 days' },
];

const TIMELINE_LABELS = {
  all: 'All time',
  today: 'Today',
  '7days': 'Last 7 days',
  '30days': 'Last 30 days',
  '90days': 'Last 90 days'
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
  const { user } = useAuth();
  // Branch admins are locked to their own business + branch (enforced server-side too);
  // business_id / branch_id URL params are ignored for them.
  const isScopedAdmin = user?.role !== 'super_admin';

  const queryBusinessId = isScopedAdmin ? '' : (searchParams.get('business_id') || '');
  const queryBranchId = isScopedAdmin ? '' : (searchParams.get('branch_id') || '');
  const queryStoreId = searchParams.get('store_id') || '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({
    total_transactions: 0,
    stock_in_qty: 0,
    stock_out_qty: 0,
    adjust_qty: 0,
    damaged_qty: 0,
    damaged_count: 0
  });

  // Filter state (for a branch admin, business/branch are fixed to their own)
  const [businessId, setBusinessId] = useState(queryBusinessId);
  const [branchId, setBranchId] = useState(queryBranchId);
  const storeBranchId = isScopedAdmin ? (user?.branch_id ? String(user.branch_id) : '') : branchId;
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

  // Fetch businesses on mount (super admin only)
  useEffect(() => {
    if (isScopedAdmin) return;
    api.get('/businesses').then(res => {
      if (res.data.success) {
        setBusinesses(res.data.businesses || res.data.data || []);
      }
    }).catch(() => {});
  }, [isScopedAdmin]);

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

  // Fetch stores when the (effective) branch changes
  useEffect(() => {
    if (storeBranchId) {
      api.get(`/branches/${storeBranchId}/stores`).then(res => {
        if (res.data.success) {
          setStores(res.data.stores || res.data.data || []);
        }
      }).catch(() => {});
    } else {
      setStores([]);
    }
  }, [storeBranchId]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const { startDate, endDate } = getDateRangeParams(dateRange);
      
      let queryParams = `movement_type=${movementType}`;
      if (!isScopedAdmin && businessId) queryParams += `&business_id=${businessId}`;
      if (!isScopedAdmin && branchId) queryParams += `&branch_id=${branchId}`;
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
      setLoadError(err.response?.data?.message || 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  }, [isScopedAdmin, businessId, branchId, storeId, movementType, dateRange]);

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

  const hasActiveFilters = Boolean(businessId || branchId || storeId || movementType !== 'all' || dateRange !== 'all');
  const period = TIMELINE_LABELS[dateRange] || 'All time';
  const firstLoad = loading && movements.length === 0;

  return (
    <Layout>
      <PageHeader
        title="Reports"
        description="Stock movements and write-offs over time, for any business, branch or pop-up store."
        meta={isScopedAdmin ? <ScopeBadge /> : null}
        actions={<Button variant="secondary" icon={RefreshCw} onClick={fetchReports} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-ink">Summary · <span className="font-normal text-ink-muted">{period}</span></h2>
        <SegmentedControl label="Time period" value={dateRange} onChange={setDateRange} tabs={TIMELINE_OPTIONS} className="max-w-full overflow-x-auto" />
      </div>

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={firstLoad} label="Transactions" value={Number(summary.total_transactions) || 0} icon={Activity} tone="accent" meta="Movement records" />
        <KpiCard loading={firstLoad} label="Stock added" value={Number(summary.stock_in_qty) || 0} format={v => `+${Math.round(v).toLocaleString('en-MY')}`} icon={ArrowDownToLine} tone="success" meta="Units in" />
        <KpiCard loading={firstLoad} label="Stock out" value={Number(summary.stock_out_qty) || 0} format={v => `−${Math.round(v).toLocaleString('en-MY')}`} icon={ArrowUpFromLine} tone="info" meta="Units sold or taken out" />
        <KpiCard loading={firstLoad} label="Damaged" value={Number(summary.damaged_qty) || 0} icon={AlertTriangle} tone="danger" meta={`${summary.damaged_count || 0} damage ${Number(summary.damaged_count) === 1 ? 'record' : 'records'}`} />
      </div>

      <FilterBar onReset={handleResetFilters} resetVisible={hasActiveFilters}>
        {!isScopedAdmin && (
          <>
            <Select wrapperClassName="md:w-48" aria-label="Business" value={businessId} onChange={(e) => { setBusinessId(e.target.value); setBranchId(''); setStoreId(''); }}>
              <option value="">All businesses</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select wrapperClassName="md:w-44" aria-label="Branch" value={branchId} onChange={(e) => { setBranchId(e.target.value); setStoreId(''); }} disabled={!businessId && branches.length === 0}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </>
        )}
        <Select wrapperClassName="md:w-44" aria-label="Pop-up store" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={!storeBranchId || stores.length === 0}>
          <option value="">All stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select wrapperClassName="md:w-44" aria-label="Activity type" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
          <option value="all">All activity</option>
          <option value="in">Stock in</option>
          <option value="out">Stock out</option>
          <option value="adjust">Adjustments</option>
          <option value="damage">Damage write-offs</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader
          icon={History}
          title="Movement log"
          description={firstLoad ? 'Loading…' : `${movements.length} ${movements.length === 1 ? 'entry' : 'entries'}`}
        />
        <Table minWidth="60rem">
          <THead>
            <TR>
              <TH>Product</TH>
              <TH>Where</TH>
              <TH>Type</TH>
              <TH numeric>Qty</TH>
              <TH numeric>Stock</TH>
              <TH>By</TH>
              <TH className="text-right">When</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              loading={firstLoad}
              error={!loading && loadError && movements.length === 0 ? loadError : null}
              onRetry={fetchReports}
              empty={!loading && !loadError && movements.length === 0}
              emptyIcon={History}
              emptyTitle="No movements found"
              emptyDescription={hasActiveFilters ? 'Nothing matches these filters. Try a longer time period.' : 'Stock changes will appear here.'}
              emptyAction={hasActiveFilters ? <Button variant="secondary" size="sm" onClick={handleResetFilters}>Clear filters</Button> : null}
            />
            {movements.map((m, i) => (
              <TR key={m.id} index={i}>
                <TD className="max-w-[16rem]">
                  <div className="font-medium text-ink truncate">{m.item_name}</div>
                  <div className="font-mono text-caption text-ink-muted">{m.item_code}</div>
                </TD>
                <TD>
                  <div className="text-sm text-ink whitespace-nowrap">{m.branch_name}</div>
                  <div className="text-caption text-ink-muted whitespace-nowrap">
                    {m.business_name || 'Business'}{m.store_name && <> · <span className="text-warning-fg">{m.store_name}</span></>}
                  </div>
                </TD>
                <TD><StatusPill kind="movement" value={m.movement_type} size="sm" /></TD>
                <TD numeric className={cn('font-semibold', m.movement_type === 'in' ? 'text-success-fg' : m.movement_type === 'adjust' ? 'text-violet-fg' : m.movement_type === 'damage' ? 'text-danger-fg' : 'text-ink')}>
                  {m.movement_type === 'in' ? `+${m.quantity}` : m.movement_type === 'adjust' ? m.quantity : `−${m.quantity}`}
                </TD>
                <TD numeric className="text-caption">
                  <span className="text-ink-muted">{m.qty_before}</span> → <span className="font-semibold text-ink">{m.qty_after}</span>
                </TD>
                <TD>
                  <div className="text-sm text-ink whitespace-nowrap">{m.performed_by_name || 'System'}</div>
                  <div className="text-caption text-ink-muted">{m.performed_by_email || '—'}</div>
                </TD>
                <TD className="text-right text-caption text-ink-muted whitespace-nowrap">
                  {new Date(m.created_at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </Layout>
  );
}
