import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, CreditCard, TrendingUp, RefreshCw, ShoppingBag, QrCode, Hash, Receipt } from 'lucide-react';
import {
  Button, Card, CardHeader, FilterBar, Input, KpiCard, PageHeader, Select, Spinner, StatusPill,
  Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SaleReceipt, ReceiptModal } from '../../components/pos/Receipt';
import { t, locale } from '../../i18n';

function formatDateTime(val) {
  if (!val) return '-';
  // "2026-10-04 09:00:00" → ISO-like, so Safari (iPhone) can read it too
  const d = new Date(typeof val === 'string' ? val.replace(' ', 'T') : val);
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

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}


export default function FloorReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [branch, setBranch] = useState(null);
  const [movements, setMovements] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [openSale, setOpenSale] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const openReceipt = async (saleId) => {
    try {
      setOpeningId(saleId);
      const res = await api.get(`/sales/${saleId}`);
      if (res.data.success) setOpenSale(res.data.sale);
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || t('Could not open that receipt.') });
    } finally {
      setOpeningId(null);
    }
  };
  const [summary, setSummary] = useState({
    total_cash: 0,
    total_qr: 0,
    total_online: 0,
    total_sales: 0,
    total_items_sold: 0,
    total_transactions: 0
  });
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    payment_method: 'all',
    sort: 'date_desc'
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const [branchRes, reportRes] = await Promise.all([
        api.get(`/branches/${id}`),
        api.get(`/branches/${id}/floor-report`, {
          params: {
            start_date: filters.start_date || undefined,
            end_date: filters.end_date || undefined,
            payment_method: filters.payment_method,
            sort: filters.sort
          }
        })
      ]);

      if (branchRes.data.success) {
        setBranch(branchRes.data.branch || branchRes.data.data);
      }
      if (reportRes.data.success) {
        setMovements(reportRes.data.lines || reportRes.data.movements || []);
        setTruncated(Boolean(reportRes.data.truncated));
        setSummary(reportRes.data.summary || summary);
      }
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || err.message || t('Failed to load branch floor report')
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id, filters.start_date, filters.end_date, filters.payment_method, filters.sort]);

  const firstLoad = loading && movements.length === 0;
  const hasFilters = Boolean(filters.start_date || filters.end_date || filters.payment_method !== 'all' || filters.sort !== 'date_desc');
  const resetFilters = () => setFilters({ start_date: '', end_date: '', payment_method: 'all', sort: 'date_desc' });

  return (
    <Layout>
      <PageHeader
        breadcrumbs={isSuperAdmin
          ? [
            { label: t('Businesses'), to: '/businesses' },
            { label: branch?.business_name || t('Business'), to: branch ? `/businesses/${branch.business_id}/branches` : undefined },
            { label: branch?.name || t('Branch'), to: `/branches/${id}` },
            { label: t('Pop-up stores'), to: `/branches/${id}/stores` },
            { label: t('Branch counter sales') },
          ]
          : [{ label: t('Pop-up stores'), to: `/branches/${id}/stores` }, { label: t('Branch counter sales') }]}
        title={t('Branch counter sales')}
        description={t('Sales made at {name} itself, not at a pop-up store.', { name: branch?.name || t('this branch') })}
        actions={<>
          <Button variant="secondary" icon={ArrowLeft} to={`/branches/${id}/stores`}>{t('Pop-up stores')}</Button>
          <Button variant="ghost" icon={RefreshCw} onClick={fetchReport} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>{t('Refresh')}</Button>
        </>}
      />

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={firstLoad} label={t('Total sales')} value={Number(summary.total_sales) || 0} format={money} icon={TrendingUp} tone="accent" className="col-span-2 lg:col-span-1" />
        <KpiCard loading={firstLoad} label={t('Cash')} value={Number(summary.total_cash) || 0} format={money} icon={Banknote} tone="neutral" />
        <KpiCard loading={firstLoad} label={t('QR / e-Wallet')} value={Number(summary.total_qr) || 0} format={money} icon={QrCode} tone="neutral" />
        <KpiCard loading={firstLoad} label={t('Card / Online')} value={Number(summary.total_online) || 0} format={money} icon={CreditCard} tone="neutral" />
        <KpiCard loading={firstLoad} label={t('Items sold')} value={Number(summary.total_items_sold) || 0} icon={ShoppingBag} tone="success" />
        <KpiCard loading={firstLoad} label={t('Receipts')} value={Number(summary.total_transactions) || 0} icon={Hash} tone="neutral" />
      </div>

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <Input type="date" className="md:w-40" aria-label={t('From date')} value={filters.start_date} max={filters.end_date || undefined} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
        <Input type="date" className="md:w-40" aria-label={t('To date')} value={filters.end_date} min={filters.start_date || undefined} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
        <Select wrapperClassName="md:w-44" aria-label={t('Payment method')} value={filters.payment_method} onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))}>
          <option value="all">{t('All payments')}</option>
          <option value="cash">{t('Cash')}</option>
          <option value="qr">{t('QR / e-Wallet')}</option>
          <option value="online_banking">{t('Card / Online')}</option>
        </Select>
        <Select wrapperClassName="md:w-48" aria-label={t('Sort by')} value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}>
          <option value="date_desc">{t('Newest first')}</option>
          <option value="date_asc">{t('Oldest first')}</option>
          <option value="amount_desc">{t('Highest amount')}</option>
          <option value="amount_asc">{t('Lowest amount')}</option>
          <option value="qty_desc">{t('Most items')}</option>
          <option value="qty_asc">{t('Fewest items')}</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader icon={Receipt} title={t('Items sold')} description={firstLoad ? t('Loading…') : t('{length} {length|line|lines} · click a line to open its receipt', { length: movements.length })} />
        <Table minWidth="52rem">
          <THead>
            <TR>
              <TH>{t('When')}</TH>
              <TH>{t('Receipt')}</TH>
              <TH>{t('Item')}</TH>
              <TH>{t('Payment')}</TH>
              <TH numeric>{t('Qty')}</TH>
              <TH numeric>{t('Amount')}</TH>
              <TH>{t('Served by')}</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              loading={firstLoad}
              error={!loading && message && movements.length === 0 ? message.text : null}
              onRetry={fetchReport}
              empty={!loading && !message && movements.length === 0}
              emptyIcon={Receipt}
              emptyTitle={t('No branch counter sales')}
              emptyDescription={hasFilters ? t('Nothing matches these filters.') : t('Sales made at the branch (not at a pop-up store) appear here.')}
            />
            {movements.map((m, i) => {
              const amount = m.line_total ?? Number(m.selling_price || 0) * Number(m.quantity || 0);
              return (
                <TR key={m.id} index={i} onClick={() => openReceipt(m.sale_id)}>
                  <TD className="text-caption text-ink-muted whitespace-nowrap">{formatDateTime(m.created_at)}</TD>
                  <TD className="whitespace-nowrap">
                    <span className="font-mono text-caption font-semibold text-accent">{m.receipt_no}</span>
                    {openingId === m.sale_id && <Spinner className="w-3 h-3 ml-1.5 text-ink-muted" />}
                  </TD>
                  <TD>
                    <div className="font-medium text-ink">{m.item_name || t('Unknown item')}</div>
                    <div className="font-mono text-caption text-ink-muted">{m.item_code || '-'}</div>
                  </TD>
                  <TD><StatusPill kind="payment" value={m.payment_method} size="sm" label={m.payment_method ? undefined : t('Not recorded')} /></TD>
                  <TD numeric className="font-semibold">{m.quantity}</TD>
                  <TD numeric className="font-semibold">{money(amount)}</TD>
                  <TD className="text-ink-secondary">{m.performed_by_name || t('System')}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {truncated && <p className="px-5 py-3 border-t border-line-soft text-caption text-ink-muted">{t('Showing 500 lines. The totals above include every matching sale.')}</p>}
      </Card>

      {openSale && (
        <ReceiptModal onClose={() => setOpenSale(null)} closeLabel={t('Close')} closeVariant="secondary">
          <SaleReceipt sale={openSale} />
        </ReceiptModal>
      )}
    </Layout>
  );
}
