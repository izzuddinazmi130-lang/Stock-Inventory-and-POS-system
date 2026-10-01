import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, CreditCard, TrendingUp, RefreshCw, ShoppingBag, QrCode, Hash, Receipt } from 'lucide-react';
import {
  Button, Card, CardHeader, FilterBar, Input, KpiCard, PageHeader, Select, StatusPill,
  Table, THead, TBody, TH, TR, TD, TableState,
} from '../../components/ui';
import Layout from '../../components/Layout';
import api from '../../services/api';

function formatDateTime(val) {
  if (!val) return '-';
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

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}


export default function FloorReport() {
  const { id } = useParams();
  const [branch, setBranch] = useState(null);
  const [movements, setMovements] = useState([]);
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
        setMovements(reportRes.data.movements || reportRes.data.data || []);
        setSummary(reportRes.data.summary || summary);
      }
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || err.message || 'Failed to load branch floor report'
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
        breadcrumbs={[
          { label: branch?.business_name || 'Dashboard', to: '/dashboard' },
          { label: branch?.name || 'Branch', to: `/branches/${id}/stores` },
          { label: 'Shop floor sales' },
        ]}
        title="Shop floor sales"
        description={`Walk-in POS sales at ${branch?.name || 'this branch'} made outside any store event.`}
        actions={<>
          <Button variant="secondary" icon={ArrowLeft} to={`/branches/${id}/stores`}>Store events</Button>
          <Button variant="ghost" icon={RefreshCw} onClick={fetchReport} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
        </>}
      />

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={firstLoad} label="Total sales" value={Number(summary.total_sales) || 0} format={money} icon={TrendingUp} tone="accent" className="col-span-2 lg:col-span-1" />
        <KpiCard loading={firstLoad} label="Cash" value={Number(summary.total_cash) || 0} format={money} icon={Banknote} tone="neutral" />
        <KpiCard loading={firstLoad} label="QR / e-Wallet" value={Number(summary.total_qr) || 0} format={money} icon={QrCode} tone="neutral" />
        <KpiCard loading={firstLoad} label="Card / Online" value={Number(summary.total_online) || 0} format={money} icon={CreditCard} tone="neutral" />
        <KpiCard loading={firstLoad} label="Items sold" value={Number(summary.total_items_sold) || 0} icon={ShoppingBag} tone="success" />
        <KpiCard loading={firstLoad} label="Transactions" value={Number(summary.total_transactions) || 0} icon={Hash} tone="neutral" />
      </div>

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <Input type="date" className="md:w-40" aria-label="From date" value={filters.start_date} max={filters.end_date || undefined} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
        <Input type="date" className="md:w-40" aria-label="To date" value={filters.end_date} min={filters.start_date || undefined} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
        <Select wrapperClassName="md:w-44" aria-label="Payment method" value={filters.payment_method} onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))}>
          <option value="all">All payments</option>
          <option value="cash">Cash</option>
          <option value="qr">QR / e-Wallet</option>
          <option value="online_banking">Card / Online</option>
        </Select>
        <Select wrapperClassName="md:w-48" aria-label="Sort by" value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Highest amount</option>
          <option value="amount_asc">Lowest amount</option>
          <option value="qty_desc">Most items</option>
          <option value="qty_asc">Fewest items</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader icon={Receipt} title="Transactions" description={firstLoad ? 'Loading…' : `${movements.length} ${movements.length === 1 ? 'entry' : 'entries'}`} />
        <Table minWidth="44rem">
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Item</TH>
              <TH>Payment</TH>
              <TH numeric>Qty</TH>
              <TH numeric>Amount</TH>
              <TH>Served by</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={6}
              loading={firstLoad}
              error={!loading && message && movements.length === 0 ? message.text : null}
              onRetry={fetchReport}
              empty={!loading && !message && movements.length === 0}
              emptyIcon={Receipt}
              emptyTitle="No shop floor sales"
              emptyDescription={hasFilters ? 'Nothing matches these filters.' : 'Sales made at the POS without a store event appear here.'}
            />
            {movements.map((m, i) => {
              const amount = Number(m.selling_price || 0) * Number(m.quantity || 0);
              return (
                <TR key={m.id} index={i}>
                  <TD className="text-caption text-ink-muted whitespace-nowrap">{formatDateTime(m.created_at)}</TD>
                  <TD>
                    <div className="font-medium text-ink">{m.item_name || 'Unknown item'}</div>
                    <div className="font-mono text-caption text-ink-muted">{m.item_code || '-'}</div>
                  </TD>
                  <TD><StatusPill kind="payment" value={m.payment_method} size="sm" label={m.payment_method ? undefined : 'Not recorded'} /></TD>
                  <TD numeric className="font-semibold">{m.quantity}</TD>
                  <TD numeric className="font-semibold">{money(amount)}</TD>
                  <TD className="text-ink-secondary">{m.performed_by_name || 'System'}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </Layout>
  );
}
