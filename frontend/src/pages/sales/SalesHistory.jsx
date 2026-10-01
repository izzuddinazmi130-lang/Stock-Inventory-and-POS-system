import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useSocket } from '../../context/SocketContext';
import { SaleReceipt, ReceiptModal, PAYMENT_LABELS, rm, formatDateTime } from '../../components/pos/Receipt';
import { Receipt, ScanLine, TrendingUp, Package, ShoppingBag, Banknote, QrCode, CreditCard } from 'lucide-react';
import {
  Button, Card, CardHeader, FilterBar, Input, KpiCard, PageHeader, Pagination, SearchInput, SegmentedControl, Select, Spinner,
  StatusPill, Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';


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

  const firstLoad = loading && sales.length === 0;
  const hasFilters = Boolean(search || payment || businessId || branchId || period !== 'today');
  const resetFilters = () => { setSearchInput(''); setPayment(''); setBusinessId(''); setBranchId(''); setPeriod('today'); setPage(1); };

  return (
    <Layout>
      <PageHeader
        title="Sales history"
        description="Every sale from the point of sale, with its receipt. Open a sale to view or reprint the receipt."
        actions={!isSuperAdmin && <Button icon={ScanLine} to="/qr/scan">Open point of sale</Button>}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <SegmentedControl label="Period" value={period} onChange={changeFilter(setPeriod)} tabs={PERIODS} className="max-w-full overflow-x-auto" />
        {period === 'custom' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Input type="date" size="sm" value={customFrom} max={customTo} onChange={e => changeFilter(setCustomFrom)(e.target.value)} aria-label="From date" />
            <span className="text-caption text-ink-muted">to</span>
            <Input type="date" size="sm" value={customTo} min={customFrom} onChange={e => changeFilter(setCustomTo)(e.target.value)} aria-label="To date" />
          </div>
        )}
      </div>

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <KpiCard loading={firstLoad} label="Sales" value={summary ? summary.sales_count : 0} icon={Receipt} tone="accent" meta={rangeLabel} />
        <KpiCard loading={firstLoad} label="Revenue" value={summary ? summary.revenue : 0} format={rm} icon={TrendingUp} tone="success" meta="Total charged" />
        <KpiCard loading={firstLoad} label="Average sale" value={summary ? summary.average : 0} format={rm} icon={ShoppingBag} tone="neutral" meta="Per receipt" />
        <KpiCard loading={firstLoad} label="Units sold" value={summary ? summary.units : 0} icon={Package} tone="neutral" meta="All items" />
      </div>
      {summary && summary.revenue > 0 && <PaymentSplit byPayment={summary.by_payment} total={summary.revenue} />}

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <SearchInput
          wrapperClassName="md:flex-1 md:min-w-[16rem]"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by receipt number, product, SKU or note…"
          aria-label="Search sales"
        />
        <Select wrapperClassName="md:w-44" aria-label="Payment method" value={payment} onChange={e => changeFilter(setPayment)(e.target.value)}>
          <option value="">All payments</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        {isSuperAdmin && (
          <>
            <Select wrapperClassName="md:w-44" aria-label="Business" value={businessId} onChange={e => { changeFilter(setBusinessId)(e.target.value); setBranchId(''); }}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select wrapperClassName="md:w-44" aria-label="Branch" value={branchId} onChange={e => changeFilter(setBranchId)(e.target.value)}>
              <option value="">All branches</option>
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </>
        )}
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader title="Receipts" description={firstLoad ? 'Loading…' : `${summary?.sales_count ?? sales.length} ${(summary?.sales_count ?? sales.length) === 1 ? 'sale' : 'sales'}`} />
        <Table minWidth={isSuperAdmin ? '60rem' : '52rem'}>
          <THead>
            <TR>
              <TH>Receipt</TH>
              <TH>When</TH>
              <TH>Items</TH>
              <TH>Payment</TH>
              {isSuperAdmin && <TH>Branch</TH>}
              <TH>Served by</TH>
              <TH numeric>Total</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={isSuperAdmin ? 7 : 6}
              loading={firstLoad}
              error={!loading && error && sales.length === 0 ? error : null}
              onRetry={load}
              empty={!loading && !error && sales.length === 0}
              emptyIcon={Receipt}
              emptyTitle="No sales found"
              emptyDescription="Try another period or clear the search."
              emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={resetFilters}>Clear filters</Button> : null}
            />
            {sales.map((s, i) => {
              const preview = s.items_preview || [];
              return (
                <TR key={s.id} index={i} onClick={() => openReceipt(s.id)}>
                  <TD className="whitespace-nowrap">
                    <span className="font-mono text-caption font-semibold text-accent">{s.receipt_no}</span>
                    {openingId === s.id && <Spinner className="w-3 h-3 ml-1.5 text-ink-muted" />}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-secondary">{formatDateTime(s.created_at)}</TD>
                  <TD className="max-w-xs">
                    <p className="truncate text-ink">{preview[0] || '—'}</p>
                    {preview.length > 1 && <p className="text-caption text-ink-muted">+ {preview.length - 1} more</p>}
                  </TD>
                  <TD><StatusPill kind="payment" value={s.payment_method} size="sm" /></TD>
                  {isSuperAdmin && <TD className="whitespace-nowrap text-ink-secondary">{s.branch_name}</TD>}
                  <TD className="whitespace-nowrap text-ink-secondary">{s.cashier_name || '—'}</TD>
                  <TD numeric className="font-semibold">{rm(s.total_amount)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} prevLabel="Newer" nextLabel="Older" />
      </Card>

      {openSale && (
        <ReceiptModal onClose={() => setOpenSale(null)} closeLabel="Close" closeVariant="secondary">
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

// One bar showing how the money came in
function PaymentSplit({ byPayment, total }) {
  const parts = [
    { key: 'cash', color: 'bg-success', icon: Banknote },
    { key: 'qr', color: 'bg-accent', icon: QrCode },
    { key: 'online_banking', color: 'bg-warning', icon: CreditCard },
  ];
  return (
    <Card className="px-4 py-3 mb-4">
      <div className="flex h-2 rounded-full overflow-hidden bg-sunken" role="img" aria-label="Revenue by payment method">
        {parts.map(p => byPayment[p.key] > 0 && (
          <div key={p.key} className={`${p.color} transition-[width] duration-slow ease-out`} style={{ width: `${(byPayment[p.key] / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-secondary">
        {parts.map(p => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${p.color}`} aria-hidden="true" />
            {PAYMENT_LABELS[p.key]} <strong className="font-semibold text-ink tabular-nums">{rm(byPayment[p.key])}</strong>
          </span>
        ))}
      </div>
    </Card>
  );
}
