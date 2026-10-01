import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useSocket } from '../../context/SocketContext';
import { PackageMinus, PackageX, PackagePlus, PackageCheck, ArrowRight } from 'lucide-react';
import {
  Button, Card, FilterBar, KpiCard, PageHeader, SearchInput, Select, StatusPill, Tabs,
  Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../components/ui';

const TABS = [
  { value: 'all', label: 'All alerts' },
  { value: 'out', label: 'Out of stock' },
  { value: 'low', label: 'Running low' },
];


// Builds the Point of Sale hand-off link: /qr/scan?receive=<productId>:<qty>,...
const receiveLink = (rows) => `/qr/scan?receive=${rows.map(r => `${r.id}:${r.suggested_restock}`).join(',')}`;

export default function LowStock() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const { businesses = [] } = useBusiness() || {};
  const { socket } = useSocket() || {};
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ out: 0, low: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/branches').then(res => { if (res.data.success) setBranches(res.data.branches || []); }).catch(() => {});
  }, [isSuperAdmin]);

  const branchOptions = useMemo(
    () => (businessId ? branches.filter(b => String(b.business_id) === String(businessId)) : branches),
    [branches, businessId]
  );

  const load = useCallback(async () => {
    try {
      setError('');
      const params = {};
      if (isSuperAdmin && businessId) params.business_id = businessId;
      if (isSuperAdmin && branchId) params.branch_id = branchId;
      const res = await api.get('/products/low-stock', { params });
      if (res.data.success) {
        setItems(res.data.items || []);
        setCounts(res.data.counts || { out: 0, low: 0, total: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load low-stock products.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, businessId, branchId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Stock changes anywhere (sales, restocks, adjustments) refresh the list
  useEffect(() => {
    if (!socket) return;
    socket.on('inventory_updated', load);
    return () => socket.off('inventory_updated', load);
  }, [socket, load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (tab !== 'all' && i.stock_status !== tab) return false;
      if (!q) return true;
      return [i.name, i.sku, i.category, i.size, i.branch_name].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [items, tab, search]);

  const tabCount = { all: counts.total, out: counts.out, low: counts.low };

  const hasFilters = Boolean(search || businessId || branchId || tab !== 'all');
  const resetFilters = () => { setSearch(''); setBusinessId(''); setBranchId(''); setTab('all'); };

  return (
    <Layout>
      <PageHeader
        title="Low stock"
        description={`Products at or below their “alert at” level${isSuperAdmin ? ' in each branch' : ''}. Restock them before customers find the shelf empty.`}
        actions={!isSuperAdmin && shown.length > 0 && (
          <Button variant="success" icon={PackagePlus} onClick={() => navigate(receiveLink(shown))}>
            Restock {shown.length === 1 ? 'this item' : `all ${shown.length}`}
          </Button>
        )}
      />

      <div className="kpi-grid grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={loading && items.length === 0} label="Out of stock" value={counts.out} icon={PackageX} tone="danger" meta="Can't be sold right now" onClick={() => setTab('out')} className={cn(tab === 'out' && 'ring-1 ring-danger-line border-danger-line')} />
        <KpiCard loading={loading && items.length === 0} label="Running low" value={counts.low} icon={PackageMinus} tone="warning" meta="At or below the alert level" onClick={() => setTab('low')} className={cn(tab === 'low' && 'ring-1 ring-warning-line border-warning-line')} />
      </div>

      <FilterBar onReset={resetFilters} resetVisible={hasFilters}>
        <SearchInput wrapperClassName="md:flex-1 md:min-w-[16rem]" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, size or category…" aria-label="Search low-stock products" />
        {isSuperAdmin && (
          <>
            <Select wrapperClassName="md:w-44" aria-label="Business" value={businessId} onChange={e => { setBusinessId(e.target.value); setBranchId(''); }}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select wrapperClassName="md:w-44" aria-label="Branch" value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </>
        )}
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-5 pt-3 border-b border-line-soft">
          <Tabs
            label="Alert type"
            value={tab}
            onChange={setTab}
            className="border-b-0"
            tabs={TABS.map(t => ({ ...t, count: tabCount[t.value] }))}
          />
        </div>
        <Table minWidth={isSuperAdmin ? '52rem' : '44rem'}>
          <THead>
            <TR>
              <TH>Product</TH>
              {isSuperAdmin && <TH>Branch</TH>}
              <TH>In stock</TH>
              <TH numeric>Alert at</TH>
              <TH numeric>Suggested restock</TH>
              <TH className="w-px"><span className="sr-only">Action</span></TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={isSuperAdmin ? 6 : 5}
              loading={loading && items.length === 0}
              error={!loading && error && items.length === 0 ? error : null}
              onRetry={load}
              empty={!loading && !error && shown.length === 0}
              emptyIcon={PackageCheck}
              emptyTitle={items.length === 0 ? 'All stocked up' : 'Nothing matches'}
              emptyDescription={items.length === 0 ? 'No product is at or below its alert level.' : 'Try another tab or clear the search.'}
            />
            {shown.map((i, idx) => (
              <TR key={`${i.id}-${i.branch_id}`} index={idx}>
                <TD>
                  <p className="font-medium text-ink">{i.name}</p>
                  <p className="text-caption text-ink-muted">
                    <span className="font-mono">{i.sku}</span>
                    {i.size && <> · Size {i.size}</>}
                    {i.category && <> · {i.category}</>}
                  </p>
                </TD>
                {isSuperAdmin && <TD className="text-ink-secondary whitespace-nowrap">{i.branch_name}</TD>}
                <TD className="whitespace-nowrap">
                  <StatusPill kind="stock" value={i.stock_status} size="sm" label={i.stock_status === 'out' ? 'Out of stock' : `${i.quantity} left`} />
                </TD>
                <TD numeric className="text-ink-secondary">{i.min_quantity}</TD>
                <TD numeric className="font-semibold text-ink">+{i.suggested_restock}</TD>
                <TD className="text-right whitespace-nowrap">
                  {isSuperAdmin ? (
                    <Button variant="ghost" size="sm" iconRight={ArrowRight} to={`/products?search=${encodeURIComponent(i.sku)}`}>View product</Button>
                  ) : (
                    <Button variant="secondary" size="sm" icon={PackagePlus} to={receiveLink([i])}>Restock</Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {!isSuperAdmin && shown.length > 0 && (
        <p className="text-caption text-ink-muted mt-3">
          “Restock” opens the point of sale in <strong className="font-medium text-ink-secondary">Receive stock</strong> mode with the suggested quantity filled in. Change it to what actually arrived, then confirm.
          The suggestion brings stock back to twice the alert level. Change the alert level in <Link to="/products" className="text-accent font-medium hover:underline">Products</Link>.
        </p>
      )}
    </Layout>
  );
}
