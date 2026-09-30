import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useBusiness } from '../../context/BusinessContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Package, History, PackageMinus, UserCheck, RefreshCw, Building2, Store, Sparkles, ScanLine, ArrowRight, PackageCheck, X } from 'lucide-react';
import {
  Button, Card, CardHeader, KpiCard, PageHeader, StatusPill, Badge, BusinessDot, EmptyState, ErrorState,
  Table, THead, TBody, TH, TR, TD, TableState, Skeleton, cn, focusRing,
} from '../../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const { socket } = useSocket();
  const { selectedBusiness, setSelectedBusiness } = useBusiness();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [freshIds, setFreshIds] = useState(() => new Set());
  const seenIds = React.useRef(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalStock: 0,
    lowStockCount: 0
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [businessCount, setBusinessCount] = useState(0);
  const [branchCount, setBranchCount] = useState(0);
  const [recentMovements, setRecentMovements] = useState([]);
  
  // Scoped and global products
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [allBranches, setAllBranches] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');

      if (isSuperAdmin) {
        const scopedParams = {};
        if (selectedBusiness?.id) scopedParams.business_id = selectedBusiness.id;

        const [prodRes, movRes, allProdRes, bizRes, branchRes, userRes] = await Promise.all([
          api.get('/products', { params: scopedParams }),
          api.get('/reports/movement', { params: scopedParams }),
          api.get('/products'),
          api.get('/businesses'),
          api.get('/branches'),
          api.get('/users/pending').catch(() => ({ data: { success: false, pendingUsers: [] } }))
        ]);

        if (prodRes.data.success) {
          setStats(prodRes.data.stats || { totalItems: 0, totalStock: 0, lowStockCount: 0 });
          setProducts(prodRes.data.items || []);
        }

        if (movRes.data.success) {
          setRecentMovements(movRes.data.movements.slice(0, 8));
        }

        if (allProdRes.data.success) {
          setAllProducts(allProdRes.data.items || []);
        }

        if (bizRes.data.success) {
          const bList = bizRes.data.businesses || bizRes.data.data || [];
          setAllBusinesses(bList);
          setBusinessCount(bList.length);
        }

        if (branchRes.data.success) {
          const brList = branchRes.data.branches || branchRes.data.data || [];
          setAllBranches(brList);
          setBranchCount(brList.length);
        }

        if (userRes.data?.success) {
          setPendingCount(userRes.data.pendingUsers?.length || 0);
        }
      } else {
        // Branch Admin: strictly fetch their branch's scoped items and movements
        const [prodRes, movRes] = await Promise.all([
          api.get('/products'),
          api.get('/reports/movement')
        ]);

        if (prodRes.data.success) {
          setStats(prodRes.data.stats || { totalItems: 0, totalStock: 0, lowStockCount: 0 });
          setProducts(prodRes.data.items || []);
        }

        if (movRes.data.success) {
          setRecentMovements((movRes.data.movements || []).slice(0, 8));
        }

        // Clear out unscoped business/branch arrays
        setAllProducts([]);
        setAllBusinesses([]);
        setAllBranches([]);
        setBusinessCount(0);
        setBranchCount(0);
        setPendingCount(0);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      setLoadError(err.response?.data?.message || 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedBusiness]);

  useEffect(() => {
    if (!socket) return;
    const handleLiveEvent = (data) => {
      console.log('⚡ Real-time dashboard update:', data);
      fetchData();
    };

    socket.on('inventory_updated', handleLiveEvent);
    socket.on('product_deleted', handleLiveEvent);
    socket.on('damage_reported', handleLiveEvent);
    socket.on('business_updated', handleLiveEvent);
    socket.on('branch_updated', handleLiveEvent);

    return () => {
      socket.off('inventory_updated', handleLiveEvent);
      socket.off('product_deleted', handleLiveEvent);
      socket.off('damage_reported', handleLiveEvent);
      socket.off('business_updated', handleLiveEvent);
      socket.off('branch_updated', handleLiveEvent);
    };
  }, [socket, selectedBusiness]);

  // Rows that arrived since the last load (live updates) get a brief highlight
  useEffect(() => {
    const ids = recentMovements.map(m => m.id);
    if (seenIds.current) setFreshIds(new Set(ids.filter(id => !seenIds.current.has(id))));
    seenIds.current = new Set(ids);
  }, [recentMovements]);

  // Derived metrics (stock level per branch row comes from the server's stock_status)
  const lowStockProducts = products
    .filter(p => (p.stock_status ? p.stock_status !== 'ok' : parseInt(p.quantity) <= parseInt(p.minimum_quantity ?? p.min_quantity ?? 0)))
    .slice(0, 5);
  const firstLoad = loading && recentMovements.length === 0 && products.length === 0;

  const scopeName = isSuperAdmin ? (selectedBusiness?.name || 'all businesses') : (user?.branch_name || 'this branch');

  return (
    <Layout>
      <PageHeader
        title={isSuperAdmin ? (selectedBusiness ? `${selectedBusiness.name} overview` : 'Overview') : `${user?.branch_name || 'My branch'} overview`}
        description={isSuperAdmin ? 'Stock, alerts and activity across every business and branch.' : 'Stock, alerts and recent activity in your branch.'}
        meta={isSuperAdmin && selectedBusiness ? (
          <Badge tone="accent" dot>
            Filtered: {selectedBusiness.name}
            <button type="button" onClick={() => setSelectedBusiness(null)} className={cn('-mr-1 ml-0.5 rounded-full p-0.5 hover:bg-accent-muted', focusRing)} aria-label="Clear business filter">
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </Badge>
        ) : null}
        actions={<>
          <Button variant="ghost" icon={RefreshCw} onClick={fetchData} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
          <Button variant="secondary" icon={ScanLine} to="/qr/scan">{isSuperAdmin ? 'POS overview' : 'Open point of sale'}</Button>
        </>}
      />

      {loadError && recentMovements.length === 0 && products.length === 0 ? (
        <Card><ErrorState description={loadError} onRetry={fetchData} /></Card>
      ) : (
      <>
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6', isSuperAdmin ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-3')}>
        {isSuperAdmin ? (
          <>
            <KpiCard loading={firstLoad} label="Businesses" value={businessCount} meta="Registered" icon={Building2} tone="neutral" to="/businesses" />
            <KpiCard loading={firstLoad} label="Branches" value={branchCount} meta="Across all businesses" icon={Store} tone="info" />
            <KpiCard loading={firstLoad} label="Products" value={stats.totalItems} meta={`In ${scopeName}`} icon={Package} tone="accent" to="/products" />
            <KpiCard loading={firstLoad} label="Low stock" value={stats.lowStockCount} meta={stats.lowStockCount > 0 ? 'Need restocking' : 'All healthy'} metaTone={stats.lowStockCount > 0 ? 'danger' : 'success'} icon={PackageMinus} tone={stats.lowStockCount > 0 ? 'warning' : 'success'} to="/low-stock" />
            <KpiCard loading={firstLoad} label="New arrivals" value={stats.newArrivals || 0} meta="Marked as new" icon={Sparkles} tone="violet" />
          </>
        ) : (
          <>
            <KpiCard loading={firstLoad} label="Products" value={stats.totalItems} meta="Stocked in this branch" icon={Package} tone="accent" to="/products" />
            <KpiCard loading={firstLoad} label="Low stock" value={stats.lowStockCount} meta={stats.lowStockCount > 0 ? 'Need restocking' : 'All healthy'} metaTone={stats.lowStockCount > 0 ? 'danger' : 'success'} icon={PackageMinus} tone={stats.lowStockCount > 0 ? 'warning' : 'success'} to="/low-stock" />
            <KpiCard loading={firstLoad} label="New arrivals" value={stats.newArrivals || 0} meta="Marked as new" icon={Sparkles} tone="violet" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Card className="overflow-hidden">
          <CardHeader
            icon={History}
            title="Recent stock movements"
            description="Latest sales, restocks, adjustments and damage."
            actions={<Button variant="ghost" size="sm" iconRight={ArrowRight} to="/reports/movement">View all</Button>}
          />
          <Table minWidth="36rem">
            <THead>
              <TR>
                <TH>Product</TH>
                <TH>Type</TH>
                <TH numeric>Qty</TH>
                <TH className="text-right">When</TH>
              </TR>
            </THead>
            <TBody>
              <TableState
                colSpan={4}
                loading={firstLoad}
                empty={!loading && recentMovements.length === 0}
                emptyIcon={History}
                emptyTitle="No stock movements yet"
                emptyDescription="Sales, restocks and adjustments will appear here."
              />
              {recentMovements.map((mov, i) => (
                <TR key={mov.id} index={i} highlight={freshIds.has(mov.id)}>
                  <TD>
                    <span className="font-medium text-ink block">{mov.item_name}</span>
                    <span className="font-mono text-caption text-ink-muted block">{mov.item_code}</span>
                  </TD>
                  <TD><StatusPill kind="movement" value={mov.movement_type} size="sm" /></TD>
                  <TD numeric className={cn('font-semibold', mov.movement_type === 'in' ? 'text-success-fg' : 'text-ink')}>
                    {mov.movement_type === 'in' ? `+${mov.quantity}` : `-${mov.quantity}`}
                  </TD>
                  <TD className="text-right text-caption text-ink-muted whitespace-nowrap">
                    {new Date(mov.created_at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              icon={PackageMinus}
              title="Low stock"
              actions={lowStockProducts.length > 0 && <Badge tone="warning" size="sm">{lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'items'}</Badge>}
            />
            <div className="p-2">
              {firstLoad ? (
                <div className="space-y-3 p-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-8" />)}</div>
              ) : lowStockProducts.length === 0 ? (
                <EmptyState compact icon={PackageCheck} title="All stock levels healthy" />
              ) : (
                <ul>
                  {lowStockProducts.map(p => {
                    const out = p.stock_status ? p.stock_status === 'out' : parseInt(p.quantity) <= 0;
                    return (
                      <li key={`${p.id}-${p.branch_id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-subtle transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{p.item_name}</p>
                          <p className="text-caption text-ink-muted font-mono truncate">{p.item_code}{isSuperAdmin && p.branch_name ? ` · ${p.branch_name}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-semibold tabular-nums', out ? 'text-danger-fg' : 'text-warning-fg')}>{out ? 'Out' : `${p.quantity} left`}</p>
                          <p className="text-[11px] text-ink-muted tabular-nums">Alert at {p.minimum_quantity}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {lowStockProducts.length > 0 && (
                <div className="px-3 pt-1 pb-2"><Button variant="link" size="sm" iconRight={ArrowRight} to="/low-stock">Open low stock list</Button></div>
              )}
            </div>
          </Card>

          {isSuperAdmin && pendingCount > 0 && (
            <Card className="animate-fade-in">
              <CardHeader icon={UserCheck} title="Pending approvals" />
              <div className="p-5">
                <p className="text-sm text-ink-secondary mb-4">
                  <span className="font-semibold text-ink tabular-nums">{pendingCount}</span> {pendingCount === 1 ? 'person is' : 'people are'} waiting for account approval.
                </p>
                <Button variant="accent-soft" fullWidth to="/users/pending">Review requests</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Per-business breakdown: super admin only */}
      {isSuperAdmin && (
        <section className="mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-ink">Businesses</h2>
              <p className="text-sm text-ink-muted">Select a business to filter this overview.</p>
            </div>
            <Button variant="ghost" size="sm" iconRight={ArrowRight} to="/businesses">Manage businesses</Button>
          </div>

          {firstLoad ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : allBusinesses.length === 0 ? (
            <Card><EmptyState icon={Building2} title="No businesses yet" description="Create a business to start adding branches and products." action={<Button to="/businesses" size="sm">Go to businesses</Button>} /></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allBusinesses.map(biz => {
                const bizItems = allProducts.filter(p => Number(p.business_id) === Number(biz.id));
                const bizTotalStock = bizItems.reduce((acc, p) => acc + Number(p.quantity || 0), 0);
                const bizBranches = allBranches.filter(br => Number(br.business_id) === Number(biz.id));
                const isSelected = selectedBusiness?.id === biz.id;
                return (
                  <Card
                    key={biz.id}
                    as="button"
                    type="button"
                    interactive
                    aria-pressed={isSelected}
                    onClick={() => setSelectedBusiness(isSelected ? null : biz)}
                    className={cn('text-left p-5 w-full', isSelected && 'border-accent ring-1 ring-accent bg-accent-soft/40')}
                  >
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <span className="flex items-center gap-2 min-w-0">
                        <BusinessDot business={biz} />
                        <span className="font-semibold text-sm text-ink truncate">{biz.name}</span>
                      </span>
                      {biz.industry && <Badge size="sm" className="capitalize">{biz.industry}</Badge>}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-2xl font-semibold text-ink tabular-nums">{bizItems.length}</span>
                      <span className="text-caption text-ink-muted">products</span>
                    </div>
                    <dl className="mt-3 pt-3 border-t border-line-soft grid grid-cols-2 gap-2 text-caption">
                      <div><dt className="text-ink-muted">Stock on hand</dt><dd className="font-medium text-ink tabular-nums">{bizTotalStock} units</dd></div>
                      <div><dt className="text-ink-muted">Branches</dt><dd className="font-medium text-ink tabular-nums">{bizBranches.length}</dd></div>
                    </dl>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
      </>
      )}
    </Layout>
  );
}
