import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useSocket } from '../../context/SocketContext';
import { SaleReceipt, ReceiptModal, PAYMENT_LABELS, rm, formatDateTime } from '../../components/pos/Receipt';
import DayInsights, { DayDelta } from './DayInsights';
import { Receipt, ScanLine, TrendingUp, Package, ShoppingBag, Banknote, QrCode, CreditCard, Store, Building2, MapPin, ChevronRight, Globe, ArrowLeftRight } from 'lucide-react';
import {
  Badge, BusinessDot, Button, ButtonBase, Card, CardHeader, FilterBar, Input, KpiCard, PageHeader, Pagination, SearchInput, SegmentedControl, Select, Spinner,
  StatusPill, Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../components/ui';
import { t as tr, locale } from '../../i18n';

// Where a sale was rung up: the branch counter ("Shop floor") or a pop-up store
function locationLabel(row) {
  if (row.store_id == null) return tr('Branch counter');
  return row.store_name || tr('Pop-up store #{store_id} (deleted)', { store_id: row.store_id });
}

function LocationBadge({ row }) {
  const popUp = row.store_id != null;
  return (
    <Badge size="sm" tone={popUp ? 'accent' : 'neutral'} icon={popUp ? Store : Building2} className="max-w-full">
      <span className="truncate">{locationLabel(row)}</span>
    </Badge>
  );
}


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
  { value: 'today', label: tr('Today') },
  { value: 'yesterday', label: tr('Yesterday') },
  { value: '7d', label: tr('Last 7 days') },
  { value: 'month', label: tr('This month') },
  { value: 'all', label: tr('All time') },
  { value: 'custom', label: tr('Custom') },
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
  // Head office picks what to look at first (all / a business / a branch); kept in the URL so refresh keeps it
  const [searchParams, setSearchParams] = useSearchParams();
  const businessId = isSuperAdmin ? (searchParams.get('business') || '') : '';
  const branchId = isSuperAdmin ? (searchParams.get('branch') || '') : '';
  const scopeChosen = !isSuperAdmin || searchParams.has('view');
  const setScope = ({ business = '', branch = '' } = {}) => {
    const next = new URLSearchParams();
    next.set('view', '1');
    if (business) next.set('business', String(business));
    if (branch) next.set('branch', String(branch));
    setSearchParams(next);
    setLocation('');
    setPage(1);
  };
  const changeScope = () => { setSearchParams(new URLSearchParams()); setLocation(''); setPage(1); };
  const [location, setLocation] = useState(''); // '' all, 'floor' shop floor, or a pop-up store id
  const [byLocation, setByLocation] = useState([]);
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);

  // Data
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSale, setOpenSale] = useState(null);
  const liveRef = useRef(false);
  const shownIdsRef = useRef([]);
  const freshTimer = useRef(null);
  const [freshIds, setFreshIds] = useState(new Set());
  const [openingId, setOpeningId] = useState(null);

  const range = period === 'custom' ? { from: customFrom, to: customTo } : periodRange(period);
  // One whole day with no narrowing filters: also show sales by hour, best sellers, branches and the day before
  const singleDay = (period === 'today' || period === 'yesterday') && !location && !payment && !search;
  const [dayData, setDayData] = useState(null);
  const onDayData = useCallback((d) => setDayData(d), []);
  const compare = singleDay ? dayData : null;

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/branches').then(res => { if (res.data.success) setBranches(res.data.branches || []); }).catch(() => {});
  }, [isSuperAdmin]);

  const scopeBusiness = businesses.find(b => String(b.id) === String(businessId));
  const scopeBranch = branches.find(b => String(b.id) === String(branchId));
  const businessBranches = useMemo(
    () => branches.filter(b => String(b.business_id) === String(businessId)),
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
      if (location) params.store_id = location;
      const res = await api.get('/sales', { params });
      if (res.data.success) {
        const list = res.data.sales || [];
        // A sale that arrived live glows briefly (not on filter or page changes)
        if (liveRef.current) {
          const seen = new Set(shownIdsRef.current);
          const fresh = new Set(list.filter(x => !seen.has(x.id)).map(x => x.id));
          if (fresh.size) { setFreshIds(fresh); clearTimeout(freshTimer.current); freshTimer.current = setTimeout(() => setFreshIds(new Set()), 1800); }
        }
        liveRef.current = false;
        shownIdsRef.current = list.map(x => x.id);
        setSales(list);
        setByLocation(res.data.by_location || []);
        setSummary(res.data.summary);
        setTotalPages(res.data.total_pages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || tr('Could not load sales.'));
    } finally {
      setLoading(false);
    }
  }, [page, range.from, range.to, search, payment, businessId, branchId, location, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // New sales appear on their own
  useEffect(() => {
    if (!socket) return;
    const onMovement = (payload) => { if (payload?.action === 'stock_out') { liveRef.current = true; load(); } };
    socket.on('stock_movement', onMovement);
    return () => socket.off('stock_movement', onMovement);
  }, [socket, load]);

  const openReceipt = async (id) => {
    try {
      setOpeningId(id);
      const res = await api.get(`/sales/${id}`);
      if (res.data.success) setOpenSale(res.data.sale);
    } catch (err) {
      setError(err.response?.data?.message || tr('Could not open that receipt.'));
    } finally {
      setOpeningId(null);
    }
  };

  const changeFilter = (setter) => (value) => { setter(value); setPage(1); };
  const rangeLabel = range.from
    ? (range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`)
    : tr('All time');

  const firstLoad = loading && sales.length === 0;
  const hasFilters = Boolean(search || payment || location || period !== 'today');
  const resetFilters = () => { setSearchInput(''); setPayment(''); setLocation(''); setPeriod('today'); setPage(1); };

  // Pop-up stores that had sales in this period (for the Location filter)
  const storeOptions = useMemo(() => {
    const seen = new Map();
    byLocation.filter(l => l.store_id != null).forEach(l => {
      if (!seen.has(l.store_id)) seen.set(l.store_id, { id: l.store_id, label: locationLabel(l), branch: l.branch_name });
    });
    if (location && location !== 'floor' && !seen.has(Number(location))) seen.set(Number(location), { id: Number(location), label: tr('Selected pop-up store'), branch: '' });
    return [...seen.values()];
  }, [byLocation, location]);

  // Clicking a location row filters the receipts to it (and to its branch, for head office)
  const pickLocation = (l) => {
    const value = l.store_id == null ? 'floor' : String(l.store_id);
    const same = location === value && (!isSuperAdmin || String(branchId) === String(l.branch_id));
    if (isSuperAdmin && !same && String(branchId) !== String(l.branch_id)) setScope({ business: l.business_id, branch: l.branch_id });
    setLocation(same ? '' : value);
    setPage(1);
  };

  return (
    <Layout>
      <PageHeader
        breadcrumbs={isSuperAdmin && scopeChosen ? [
          { label: tr('Sales history'), to: '/sales' },
          ...(!businessId
            ? [{ label: tr('All businesses') }]
            : branchId
              ? [{ label: scopeBusiness?.name || tr('Business'), to: `/sales?view=1&business=${businessId}` }, { label: scopeBranch?.name || tr('Branch') }]
              : [{ label: scopeBusiness?.name || tr('Business') }]),
        ] : undefined}
        title={tr('Sales history')}
        description={tr('Every sale from the point of sale, with its receipt. Open a sale to view or reprint the receipt.')}
        actions={isSuperAdmin
          ? (scopeChosen && <Button variant="secondary" icon={ArrowLeftRight} onClick={changeScope}>{tr('Change business or branch')}</Button>)
          : <Button icon={ScanLine} to="/qr/scan">{tr('Open point of sale')}</Button>}
      />

      {isSuperAdmin && scopeChosen && businessId && businessBranches.length > 1 && (
        <ScopeBar
          businessBranches={businessBranches}
          branchId={branchId}
          onBranch={(id) => setScope({ business: businessId, branch: id })}
        />
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <SegmentedControl label={tr('Period')} value={period} onChange={changeFilter(setPeriod)} tabs={PERIODS} className="max-w-full overflow-x-auto" />
        {period === 'custom' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Input type="date" size="sm" value={customFrom} max={customTo} onChange={e => changeFilter(setCustomFrom)(e.target.value)} aria-label={tr('From date')} />
            <span className="text-caption text-ink-muted">{tr('to')}</span>
            <Input type="date" size="sm" value={customTo} min={customFrom} onChange={e => changeFilter(setCustomTo)(e.target.value)} aria-label={tr('To date')} />
          </div>
        )}
      </div>

      {!scopeChosen ? (
        <ScopePicker
          businesses={businesses}
          branches={branches}
          byLocation={byLocation}
          summary={summary}
          loading={firstLoad}
          rangeLabel={rangeLabel}
          onPick={setScope}
        />
      ) : (<>
      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <KpiCard loading={firstLoad} label={tr('Total sales')} value={summary ? summary.revenue : 0} format={rm} icon={TrendingUp} tone="success" meta={(compare && <DayDelta data={compare} />) || tr('Money taken')} />
        <KpiCard loading={firstLoad} label={tr('Receipts')} value={summary ? summary.sales_count : 0} icon={Receipt} tone="accent" meta={compare?.previous ? tr('Day before: {sales_count}', { sales_count: compare.previous.sales_count }) : rangeLabel} />
        <KpiCard loading={firstLoad} label={tr('Average per receipt')} value={summary ? summary.average : 0} format={rm} icon={ShoppingBag} tone="neutral" meta={tr('Total sales ÷ receipts')} />
        <KpiCard loading={firstLoad} label={tr('Items sold')} value={summary ? summary.units : 0} icon={Package} tone="neutral" meta={tr('Across all receipts')} />
      </div>
      {summary && summary.revenue > 0 && <PaymentSplit byPayment={summary.by_payment} total={summary.revenue} />}

      {singleDay && range.from && (
        <DayInsights
          day={range.from}
          isToday={period === 'today'}
          dayLabel={period === 'today' ? tr('Today') : tr('Yesterday')}
          businessId={isSuperAdmin ? businessId : ''}
          branchId={isSuperAdmin ? branchId : ''}
          showBranches={isSuperAdmin && !branchId}
          onData={onDayData}
        />
      )}

      {byLocation.length > 0 && (
        <LocationBreakdown
          rows={byLocation}
          isSuperAdmin={isSuperAdmin}
          rangeLabel={rangeLabel}
          active={location ? { store: location, branch: branchId } : null}
          onPick={pickLocation}
        />
      )}

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <SearchInput
          wrapperClassName="md:flex-1 md:min-w-[16rem]"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder={tr('Search by receipt number, product, SKU or note…')}
          aria-label={tr('Search sales')}
        />
        <Select wrapperClassName="md:w-48" aria-label={tr('Location')} value={location} onChange={e => changeFilter(setLocation)(e.target.value)}>
          <option value="">{tr('All locations')}</option>
          <option value="floor">{tr('Branch counter')}</option>
          {storeOptions.length > 0 && (
            <optgroup label={tr('Pop-up stores')}>
              {storeOptions.map(o => <option key={o.id} value={o.id}>{o.label}{isSuperAdmin && o.branch ? ` · ${o.branch}` : ''}</option>)}
            </optgroup>
          )}
        </Select>
        <Select wrapperClassName="md:w-44" aria-label={tr('Payment method')} value={payment} onChange={e => changeFilter(setPayment)(e.target.value)}>
          <option value="">{tr('All payments')}</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader title={tr('Receipts')} description={firstLoad ? tr('Loading…') : tr('{n} {n|receipt|receipts}', { n: summary?.sales_count ?? sales.length })} />
        <Table minWidth={isSuperAdmin ? '62rem' : '56rem'}>
          <THead>
            <TR>
              <TH>{tr('Receipt')}</TH>
              <TH>{tr('When')}</TH>
              <TH>{tr('Items')}</TH>
              <TH>{tr('Payment')}</TH>
              <TH>{tr('Location')}</TH>
              <TH>{tr('Served by')}</TH>
              <TH numeric>{tr('Total')}</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              loading={firstLoad}
              error={!loading && error && sales.length === 0 ? error : null}
              onRetry={load}
              empty={!loading && !error && sales.length === 0}
              emptyIcon={Receipt}
              emptyTitle={tr('No sales found')}
              emptyDescription={tr('Try another period or clear the search.')}
              emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={resetFilters}>{tr('Clear filters')}</Button> : null}
            />
            {sales.map((s, i) => {
              const preview = s.items_preview || [];
              return (
                <TR key={s.id} index={i} onClick={() => openReceipt(s.id)} highlight={freshIds.has(s.id)}>
                  <TD className="whitespace-nowrap">
                    <span className="font-mono text-caption font-semibold text-accent">{s.receipt_no}</span>
                    {openingId === s.id && <Spinner className="w-3 h-3 ml-1.5 text-ink-muted" />}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-secondary">{formatDateTime(s.created_at)}</TD>
                  <TD className="max-w-[13rem] 2xl:max-w-xs">
                    <p className="truncate text-ink">{preview[0] || '—'}</p>
                    {preview.length > 1 && <p className="text-caption text-ink-muted">{tr('+ {value} more', { value: preview.length - 1 })}</p>}
                  </TD>
                  <TD><StatusPill kind="payment" value={s.payment_method} size="sm" /></TD>
                  <TD className="max-w-[14rem]">
                    <LocationBadge row={s} />
                    {isSuperAdmin && <p className="mt-1 truncate text-caption text-ink-muted">{s.branch_name}</p>}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-secondary">{s.cashier_name || '—'}</TD>
                  <TD numeric className="font-semibold">{rm(s.total_amount)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} prevLabel={tr('Newer')} nextLabel={tr('Older')} />
      </Card>
      </>)}

      {openSale && (
        <ReceiptModal onClose={() => setOpenSale(null)} closeLabel={tr('Close')} closeVariant="secondary">
          <SaleReceipt sale={openSale} />
        </ReceiptModal>
      )}
    </Layout>
  );
}

function formatDay(value) {
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d) ? value : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Head office: choose what to look at before any receipts are shown
function ScopePicker({ businesses, branches, byLocation, summary, loading, rangeLabel, onPick }) {
  const perBranch = {};
  byLocation.forEach(l => {
    const t = (perBranch[l.branch_id] = perBranch[l.branch_id] || { revenue: 0, sales: 0 });
    t.revenue += l.revenue; t.sales += l.sales_count;
  });
  const sum = (ids) => ids.reduce((acc, id) => ({ revenue: acc.revenue + (perBranch[id]?.revenue || 0), sales: acc.sales + (perBranch[id]?.sales || 0) }), { revenue: 0, sales: 0 });
  const Figures = ({ revenue, sales, strong }) => (
    <div className="text-right flex-shrink-0">
      <div className={cn('tabular-nums text-ink', strong ? 'text-base font-semibold' : 'text-sm font-semibold')}>{loading ? '…' : rm(revenue)}</div>
      <div className="text-caption text-ink-muted tabular-nums">{loading ? '' : tr('{sales} {sales|receipt|receipts}', { sales })}</div>
    </div>
  );

  return (
    <section aria-label={tr('Choose what to view')}>
      <p className="mb-3 text-sm text-ink-secondary">{tr('Choose a business or branch to see its sales. Figures are for')}{' '}<strong className="font-medium text-ink">{rangeLabel}</strong>.</p>

      <ButtonBase
        onClick={() => onPick({})}
        className="group mb-4 flex w-full items-center gap-4 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] duration-fast hover:border-accent-line hover:shadow-popover"
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg"><Globe className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">{tr('All businesses')}</div>
          <div className="text-caption text-ink-muted">{tr('Every branch and pop-up store together')}</div>
        </div>
        <Figures revenue={summary?.revenue || 0} sales={summary?.sales_count || 0} strong />
        <ChevronRight className="h-4 w-4 text-ink-subtle group-hover:text-accent" aria-hidden="true" />
      </ButtonBase>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {businesses.map(biz => {
          const bizBranches = branches.filter(b => String(b.business_id) === String(biz.id));
          const total = sum(bizBranches.map(b => b.id));
          return (
            <Card key={biz.id} className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line-soft px-5 py-4">
                <BusinessDot business={biz} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink truncate">{biz.name}</div>
                  <div className="text-caption text-ink-muted">{bizBranches.length}{tr(' branch')}{bizBranches.length === 1 ? '' : 'es'}</div>
                </div>
                <Figures revenue={total.revenue} sales={total.sales} strong />
              </div>
              <ul className="flex-1 divide-y divide-line-soft">
                {bizBranches.map(br => {
                  const t = perBranch[br.id] || { revenue: 0, sales: 0 };
                  return (
                    <li key={br.id}>
                      <ButtonBase
                        onClick={() => onPick({ business: biz.id, branch: br.id })}
                        className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-fast hover:bg-subtle focus-visible:outline-none focus-visible:bg-accent-soft/60"
                      >
                        <Building2 className="h-4 w-4 flex-shrink-0 text-ink-muted" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink truncate">{br.name}</div>
                          {br.branch_code && <div className="font-mono text-[11px] text-ink-muted">{br.branch_code}</div>}
                        </div>
                        <Figures revenue={t.revenue} sales={t.sales} />
                        <ChevronRight className="h-4 w-4 text-ink-subtle group-hover:text-accent" aria-hidden="true" />
                      </ButtonBase>
                    </li>
                  );
                })}
                {bizBranches.length === 0 && <li className="px-5 py-3 text-caption text-ink-muted">{tr('No branches yet')}</li>}
              </ul>
              <div className="border-t border-line-soft bg-subtle/60 px-5 py-2.5">
                <Button variant="link" size="sm" iconRight={ChevronRight} onClick={() => onPick({ business: biz.id })}>{tr('View all of ')}{biz.name}</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// Head office: what is being viewed, with quick branch switching inside a business and a way back to the chooser
// Quick switch between the branches of the business being viewed
function ScopeBar({ businessBranches, branchId, onBranch }) {
  return (
    <Card className="mb-4 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-caption font-medium uppercase tracking-wide text-ink-muted">{tr('Branch')}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr('Switch branch')}>
        {[{ id: '', name: tr('All branches') }, ...businessBranches].map(b => {
          const on = String(b.id) === String(branchId || '');
          return (
            <ButtonBase
              key={b.id || 'all'}
              onClick={() => onBranch(b.id)}
              aria-pressed={on}
              className={cn('h-8 rounded-full px-3 text-caption font-medium transition-colors duration-fast',
                on ? 'bg-accent text-white' : 'bg-sunken text-ink-secondary hover:bg-line-soft hover:text-ink')}
            >
              {b.name}
            </ButtonBase>
          );
        })}
      </div>
    </Card>
  );
}

// Takings per place: each branch's shop floor and every pop-up store, for the chosen period
function LocationBreakdown({ rows, isSuperAdmin, rangeLabel, active, onPick }) {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0);
  const isActive = (r) => active
    && active.store === (r.store_id == null ? 'floor' : String(r.store_id))
    && (!isSuperAdmin || String(active.branch) === String(r.branch_id));
  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader
        title={<span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" aria-hidden="true" />{' '}{tr('Sales by location')}</span>}
        description={tr('Where the money came from · {rangeLabel} · click a location to see only its receipts', { rangeLabel })}
      />
      <Table minWidth="44rem">
        <THead>
          <TR>
            <TH>{tr('Location')}</TH>
            <TH numeric>{tr('Receipts')}</TH>
            <TH numeric>{tr('Items')}</TH>
            <TH>{tr('Share')}</TH>
            <TH numeric>{tr('Total sales')}</TH>
            <TH numeric>{tr('Last sale')}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r, i) => {
            const share = total ? (r.revenue / total) * 100 : 0;
            const popUp = r.store_id != null;
            return (
              <TR key={`${r.branch_id}-${r.store_id ?? 'floor'}`} index={i} onClick={() => onPick(r)} selected={isActive(r)}>
                <TD>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', popUp ? 'bg-accent-soft text-accent-fg' : 'bg-sunken text-ink-secondary')}>
                      {popUp ? <Store className="h-4 w-4" aria-hidden="true" /> : <Building2 className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium text-ink">{locationLabel(r)}</span>
                        {popUp && r.store_name && (
                          <Link
                            to={`/stores/${r.store_id}/report`}
                            onClick={e => e.stopPropagation()}
                            className="flex-shrink-0 rounded text-caption font-medium text-accent-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            {tr('Store report')}
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 truncate text-caption text-ink-muted">
                        {isSuperAdmin && <BusinessDot business={{ id: r.business_id, name: r.business_name }} size="sm" />}
                        {isSuperAdmin ? `${r.business_name} · ${r.branch_name}` : (popUp ? (r.store_venue || tr('Pop-up store')) : r.branch_name)}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD numeric>{r.sales_count}</TD>
                <TD numeric>{r.units}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full rounded-full bg-accent transition-[width] duration-slow ease-out" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-caption text-ink-muted tabular-nums">{share.toFixed(0)}%</span>
                  </div>
                </TD>
                <TD numeric className="font-semibold">{rm(r.revenue)}</TD>
                <TD numeric className="whitespace-nowrap text-ink-secondary">{formatDateTime(r.last_sale_at)}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
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
      <div className="flex h-2 rounded-full overflow-hidden bg-sunken" role="img" aria-label={tr('Sales by payment method')}>
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
