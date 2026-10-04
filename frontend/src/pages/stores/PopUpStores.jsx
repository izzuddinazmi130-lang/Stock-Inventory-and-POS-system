import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, Radio, CalendarClock, TrendingUp, ChevronRight, MapPin } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useBusiness } from '../../context/BusinessContext';
import { rm } from '../../components/pos/Receipt';
import {
  BusinessDot, Card, FilterBar, KpiCard, PageHeader, SearchInput, Select, StatusPill, Tabs,
  Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';

const TABS = [
  { value: 'active', label: 'Live now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
  { value: 'all', label: 'All' },
];

const EMPTY = {
  active: ['No pop-up store is live right now', 'Stores show up here while their event is running.'],
  upcoming: ['Nothing coming up', 'Stores that are scheduled to start later show up here.'],
  ended: ['No ended stores yet', 'Finished events and their final takings show up here.'],
  all: ['No pop-up stores yet', 'Pop-up stores are created from a branch’s Store events page.'],
};

// "4 Oct" or "1 – 10 Oct" style date range
function dateRange(start, end) {
  const fmt = (d, opts) => new Date(d).toLocaleDateString('en-MY', opts);
  if (!start) return '—';
  if (!end) return `From ${fmt(start, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const s = new Date(start), e = new Date(end);
  if (s.toDateString() === e.toDateString()) return fmt(start, { day: 'numeric', month: 'short', year: 'numeric' });
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fmt(start, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/**
 * Every pop-up store in one list (head office), live ones first. Clicking a row opens its report,
 * so nobody has to go Businesses → branch → Store events to find one.
 */
export default function PopUpStores() {
  const navigate = useNavigate();
  const { socket } = useSocket() || {};
  const { businesses = [] } = useBusiness() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some(t => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'active';
  const businessId = searchParams.get('business') || '';

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/stores', { params: businessId ? { business_id: businessId } : {} });
      if (res.data.success) setStores(res.data.stores || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the pop-up stores.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // New sales at a booth update the takings straight away
  useEffect(() => {
    if (!socket) return;
    socket.on('stock_movement', load);
    return () => socket.off('stock_movement', load);
  }, [socket, load]);

  const counts = useMemo(() => {
    const c = { active: 0, upcoming: 0, ended: 0, all: stores.length };
    stores.forEach(s => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [stores]);

  const live = stores.filter(s => s.status === 'active');
  const todayLive = live.reduce((sum, s) => sum + s.today_revenue, 0);
  const todaySales = live.reduce((sum, s) => sum + s.today_sales, 0);
  const nextUp = stores.filter(s => s.status === 'upcoming')[0];

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stores.filter(s => (tab === 'all' || s.status === tab) && (!term
      || [s.name, s.venue, s.branch_name, s.business_name, s.person_in_charge].some(v => v && v.toLowerCase().includes(term))));
  }, [stores, tab, search]);

  const first = loading && stores.length === 0;

  return (
    <Layout>
      <PageHeader
        title="Pop-up stores"
        description="Every pop-up store across the businesses, with its takings. Click a store to open its report."
      />

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <KpiCard loading={first} label="Live now" value={counts.active} icon={Radio} tone="success"
          meta={counts.active ? live.map(s => s.name).slice(0, 2).join(', ') + (counts.active > 2 ? ` +${counts.active - 2}` : '') : 'No event running'}
          onClick={() => setParam('tab', 'active')} />
        <KpiCard loading={first} label="Takings today" value={todayLive} format={v => rm(v)} icon={TrendingUp} tone="accent"
          meta={`${todaySales} ${todaySales === 1 ? 'sale' : 'sales'} at live stores`} />
        <KpiCard loading={first} label="Upcoming" value={counts.upcoming} icon={CalendarClock} tone="info"
          meta={nextUp ? `Next: ${nextUp.name}, ${dateRange(nextUp.start_date)}` : 'Nothing scheduled'}
          onClick={() => setParam('tab', 'upcoming')} />
      </div>

      <FilterBar onReset={() => { setSearch(''); setParam('business', ''); }} resetVisible={Boolean(search || businessId)}>
        <SearchInput wrapperClassName="md:flex-1 md:min-w-[16rem]" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search store, venue, branch or person in charge…" aria-label="Search pop-up stores" />
        <Select wrapperClassName="md:w-48" aria-label="Business" value={businessId} onChange={e => setParam('business', e.target.value)}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-5 pt-3 border-b border-line-soft">
          <Tabs label="Store status" value={tab} onChange={v => setParam('tab', v === 'active' ? '' : v)} className="border-b-0"
            tabs={TABS.map(t => ({ ...t, count: counts[t.value] || 0 }))} />
        </div>
        <Table minWidth="58rem">
          <THead>
            <TR>
              <TH>Store</TH>
              <TH>Business · Branch</TH>
              <TH>Dates</TH>
              <TH>Status</TH>
              <TH numeric>Today</TH>
              <TH numeric>Sales</TH>
              <TH numeric>Takings</TH>
              <TH className="w-10"><span className="sr-only">Open</span></TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={8}
              loading={first}
              error={!loading && error && stores.length === 0 ? error : null}
              onRetry={load}
              empty={!first && !error && shown.length === 0}
              emptyIcon={Store}
              emptyTitle={search ? 'No store matches' : EMPTY[tab][0]}
              emptyDescription={search ? 'Try another name, or clear the search.' : EMPTY[tab][1]}
            />
            {shown.map((s, i) => (
              <TR key={s.id} index={i} onClick={() => navigate(`/stores/${s.id}/report`)} aria-label={`Open the report for ${s.name}`}>
                <TD>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
                      <Store className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{s.name}</div>
                      {s.venue && <div className="flex items-center gap-1 truncate text-caption text-ink-muted"><MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />{s.venue}</div>}
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="flex items-center gap-1.5 min-w-0 text-ink-secondary">
                    <BusinessDot business={{ id: s.business_id, name: s.business_name }} size="sm" />
                    <span className="truncate">{s.business_name} · {s.branch_name}</span>
                  </div>
                </TD>
                <TD className="whitespace-nowrap text-ink-secondary">{dateRange(s.start_date, s.end_date)}</TD>
                <TD><StatusPill kind="store" value={s.status} size="sm" /></TD>
                <TD numeric className={s.today_revenue ? 'font-medium text-ink' : 'text-ink-muted'}>{s.status === 'active' ? rm(s.today_revenue) : '—'}</TD>
                <TD numeric>{s.sales_count}</TD>
                <TD numeric className="font-semibold">{rm(s.revenue)}</TD>
                <TD className="text-ink-subtle max-sm:!hidden"><ChevronRight className="h-4 w-4" aria-hidden="true" /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </Layout>
  );
}
