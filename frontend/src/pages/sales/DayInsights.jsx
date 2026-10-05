import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Package, Store, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { BusinessDot, Card, CardHeader, EmptyState, Table, THead, TBody, TH, TR, TD, TableState, cn } from '../../components/ui';

const money = (v) => `RM ${(Number(v) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/** "Day before: RM 478.00" for the Total sales card: a plain figure reads better than a % of a day still in progress. */
export function DayDelta({ data }) {
  const prev = data?.previous;
  if (!prev) return null;
  return `Day before: ${money(prev.revenue)}`;
}

/**
 * Extra detail for a single day in Sales history: sales by hour, best sellers and (for head office looking at
 * more than one branch) every branch's sales, including branches with none. Refreshes itself on today.
 * onData receives the day's figures so the page can compare with the day before.
 */
export default function DayInsights({ day, isToday, dayLabel, businessId, branchId, showBranches, onData }) {
  const { socket } = useSocket() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    try {
      const params = { date: day };
      if (businessId) params.business_id = businessId;
      if (branchId) params.branch_id = branchId;
      const res = await api.get('/sales/overview', { params });
      if (id === reqId.current && res.data.success) { setData(res.data); onData?.(res.data); }
    } catch {
      if (id === reqId.current) { setData(null); onData?.(null); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [day, businessId, branchId, onData]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => onData?.(null), [onData]);

  // Today: refresh when a sale is made, and every minute as a fallback
  useEffect(() => {
    if (!isToday) return undefined;
    const refresh = () => load({ quiet: true });
    socket?.on('stock_movement', refresh);
    const timer = setInterval(refresh, 60000);
    return () => { socket?.off('stock_movement', refresh); clearInterval(timer); };
  }, [socket, isToday, load]);

  const first = loading && !data;
  const totals = data?.totals;
  const when = isToday ? 'today' : `on ${dayLabel}`;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales by hour" description={`${dayLabel} · when customers bought`} />
          <div className="p-5">{first ? <div className="skeleton h-48" /> : <HourlyChart hours={data?.by_hour || []} />}</div>
        </Card>
        <Card>
          <CardHeader title="Best sellers" description={`Most items sold ${when}`} />
          {first ? (
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

      {showBranches && (
        <Card className="mb-4 overflow-hidden">
          <CardHeader title="Sales by branch" description={`Every branch ${when}, including branches with no sales yet`} />
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
              <TableState colSpan={6} loading={first} empty={!first && (data?.branches || []).length === 0} emptyIcon={Store} emptyTitle="No active branches" />
              {(data?.branches || []).map((b, i) => {
                const share = totals?.revenue ? (b.revenue / totals.revenue) * 100 : 0;
                return (
                  <TR key={b.branch_id} index={i}>
                    <TD>
                      <div className="flex items-center gap-2 min-w-0">
                        <BusinessDot business={{ id: b.business_id, name: b.business_name }} />
                        <div className="min-w-0">
                          <div className="font-medium text-ink truncate">{b.branch_name}</div>
                          <div className="text-caption text-ink-muted truncate">{b.business_name}</div>
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
      )}
    </>
  );
}

/** Sales per hour: one series, so a single hue, no legend; the busiest hour is labelled; hover for details. */
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
              <div key={h.hour} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(h.hour)} onMouseLeave={() => setHover(null)}>
                {h.revenue > 0 && (
                  <div className={cn('w-full rounded-t-[4px] transition-colors duration-fast', isHover ? 'bg-accent-hover' : 'bg-accent')} style={{ height: `${Math.max(pct, 1.5)}%` }} />
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
        {shown.map(h => <span key={h.hour} className="flex-1 text-center text-[10px] text-ink-muted">{h.hour % 2 === 0 ? hourLabel(h.hour) : ''}</span>)}
      </div>
    </div>
  );
}
