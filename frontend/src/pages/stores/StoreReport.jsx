import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, CreditCard, Banknote, MapPin, Calendar, ArrowLeft, Clock, CheckCircle2, Phone, User, Radio, TrendingUp, Receipt, QrCode } from 'lucide-react';
import {
  Alert, Button, Card, CardHeader, ErrorState, KpiCard, PageHeader, Skeleton, SkeletonKpi, Spinner, StatusPill,
  Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { SaleReceipt, ReceiptModal, rm } from '../../components/pos/Receipt';
import { t, locale } from '../../i18n';

// The API sends "2026-10-04 09:00:00". Safari (iPhone) cannot read that form, so make it ISO-like first.
function toDate(val) {
  if (!val) return null;
  const d = new Date(typeof val === 'string' ? val.replace(' ', 'T') : val);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = toDate(val) || new Date(NaN);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateOnly(val) {
  if (!val) return '—';
  const d = toDate(val) || new Date(NaN);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTimeOnly(val) {
  if (!val) return '—';
  const d = toDate(val) || new Date(NaN);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function getStorePhase(store) {
  if (!store) return 'before';
  const now = Date.now();
  const sTime = toDate(store.start_date)?.getTime() || 0;
  const eTime = toDate(store.end_date)?.getTime() || 0;

  if (store.status === 'ended' || (eTime > 0 && now > eTime)) {
    return 'after';
  }
  if (sTime > 0 && now < sTime) {
    return 'before';
  }
  if (sTime > 0 && eTime > 0 && now >= sTime && now <= eTime) {
    return 'during';
  }
  return store.status === 'active' ? 'during' : 'before';
}

function getTimingStatusText(store, phase) {
  if (!store) return '';
  const now = Date.now();
  const sTime = toDate(store.start_date)?.getTime() || 0;
  const eTime = toDate(store.end_date)?.getTime() || 0;

  if (phase === 'before') {
    const diffMs = sTime - now;
    if (diffMs <= 0) return t('Starts shortly');
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return t('Starts in {days} day{value}{value2}', { days, value: days > 1 ? 's' : '', value2: remHours > 0 ? `, ${remHours}h` : '' });
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return t('Starts in {hours}h {value}m', { hours, value: mins % 60 });
    return t('Starts in {n} min{value}', { n: Math.max(1, mins), value: mins !== 1 ? 's' : '' });
  }

  if (phase === 'during') {
    const diffMs = eTime - now;
    if (diffMs <= 0) return t('Ending now');
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return t('Closes in {days}d {remHours}h', { days, remHours });
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return t('Ends in {hours}h {value}m', { hours, value: mins % 60 });
    return t('Ends in {n} mins', { n: Math.max(1, mins) });
  }

  // Phase is 'after'
  if (store.ended_at || eTime > 0) {
    const closedTime = toDate(store.ended_at)?.getTime() || eTime;
    const diffMs = now - closedTime;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0) return t('Concluded {days} day{value} ago', { days, value: days > 1 ? 's' : '' });
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return t('Concluded {hours} hour{value} ago', { hours, value: hours > 1 ? 's' : '' });
    return t('Recently concluded');
  }

  return t('Concluded');
}

export default function StoreReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [store, setStore] = useState(null);
  const { socket } = useSocket() || {};
  const [lines, setLines] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [summary, setSummary] = useState({ total_cash: 0, total_qr: 0, total_online: 0, total_sales: 0, total_items_sold: 0, total_transactions: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [openSale, setOpenSale] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  // silent = refresh in the background (live updates) without the loading state
  const fetchReport = useCallback(async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setMessage(null); }

      // 1. Fetch store detail
      let storeData = null;
      try {
        const stRes = await api.get(`/stores/${id}`);
        if (stRes.data.success) {
          storeData = stRes.data.store || stRes.data.data;
          setStore(storeData);
        }
      } catch (storeErr) {
        console.error('Store detail fetch error:', storeErr);
        const errMsg = storeErr.response?.data?.message || storeErr.message || t('Failed to fetch store details');
        setMessage({ type: 'danger', text: errMsg });
        return;
      }

      // 2. Fetch report movements & transactions
      try {
        const repRes = await api.get(`/stores/${id}/report`);
        if (repRes.data.success) {
          setLines(repRes.data.lines || repRes.data.movements || []);
          setTruncated(Boolean(repRes.data.truncated));
          if (repRes.data.summary) setSummary(repRes.data.summary);
        }
      } catch (repErr) {
        console.warn('Store movements fetch warning:', repErr);
        const repErrMsg = repErr.response?.data?.message || repErr.message || t('Could not load transaction breakdown');
        setMessage({ type: 'warning', text: repErrMsg });
      }
    } catch (err) {
      console.error('Unexpected error fetching report:', err);
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message || t('An error occurred while loading the report') });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // A sale rung up at this store shows up straight away
  useEffect(() => {
    if (!socket) return undefined;
    const onMovement = (payload) => { if (payload?.action === 'stock_out') fetchReport(true); };
    socket.on('stock_movement', onMovement);
    return () => socket.off('stock_movement', onMovement);
  }, [socket, fetchReport]);

  const openReceipt = async (saleId) => {
    try {
      setOpeningId(saleId);
      const res = await api.get(`/sales/${saleId}`);
      if (res.data.success) setOpenSale(res.data.sale);
    } catch (err) {
      setMessage({ type: 'warning', text: err.response?.data?.message || t('Could not open that receipt.') });
    } finally {
      setOpeningId(null);
    }
  };

  const phase = getStorePhase(store);
  const timingText = getTimingStatusText(store, phase);

  const PHASE_TO_STATUS = { during: 'active', before: 'upcoming', after: 'ended' };
  const backTo = isSuperAdmin ? '/stores' : (store ? `/branches/${store.branch_id}/stores` : `/branches/${user?.branch_id}/stores`);

  if (loading && !store) {
    return (
      <Layout>
        <Skeleton className="h-4 w-64 mb-3" />
        <Skeleton className="h-8 w-80 mb-8" />
        <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">{[0, 1, 2].map(i => <SkeletonKpi key={i} />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </Layout>
    );
  }

  if (!store) {
    return (
      <Layout>
        <Card>
          <ErrorState
            title={/access denied/i.test(message?.text || '') ? t('You don’t have access to this store') : t('Pop-up store not found')}
            description={/access denied/i.test(message?.text || '')
              ? t('This pop-up store belongs to another branch. You can only open your own branch’s stores.')
              : (message?.text || t('Pop-up store #{id} may have been deleted.', { id }))}
            onRetry={/access denied/i.test(message?.text || '') ? undefined : () => fetchReport()}
          />
          <div className="flex justify-center pb-8 -mt-6">
            <Button variant="ghost" icon={ArrowLeft} to={backTo}>{isSuperAdmin ? t('Pop-up stores') : t('My pop-up stores')}</Button>
          </div>
        </Card>
      </Layout>
    );
  }

  const phaseAlert = {
    before: { tone: 'warning', icon: Clock, title: t('Not live yet · {timingText}', { timingText }), body: <>{t('Opens')}{' '}<strong>{formatDateTime(store.start_date)}</strong>{' '}{t('and runs until')}{' '}<strong>{formatDateTime(store.end_date)}</strong>. {lines.length ? t('Sales made before it opened are included below.') : t('Sales will appear here once it starts.')}</> },
    during: { tone: 'success', icon: Radio, title: t('Live now · {timingText}', { timingText }), body: <>{t('Sales at this store are being recorded until')}{' '}<strong>{formatDateTime(store.end_date)}</strong>{t('. The numbers below update as you sell.')}</> },
    after: { tone: 'info', icon: CheckCircle2, title: t('Final report'), body: <>{t('This store closed')}{' '}<strong>{formatDateTime(store.ended_at || store.end_date)}</strong>{t('. The numbers below are final.')}</> },
  }[phase];

  return (
    <Layout>
      <PageHeader
        breadcrumbs={[
          ...(isSuperAdmin
            ? [{ label: t('Pop-up stores'), to: '/stores' }, { label: `${store.business_name || t('Business')} · ${store.branch_name || t('Branch')}` }]
            : [{ label: t('Pop-up stores'), to: `/branches/${store.branch_id}/stores` }]),
          { label: store.name },
        ]}
        title={store.name}
        meta={<>
          <StatusPill kind="store" value={PHASE_TO_STATUS[phase]} />
          {store.venue && <span className="inline-flex items-center gap-1.5 text-caption text-ink-secondary"><MapPin className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />{store.venue}</span>}
          <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted tabular-nums"><Calendar className="w-3.5 h-3.5" aria-hidden="true" />{formatDateTime(store.start_date)} → {formatDateTime(store.end_date)}</span>
        </>}
        actions={<>
          <Button variant="secondary" icon={ArrowLeft} to={backTo}>{t('\'Pop-up stores\'')}</Button>
          <Button variant="ghost" icon={RefreshCw} onClick={() => fetchReport()} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>{t('Refresh')}</Button>
        </>}
      />

      {message && <Alert tone={message.type === 'danger' ? 'danger' : 'warning'} className="mb-4" onClose={() => setMessage(null)}>{message.text}</Alert>}

      {phaseAlert && <Alert tone={phaseAlert.tone} icon={phaseAlert.icon} title={phaseAlert.title} className="mb-6">{phaseAlert.body}</Alert>}

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label={t('Total sales')}
          value={Number(summary.total_sales) || 0}
          format={rm}
          icon={TrendingUp}
          tone="accent"
          meta={t('{receipts} {receipts|receipt|receipts} · {items} {items|item|items} sold', { receipts: Number(summary.total_transactions) || 0, items: Number(summary.total_items_sold) || 0 })}
        />
        <KpiCard label={t('Cash')} value={Number(summary.total_cash) || 0} format={rm} icon={Banknote} tone="neutral" meta={t('Collected at the booth')} />
        <KpiCard label={t('QR / e-Wallet')} value={Number(summary.total_qr) || 0} format={rm} icon={QrCode} tone="neutral" meta={t('DuitNow QR and e-wallets')} />
        <KpiCard label={t('Card / online')} value={Number(summary.total_online) || 0} format={rm} icon={CreditCard} tone="neutral" meta={t('Card and online banking')} />
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">{t('Dates and contact')}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-caption text-ink-muted">{t('Starts')}</dt>
            <dd className="font-medium text-ink mt-0.5">{formatDateOnly(store.start_date)}</dd>
            <dd className="text-caption text-ink-secondary tabular-nums">{formatTimeOnly(store.start_date)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Ends')}</dt>
            <dd className="font-medium text-ink mt-0.5">{formatDateOnly(store.end_date)}</dd>
            <dd className="text-caption text-ink-secondary tabular-nums">{formatTimeOnly(store.end_date)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Person in charge')}</dt>
            <dd className="font-medium text-ink mt-0.5 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />{store.person_in_charge || t('HQ staff')}</dd>
            <dd className="text-caption text-ink-secondary flex items-center gap-1.5 tabular-nums"><Phone className="w-3 h-3 text-ink-muted" aria-hidden="true" />{store.contact_phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Status')}</dt>
            <dd className="mt-1"><StatusPill kind="store" value={PHASE_TO_STATUS[phase]} size="sm" /></dd>
            <dd className="text-caption text-ink-secondary mt-1">{timingText}</dd>
          </div>
        </dl>
        {store.notes && <p className="mt-4 pt-3 border-t border-line-soft text-sm text-ink-secondary"><span className="font-medium text-ink">{t('Notes:')}{' '}</span>{store.notes}</p>}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          icon={Receipt}
          title={t('Items sold')}
          description={t('{lines} {lines|line|lines} from {receipts} {receipts|receipt|receipts} · click a line to open its receipt', { lines: lines.length, receipts: Number(summary.total_transactions) || 0 })}
        />
        <Table minWidth="56rem">
          <THead>
            <TR>
              <TH>{t('Receipt')}</TH>
              <TH>{t('Item')}</TH>
              <TH numeric>{t('Qty')}</TH>
              <TH numeric>{t('Price')}</TH>
              <TH numeric>{t('Amount')}</TH>
              <TH>{t('Payment')}</TH>
              <TH className="text-right">{t('When')}</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              empty={lines.length === 0}
              emptyIcon={phase === 'before' ? Clock : phase === 'during' ? Radio : CheckCircle2}
              emptyTitle={phase === 'before' ? t('No sales yet') : phase === 'during' ? t('Waiting for the first sale') : t('No sales were recorded')}
              emptyDescription={phase === 'before'
                ? t('The event opens {start_date}.', { start_date: formatDateTime(store.start_date) })
                : phase === 'during'
                ? t('Choose this store at the Point of sale when selling, and sales appear here.')
                : t('Nothing was sold at this store.')}
            />
            {lines.map((l, i) => (
              <TR key={l.id} index={i} onClick={() => openReceipt(l.sale_id)}>
                <TD className="whitespace-nowrap">
                  <span className="font-mono text-caption font-semibold text-accent">{l.receipt_no}</span>
                  {openingId === l.sale_id && <Spinner className="w-3 h-3 ml-1.5 text-ink-muted" />}
                </TD>
                <TD className="max-w-[18rem]">
                  <div className="font-medium text-ink truncate">{l.item_name}</div>
                  <div className="font-mono text-caption text-ink-muted truncate">{l.item_code}{l.variant_text ? ` · ${l.variant_text}` : ''}</div>
                </TD>
                <TD numeric className="font-semibold">{l.quantity}</TD>
                <TD numeric className="text-ink-secondary">{rm(l.selling_price)}</TD>
                <TD numeric className="font-semibold">{rm(l.line_total)}</TD>
                <TD><StatusPill kind="payment" value={l.payment_method} size="sm" /></TD>
                <TD className="text-right text-caption text-ink-muted whitespace-nowrap">{formatDateTime(l.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {truncated && <p className="px-5 py-3 border-t border-line-soft text-caption text-ink-muted">{t('Showing the latest 500 lines. The totals above include every sale.')}</p>}
      </Card>

      {openSale && (
        <ReceiptModal onClose={() => setOpenSale(null)} closeLabel={t('Close')} closeVariant="secondary">
          <SaleReceipt sale={openSale} />
        </ReceiptModal>
      )}
    </Layout>
  );
}
