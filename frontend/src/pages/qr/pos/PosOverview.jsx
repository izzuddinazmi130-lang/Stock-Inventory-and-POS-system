import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Package, QrCode,
  Receipt, RefreshCw, ShieldAlert, ShoppingBag, Store, TrendingUp, Wallet,
} from 'lucide-react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import {
  Alert, Badge, BusinessDot, Button, Card, CardHeader, EmptyState, IconButton, Input, KpiCard, PageHeader,
  StatusPill, Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../../components/ui';

const money = (v) => `RM ${(Number(v) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDay = (day, n) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + n); return localDay(d); };
const timeOf = (v) => (v ? new Date(String(v).replace(' ', 'T')).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' }) : '');
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

function sinceLabel(v) {
  if (!v) return null;
  const mins = Math.round((Date.now() - new Date(String(v).replace(' ', 'T')).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  return timeOf(v);
}

const PAYMENTS = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'qr', label: 'QR / e-Wallet', icon: QrCode },
  { key: 'online_banking', label: 'Card / Online', icon: CreditCard },
];

/**
 * Super admin view of the POS page: live counter activity across every branch (sales are rung up by branch
 * admins). One day at a time, today by default; refreshes itself when a branch completes a sale.
 */
export default function PosOverview({ Wrap }) {
  const today = localDay();
  const [day, setDay] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { socket } = useSocket() || {};
  const isToday = day === today;
  const reqId = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const res = await api.get('/sales/overview', { params: { date: day } });
      if (id === reqId.current && res.data.success) setData(res.data);
    } catch (err) {
      if (id === reqId.current) setError(err.response?.data?.message || 'Could not load the sales for this day.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [day]);

  useEffect(() => { load(); }, [load]);

  // Live: refresh when any branch completes a sale (and every minute as a fallback) while viewing today
  useEffect(() => {
    if (!isToday) return undefined;
    const refresh = () => load({ quiet: true });
    socket?.on('stock_movement', refresh);
    const timer = setInterval(refresh, 60000);
    return () => { socket?.off('stock_movement', refresh); clearInterval(timer); };
  }, [socket, isToday, load]);

  const totals = data?.totals;
  const prev = data?.previous;
  const firstLoad = loading && !data;
  const delta = prev && prev.revenue > 0 ? ((totals.revenue - prev.revenue) / prev.revenue) * 100 : null;
  const dayLabel = isToday ? 'Today' : day === shiftDay(today, -1) ? 'Yesterday'
    : new Date(`${day}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Wrap>
      <PageHeader
        breadcrumbs={false}
        title="Daily sales"
        description="Sales from every branch for one day. It updates by itself as each sale is made."
        actions={<Button variant="ghost" icon={RefreshCw} onClick={() => load()} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>}
      />

      <Alert tone="info" icon={ShieldAlert} title="Sales are made by branch admins" className="mb-6">
        Selling and receiving stock happen on each branch’s Point of sale. This page shows their sales as they happen.
      </Alert>

      {/* Day picker */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-2 sm:w-auto">
        <IconButton icon={ChevronLeft} label="Previous day" variant="secondary" size="md" onClick={() => setDay(d => shiftDay(d, -1))} />
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface pl-3 pr-1 sm:flex-none">
          <CalendarDays className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          {/* On phones the date box already shows the date, so only "Today" is spelled out */}
          <span className={cn('min-w-0 truncate text-sm font-medium text-ink sm:inline sm:min-w-[5.5rem]', isToday ? 'inline' : 'hidden')}>{dayLabel}</span>
          <Input type="date" value={day} max={today} onChange={e => e.target.value && setDay(e.target.value)} aria-label="Pick a day" className="h-8 w-[9.5rem] border-0 shadow-none focus:ring-0 px-1 text-ink-muted" />
        </div>
        <IconButton icon={ChevronRight} label="Next day" variant="secondary" size="md" disabled={isToday} onClick={() => setDay(d => shiftDay(d, 1))} />
        </div>
        {!isToday && <Button variant="ghost" onClick={() => setDay(today)}>Back to today</Button>}
        {isToday && (
          <Badge tone="success" className="ml-1">
            <span className="relative mr-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live
          </Badge>
        )}
      </div>

      {error && <Alert tone="danger" className="mb-6" action={<Button variant="secondary" size="sm" onClick={() => load()}>Try again</Button>}>{error}</Alert>}

      {/* Headline numbers */}
      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          loading={firstLoad}
          label="Total sales"
          value={totals?.revenue ?? 0}
          format={money}
          icon={Wallet}
          tone="accent"
          meta={delta === null
            ? (prev?.revenue ? '' : 'No sales the day before')
            : <span className={cn('inline-flex items-center gap-0.5 font-medium', delta >= 0 ? 'text-success-fg' : 'text-danger-fg')}>
                {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
                {Math.abs(delta).toFixed(0)}% vs day before
              </span>}
        />
        <KpiCard loading={firstLoad} label="Receipts" value={totals?.sales_count ?? 0} icon={Receipt} tone="info" meta={prev ? `Day before: ${prev.sales_count}` : ''} />
        <KpiCard loading={firstLoad} label="Average per receipt" value={totals?.average ?? 0} format={money} icon={TrendingUp} tone="success" meta="Total sales ÷ receipts" />
        <KpiCard loading={firstLoad} label="Items sold" value={totals?.units ?? 0} icon={ShoppingBag} tone="neutral" meta="Across all receipts" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales by hour" description={`${dayLabel} · sales per hour, all branches`} />
          <div className="p-5">
            {firstLoad ? <div className="skeleton h-48" /> : <HourlyChart hours={data?.by_hour || []} />}
          </div>
        </Card>
        <Card>
          <CardHeader title="How customers paid" description="Cash, QR or card" />
          <div className="p-5">
            {firstLoad ? <div className="skeleton h-40" /> : <PaymentMix totals={totals} />}
          </div>
        </Card>
      </div>

      {/* Branch counters */}
      <Card className="mb-6">
        <CardHeader title="Sales by branch" description={`Sales at each branch, ${dayLabel.toLowerCase() === 'today' ? 'today' : `on ${dayLabel}`}`} actions={<Button variant="ghost" size="sm" iconRight={ChevronRight} to="/sales">Sales history</Button>} />
        <Table minWidth="44rem">
          <THead>
            <TR>
              <TH>Branch</TH>
              <TH numeric>Receipts</TH>
              <TH numeric>Items</TH>
              <TH>Share of sales</TH>
              <TH numeric>Total sales</TH>
              <TH numeric>Last sale</TH>
            </TR>
          </THead>
          <TBody>
            <TableState colSpan={6} loading={firstLoad} error={!data && error} onRetry={() => load()} empty={data && data.branches.length === 0} emptyIcon={Store} emptyTitle="No active branches" />
            {(data?.branches || []).map((b, i) => {
              const share = totals?.revenue ? (b.revenue / totals.revenue) * 100 : 0;
              return (
                <TR key={b.branch_id} index={i}>
                  <TD>
                    <div className="flex items-center gap-2 min-w-0">
                      <BusinessDot business={{ id: b.business_id, name: b.business_name }} />
                      <div className="min-w-0">
                        <div className="font-medium text-ink truncate">{b.branch_name}</div>
                        <div className="text-caption text-ink-muted truncate">{b.business_name}{b.branch_code ? ` · ${b.branch_code}` : ''}</div>
                      </div>
                    </div>
                  </TD>
                  <TD numeric>{b.sales_count}</TD>
                  <TD numeric>{b.units}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sunken">
                        <div className="h-full rounded-full bg-accent transition-[width] duration-slow ease-out" style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-caption text-ink-muted tabular-nums">{share.toFixed(0)}%</span>
                    </div>
                  </TD>
                  <TD numeric className="font-semibold">{money(b.revenue)}</TD>
                  <TD numeric>
                    {b.last_sale_at
                      ? <span className="text-ink-secondary">{isToday ? sinceLabel(b.last_sale_at) : timeOf(b.last_sale_at)}</span>
                      : <span className="text-ink-subtle">No sales</span>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Latest receipts */}
        <Card className="xl:col-span-3">
          <CardHeader title="Latest receipts" description={isToday ? 'Updates as branches complete sales' : `The last receipts on ${dayLabel}`} />
          {firstLoad ? (
            <div className="p-5 space-y-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-12" />)}</div>
          ) : (data?.recent || []).length === 0 ? (
            <EmptyState compact icon={Receipt} title={isToday ? 'No sales yet today' : 'No sales on this day'} description={isToday ? 'Receipts appear here the moment a branch completes a sale.' : 'Pick another day above.'} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {data.recent.map(s => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-secondary">
                    <Receipt className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="whitespace-nowrap font-mono text-sm text-ink">{s.receipt_no}</span>
                      <StatusPill kind="payment" value={s.payment_method} size="sm" />
                    </div>
                    <div className="text-caption text-ink-muted truncate">
                      {s.branch_name}{s.store_name ? ` · ${s.store_name}` : ''} · {s.total_quantity} item{s.total_quantity === 1 ? '' : 's'}{s.cashier_name ? ` · ${s.cashier_name}` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-ink tabular-nums">{money(s.total_amount)}</div>
                    <div className="text-caption text-ink-muted">{timeOf(s.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Best sellers */}
        <Card className="xl:col-span-2">
          <CardHeader title="Best sellers" description={`Most items sold ${isToday ? 'today' : `on ${dayLabel}`}`} />
          {firstLoad ? (
            <div className="p-5 space-y-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-10" />)}</div>
          ) : (data?.top_products || []).length === 0 ? (
            <EmptyState compact icon={Package} title="Nothing sold yet" />
          ) : (
            <ol className="divide-y divide-line-soft">
              {data.top_products.map((p, i) => (
                <li key={`${p.sku}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-center text-sm font-semibold text-ink-muted tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">{p.name}</div>
                    <div className="text-caption text-ink-muted truncate"><span className="font-mono">{p.sku}</span>{p.variant_text ? ` · ${p.variant_text}` : ''}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-ink tabular-nums">{p.quantity} sold</div>
                    <div className="text-caption text-ink-muted tabular-nums">{money(p.revenue)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </Wrap>
  );
}

/** Takings per hour: one series, so a single hue, no legend; the busiest hour is labelled; hover for details. */
function HourlyChart({ hours }) {
  const [hover, setHover] = useState(null);
  // Show the trading day: 8am–10pm, widened if sales happened outside it
  const active = hours.filter(h => h.sales_count > 0).map(h => h.hour);
  const start = Math.min(8, ...active);
  const end = Math.max(22, ...active);
  const shown = hours.filter(h => h.hour >= start && h.hour <= end);
  const max = Math.max(0, ...shown.map(h => h.revenue));
  const peak = max > 0 ? shown.find(h => h.revenue === max) : null;
  const niceMax = useMemo(() => {
    if (max <= 0) return 100;
    const pow = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / pow) * pow;
  }, [max]);

  if (max === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-line text-center">
        <TrendingUp className="mb-2 h-5 w-5 text-ink-subtle" aria-hidden="true" />
        <p className="text-sm font-medium text-ink">No sales yet</p>
        <p className="text-caption text-ink-muted">Bars appear here hour by hour as sales come in.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-48">
        {/* Recessive gridlines at 0, ½ and full scale */}
        {[1, 0.5, 0].map(f => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%` }}>
            <span className="w-14 -translate-y-1/2 text-right text-[11px] text-ink-muted tabular-nums">{f === 0 ? '0' : money(niceMax * f).replace('.00', '')}</span>
            <div className="h-px flex-1 -translate-y-1/2 bg-line-soft" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-16 right-0 flex items-end gap-[2px]" role="img" aria-label={`Sales per hour; busiest ${peak ? hourLabel(peak.hour) : ''}`}>
          {shown.map(h => {
            const pct = (h.revenue / niceMax) * 100;
            const isHover = hover === h.hour;
            return (
              <div
                key={h.hour}
                className="group relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(h.hour)}
                onMouseLeave={() => setHover(null)}
              >
                {h.revenue > 0 && (
                  <div
                    className={cn('w-full rounded-t-[4px] transition-colors duration-fast', isHover ? 'bg-accent-hover' : 'bg-accent')}
                    style={{ height: `${Math.max(pct, 1.5)}%` }}
                  />
                )}
                {peak && h.hour === peak.hour && !isHover && (
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-ink-secondary tabular-nums" style={{ bottom: `calc(${pct}% + 4px)` }}>
                    {money(h.revenue).replace('.00', '')}
                  </span>
                )}
                {isHover && (
                  <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-caption text-white shadow-popover" style={{ bottom: `calc(${Math.min(pct, 62)}% + 6px)` }}>
                    <div className="font-semibold">{hourLabel(h.hour)}–{hourLabel((h.hour + 1) % 24)}</div>
                    <div className="tabular-nums">{money(h.revenue)} · {h.sales_count} receipt{h.sales_count === 1 ? '' : 's'}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-16 mt-2 flex gap-[2px]">
        {shown.map(h => (
          <span key={h.hour} className="flex-1 text-center text-[10px] text-ink-muted">{h.hour % 2 === 0 ? hourLabel(h.hour) : ''}</span>
        ))}
      </div>
    </div>
  );
}

function PaymentMix({ totals }) {
  const total = totals?.revenue || 0;
  return (
    <ul className="space-y-4">
      {PAYMENTS.map(({ key, label, icon: Icon }) => {
        const p = totals?.by_payment?.[key] || { amount: 0, count: 0 };
        const share = total ? (p.amount / total) * 100 : 0;
        return (
          <li key={key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <Icon className="h-4 w-4 text-ink-muted" aria-hidden="true" />{label}
              </span>
              <span className="font-semibold text-ink tabular-nums">{money(p.amount)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-accent transition-[width] duration-slow ease-out" style={{ width: `${share}%` }} />
              </div>
              <span className="w-28 whitespace-nowrap text-right text-caption text-ink-muted tabular-nums">{p.count} receipt{p.count === 1 ? '' : 's'} · {share.toFixed(0)}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
