import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, CreditCard, Banknote, MapPin, Calendar, ArrowLeft, Clock, CheckCircle2, Phone, User, Radio, TrendingUp, Receipt } from 'lucide-react';
import {
  Alert, Button, Card, CardHeader, ErrorState, KpiCard, PageHeader, Skeleton, SkeletonKpi, StatusPill,
  Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../components/ui';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-MY', {
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
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTimeOnly(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleTimeString('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function getStorePhase(store) {
  if (!store) return 'before';
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

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
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (phase === 'before') {
    const diffMs = sTime - now;
    if (diffMs <= 0) return 'Starts shortly';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return `Starts in ${days} day${days > 1 ? 's' : ''}${remHours > 0 ? `, ${remHours}h` : ''}`;
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return `Starts in ${hours}h ${mins % 60}m`;
    return `Starts in ${Math.max(1, mins)} min${mins !== 1 ? 's' : ''}`;
  }

  if (phase === 'during') {
    const diffMs = eTime - now;
    if (diffMs <= 0) return 'Ending now';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return `Closes in ${days}d ${remHours}h`;
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return `Ends in ${hours}h ${mins % 60}m`;
    return `Ends in ${Math.max(1, mins)} mins`;
  }

  // Phase is 'after'
  if (store.ended_at || eTime > 0) {
    const closedTime = store.ended_at ? new Date(store.ended_at).getTime() : eTime;
    const diffMs = now - closedTime;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0) return `Concluded ${days} day${days > 1 ? 's' : ''} ago`;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return `Concluded ${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Recently concluded';
  }

  return 'Concluded';
}

export default function StoreReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [store, setStore] = useState(null);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ total_cash: 0, total_online: 0, total_sales: 0, total_items_sold: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setMessage(null);

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
        const errMsg = storeErr.response?.data?.message || storeErr.message || 'Failed to fetch store details';
        setMessage({ type: 'danger', text: errMsg });
        return;
      }

      // 2. Fetch report movements & transactions
      try {
        const repRes = await api.get(`/stores/${id}/report`);
        if (repRes.data.success) {
          setMovements(repRes.data.movements || repRes.data.data || []);
          if (repRes.data.summary) setSummary(repRes.data.summary);
        }
      } catch (repErr) {
        console.warn('Store movements fetch warning:', repErr);
        const repErrMsg = repErr.response?.data?.message || repErr.message || 'Could not load transaction breakdown';
        setMessage({ type: 'warning', text: repErrMsg });
      }
    } catch (err) {
      console.error('Unexpected error fetching report:', err);
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message || 'An error occurred while loading the report' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const phase = getStorePhase(store);
  const timingText = getTimingStatusText(store, phase);

  const PHASE_TO_STATUS = { during: 'active', before: 'upcoming', after: 'ended' };
  const backTo = store ? `/branches/${store.branch_id}/stores` : (isSuperAdmin ? '/businesses' : `/branches/${user?.branch_id}/stores`);

  if (loading && !store) {
    return (
      <Layout>
        <Skeleton className="h-4 w-64 mb-3" />
        <Skeleton className="h-8 w-80 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">{[0, 1, 2].map(i => <SkeletonKpi key={i} />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </Layout>
    );
  }

  if (!store) {
    return (
      <Layout>
        <Card>
          <ErrorState
            title="Store event not found"
            description={message?.text || `Store event #${id} may have been removed, or you don't have access to it.`}
            onRetry={fetchReport}
          />
          <div className="flex justify-center pb-8 -mt-6">
            <Button variant="ghost" icon={ArrowLeft} to={backTo}>{isSuperAdmin ? 'Businesses' : 'My store events'}</Button>
          </div>
        </Card>
      </Layout>
    );
  }

  const phaseAlert = {
    before: { tone: 'warning', icon: Clock, title: `Not live yet · ${timingText}`, body: <>Opens <strong>{formatDateTime(store.start_date)}</strong> and runs until <strong>{formatDateTime(store.end_date)}</strong>. Sales will appear here once it starts.</> },
    during: { tone: 'success', icon: Radio, title: `Live now · ${timingText}`, body: <>Sales at this event are being recorded until <strong>{formatDateTime(store.end_date)}</strong>. The numbers below update as you sell.</> },
    after: { tone: 'info', icon: CheckCircle2, title: 'Final report', body: <>This event ended <strong>{formatDateTime(store.ended_at || store.end_date)}</strong>. The numbers below are final.</> },
  }[phase];

  return (
    <Layout>
      <PageHeader
        breadcrumbs={[
          ...(isSuperAdmin ? [{ label: 'Businesses', to: '/businesses' }, { label: store.business_name || 'Business', to: `/businesses/${store.business_id}/branches` }] : [{ label: store.business_name || 'Business' }]),
          { label: store.branch_name || 'Branch', to: isSuperAdmin ? `/branches/${store.branch_id}` : undefined },
          { label: 'Store events', to: `/branches/${store.branch_id}/stores` },
          { label: store.name },
        ]}
        title={store.name}
        meta={<>
          <StatusPill kind="store" value={PHASE_TO_STATUS[phase]} />
          {store.venue && <span className="inline-flex items-center gap-1.5 text-caption text-ink-secondary"><MapPin className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />{store.venue}</span>}
          <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted tabular-nums"><Calendar className="w-3.5 h-3.5" aria-hidden="true" />{formatDateTime(store.start_date)} → {formatDateTime(store.end_date)}</span>
        </>}
        actions={<>
          <Button variant="secondary" icon={ArrowLeft} to={`/branches/${store.branch_id}/stores`}>Store events</Button>
          <Button variant="ghost" icon={RefreshCw} onClick={fetchReport} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
        </>}
      />

      {message && <Alert tone={message.type === 'danger' ? 'danger' : 'warning'} className="mb-4" onClose={() => setMessage(null)}>{message.text}</Alert>}

      {phaseAlert && <Alert tone={phaseAlert.tone} icon={phaseAlert.icon} title={phaseAlert.title} className="mb-6">{phaseAlert.body}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Revenue" value={Number(summary.total_sales) || 0} format={v => `RM ${v.toFixed(2)}`} icon={TrendingUp} tone="accent" meta={`${summary.total_items_sold || movements.length} items sold`} />
        <KpiCard label="Cash" value={Number(summary.total_cash) || 0} format={v => `RM ${v.toFixed(2)}`} icon={Banknote} tone="neutral" meta="Collected at the booth" />
        <KpiCard label="QR / online" value={Number(summary.total_online) || 0} format={v => `RM ${v.toFixed(2)}`} icon={CreditCard} tone="neutral" meta="e-Wallet and card" />
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Schedule and contact</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-caption text-ink-muted">Starts</dt>
            <dd className="font-medium text-ink mt-0.5">{formatDateOnly(store.start_date)}</dd>
            <dd className="text-caption text-ink-secondary tabular-nums">{formatTimeOnly(store.start_date)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Ends</dt>
            <dd className="font-medium text-ink mt-0.5">{formatDateOnly(store.end_date)}</dd>
            <dd className="text-caption text-ink-secondary tabular-nums">{formatTimeOnly(store.end_date)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Person in charge</dt>
            <dd className="font-medium text-ink mt-0.5 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />{store.person_in_charge || 'HQ staff'}</dd>
            <dd className="text-caption text-ink-secondary flex items-center gap-1.5 tabular-nums"><Phone className="w-3 h-3 text-ink-muted" aria-hidden="true" />{store.contact_phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Status</dt>
            <dd className="mt-1"><StatusPill kind="store" value={PHASE_TO_STATUS[phase]} size="sm" /></dd>
            <dd className="text-caption text-ink-secondary mt-1">{timingText}</dd>
          </div>
        </dl>
        {store.notes && <p className="mt-4 pt-3 border-t border-line-soft text-sm text-ink-secondary"><span className="font-medium text-ink">Notes: </span>{store.notes}</p>}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader icon={Receipt} title="Sales and stock movements" description={`${movements.length} ${movements.length === 1 ? 'entry' : 'entries'}`} />
        <Table minWidth="54rem">
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>Category</TH>
              <TH>Type</TH>
              <TH numeric>Qty</TH>
              <TH>Payment</TH>
              <TH>Note</TH>
              <TH className="text-right">When</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              empty={!movements || movements.length === 0}
              emptyIcon={phase === 'before' ? Clock : phase === 'during' ? Radio : CheckCircle2}
              emptyTitle={phase === 'before' ? 'No sales yet' : phase === 'during' ? 'Waiting for the first sale' : 'No sales were recorded'}
              emptyDescription={phase === 'before'
                ? `The event opens ${formatDateTime(store.start_date)}.`
                : phase === 'during'
                ? 'Sell at the Point of Sale with this event selected and it appears here.'
                : 'Nothing was sold or moved during this event.'}
            />
            {movements.map((m, i) => (
              <TR key={m.id} index={i}>
                <TD>
                  <div className="font-medium text-ink">{m.item_name}</div>
                  <div className="font-mono text-caption text-ink-muted">{m.item_code}</div>
                </TD>
                <TD className="text-ink-secondary">{m.category || 'General'}</TD>
                <TD><StatusPill kind="movement" value={m.movement_type} size="sm" /></TD>
                <TD numeric className={cn('font-semibold', m.movement_type === 'in' && 'text-success-fg')}>{m.quantity}</TD>
                <TD>{m.payment_method ? <StatusPill kind="payment" value={m.payment_method} size="sm" /> : <span className="text-ink-muted">—</span>}</TD>
                <TD className="max-w-[14rem] truncate text-ink-secondary">{m.note || 'Store sale'}</TD>
                <TD className="text-right text-caption text-ink-muted whitespace-nowrap">{formatDateTime(m.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </Layout>
  );
}
