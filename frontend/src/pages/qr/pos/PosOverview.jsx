import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Activity, Building2, BarChart3, Package, History, RefreshCw, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import {
  Alert, Button, Card, CardHeader, KpiCard, PageHeader, Select, StatusPill, Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../../components/ui';

const QUICK_LINKS = [
  { to: '/reports', icon: BarChart3, title: 'Stock movements', text: 'Full history of sales, restocks and transfers' },
  { to: '/products', icon: Package, title: 'Branch inventory', text: 'Stock balances in every location' },
  { to: '/businesses', icon: Building2, title: 'Businesses & branches', text: 'Branches, pop-up stores and outlets' },
  { to: '/audit', icon: History, title: 'Audit log', text: 'Who did what, and when' },
];

/**
 * Super admin view of the POS page: head office monitors branch transactions, it doesn't ring up sales
 * (the POS itself is operated by branch admins).
 */
export default function PosOverview({ Wrap }) {
  const [adminBranches, setAdminBranches] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [summaryStats, setSummaryStats] = useState({ total_transactions: 0, stock_in_qty: 0, stock_out_qty: 0 });
  const [filterBranchId, setFilterBranchId] = useState('all');
  const [filterMovementType, setFilterMovementType] = useState('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [branchRes, reportRes, summaryRes] = await Promise.all([
        api.get('/branches'),
        api.get('/reports/movement', {
          params: {
            branch_id: filterBranchId !== 'all' ? filterBranchId : undefined,
            movement_type: filterMovementType !== 'all' ? filterMovementType : undefined
          }
        }),
        api.get('/reports/summary')
      ]);
      if (branchRes.data.success) setAdminBranches(branchRes.data.branches || branchRes.data.data || []);
      if (reportRes.data.success) setRecentMovements(reportRes.data.movements || []);
      if (summaryRes.data.success && summaryRes.data.data) setSummaryStats(summaryRes.data.data);
    } catch (err) {
      console.error('Super admin stream error:', err);
      setLoadError(err.response?.data?.message || 'Could not load branch transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterMovementType]);

  const firstLoad = loading && recentMovements.length === 0;

  return (
    <Wrap>
      <PageHeader
        title="Point of sale overview"
        description="Head office view of branch sales and stock movements as they happen."
        actions={<>
          <Button variant="ghost" icon={RefreshCw} onClick={fetchData} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
          <Button icon={BarChart3} to="/reports">Full reports</Button>
        </>}
      />

      <Alert tone="info" icon={ShieldAlert} title="Sales are rung up by branch admins" className="mb-6">
        Scanning, checkout and receiving stock happen on the branch POS. Here you can watch what every branch is doing.
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard loading={firstLoad} label="Transactions" value={Number(summaryStats.total_transactions) || 0} icon={Activity} tone="accent" meta="All branches" />
        <KpiCard loading={firstLoad} label="Stock out" value={Number(summaryStats.stock_out_qty) || 0} icon={ArrowUpFromLine} tone="info" meta="Units sold or taken out" />
        <KpiCard loading={firstLoad} label="Stock in" value={Number(summaryStats.stock_in_qty) || 0} icon={ArrowDownToLine} tone="success" meta="Units received" />
        <KpiCard loading={firstLoad} label="Branches" value={adminBranches.length} icon={Building2} tone="neutral" meta="Configured outlets" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {QUICK_LINKS.map(link => (
          <Card key={link.to} as={Link} to={link.to} interactive className="p-4 flex items-start gap-3 group">
            <span className="w-9 h-9 rounded-lg bg-sunken text-ink-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-accent-soft group-hover:text-accent transition-colors">
              <link.icon className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-semibold text-ink">{link.title}<ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" aria-hidden="true" /></span>
              <span className="block text-caption font-normal text-ink-muted mt-0.5">{link.text}</span>
            </span>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Branch transactions"
          description="Latest POS checkouts and stock intakes"
          actions={<>
            <Select size="sm" aria-label="Branch" value={filterBranchId} onChange={e => setFilterBranchId(e.target.value)} wrapperClassName="w-48">
              <option value="all">All branches</option>
              {adminBranches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Business'})</option>)}
            </Select>
            <Select size="sm" aria-label="Movement type" value={filterMovementType} onChange={e => setFilterMovementType(e.target.value)} wrapperClassName="w-40">
              <option value="all">All types</option>
              <option value="out">Sales / stock out</option>
              <option value="in">Stock in</option>
              <option value="adjust">Adjustments</option>
            </Select>
          </>}
        />
        <Table minWidth="56rem">
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Branch</TH>
              <TH>Product</TH>
              <TH>Type</TH>
              <TH numeric>Qty</TH>
              <TH numeric>Price</TH>
              <TH>By</TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              loading={firstLoad}
              error={!loading && loadError && recentMovements.length === 0 ? loadError : null}
              onRetry={fetchData}
              empty={!loading && !loadError && recentMovements.length === 0}
              emptyIcon={Activity}
              emptyTitle="No transactions for this filter"
            />
            {recentMovements.map((m, i) => {
              const isIn = m.movement_type === 'in';
              const d = new Date(m.created_at);
              return (
                <TR key={m.id} index={i}>
                  <TD className="text-caption text-ink-muted whitespace-nowrap tabular-nums">{d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} · {d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</TD>
                  <TD>
                    <div className="text-sm text-ink">{m.branch_name}</div>
                    <div className="text-caption text-ink-muted">{m.business_name}</div>
                  </TD>
                  <TD>
                    <div className="text-sm font-medium text-ink">{m.item_name}</div>
                    <div className="font-mono text-caption text-ink-muted">{m.item_code}</div>
                  </TD>
                  <TD><StatusPill kind="movement" value={m.movement_type} size="sm" /></TD>
                  <TD numeric className={cn('font-semibold', isIn && 'text-success-fg')}>{isIn ? `+${m.quantity}` : `−${m.quantity}`}</TD>
                  <TD numeric>{m.selling_price ? `RM ${parseFloat(m.selling_price).toFixed(2)}` : '—'}</TD>
                  <TD className="text-ink-secondary">{m.performed_by_name || 'Admin'}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </Wrap>
  );
}
