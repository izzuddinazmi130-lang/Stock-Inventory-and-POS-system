import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useBusiness } from '../../context/BusinessContext';
import Layout from '../../components/Layout';
import KpiCard from '../../components/KpiCard';
import api from '../../services/api';
import { Package, Boxes, AlertTriangle, UserCheck, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus, Building2, Sparkles, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

const BIZ_PALETTE = ['#B4502E', '#2563EB', '#059669', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4F46E5'];
const getBusinessColor = (biz, idx) => {
  if (biz.industry === 'fashion' || (biz.name || '').toLowerCase().includes('kaftan')) return '#B4502E';
  if (biz.industry === 'technology' || (biz.name || '').toLowerCase().includes('tech')) return '#2563EB';
  return BIZ_PALETTE[idx % BIZ_PALETTE.length];
};

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const { socket } = useSocket();
  const { selectedBusiness, setSelectedBusiness } = useBusiness();

  const [loading, setLoading] = useState(true);
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

  // Derived metrics
  const lowStockProducts = products.filter(p => parseInt(p.quantity) <= parseInt(p.minimum_quantity || p.min_quantity || 5)).slice(0, 5);

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          {isSuperAdmin ? (
            <>
              <p className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted mb-1">
                Business / {selectedBusiness?.name || 'All Businesses'} / Overview
              </p>
              <h1 className="text-2xl font-bold text-ink">
                {selectedBusiness?.name || 'HQ'} — Inventory Overview
              </h1>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted mb-1">
                My Branch / Overview
              </p>
              <h1 className="text-2xl font-bold text-ink">
                {user?.branch_name || 'My Branch'} — Inventory Overview
              </h1>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="inline-flex items-center gap-2 h-9 px-3 text-ink-muted text-sm font-medium rounded-lg hover:bg-sunken hover:text-ink transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link to="/qr/scan" className="inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors shadow-sm">
            <Camera className="w-4 h-4 text-accent" /> POS Scanner
          </Link>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-4 mb-6`}>
        {isSuperAdmin ? (
          <>
            <KpiCard title="Total Businesses" value={businessCount} meta="Registered businesses" metaColor="gray" icon={Building2} />
            <KpiCard title="Total Branches" value={branchCount} meta="Active branches" metaColor="blue" icon={Building2} />
            <KpiCard title="Total Products" value={stats.totalItems} meta="Active SKUs" metaColor="gray" icon={Package} />
            <KpiCard title="Low Stock Alerts" value={stats.lowStockCount} meta="SKUs below threshold" metaColor={stats.lowStockCount > 0 ? 'rose' : 'amber'} icon={AlertTriangle} />
            <KpiCard title="New Arrivals" value={stats.newArrivals || 0} meta="Products marked as new" metaColor="indigo" icon={Sparkles} />
          </>
        ) : (
          <>
            <KpiCard title="Total Products" value={stats.totalItems} meta="Active SKUs in this branch" metaColor="gray" icon={Package} />
            <KpiCard title="Low Stock Alerts" value={stats.lowStockCount} meta="SKUs below threshold" metaColor={stats.lowStockCount > 0 ? 'rose' : 'amber'} icon={AlertTriangle} />
            <KpiCard title="New Arrivals" value={stats.newArrivals || 0} meta="Products marked as new" metaColor="indigo" icon={Sparkles} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="bg-surface border border-line rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-accent" />
              <h6 className="font-semibold text-ink">Recent Inventory Movements</h6>
            </div>
            <Link to="/reports/movement" className="text-xs text-accent hover:text-accent-fg font-semibold">
              View All &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-subtle">
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line">Item Code & Name</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line">Type</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line">Quantity</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-ink-muted text-xs">
                      No recent inventory movements recorded.
                    </td>
                  </tr>
                ) : (
                  recentMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-subtle">
                      <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                        <span className="font-semibold block">{mov.item_name}</span>
                        <span className="font-mono text-[11px] text-ink-muted block">{mov.item_code}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                        {mov.movement_type === 'in' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-success-soft text-success-fg">
                             STOCK IN
                          </span>
                        ) : mov.movement_type === 'out' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-danger-soft text-danger-fg">
                             STOCK OUT
                          </span>
                        ) : mov.movement_type === 'damage' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg">
                             DAMAGE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-soft text-violet-fg">ADJUST</span>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface font-mono font-bold">
                        {mov.movement_type === 'in' ? `+${mov.quantity}` : `-${mov.quantity}`}
                      </td>
                      <td className="px-4 py-3 border-b border-line-soft text-sm text-ink-muted bg-surface">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-line rounded-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-fg" />
                <h6 className="font-semibold text-ink">Low Stock Alerts</h6>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-danger-soft text-danger-fg">{lowStockProducts.length} items</span>
            </div>
            <div className="p-4 space-y-3">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-ink-muted text-center py-4">All stock levels healthy.</p>
              ) : (
                lowStockProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{p.item_name}</p>
                      <p className="text-[11px] text-ink-muted font-mono truncate">{p.item_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-danger-fg">{p.quantity}</p>
                      <p className="text-[10px] text-ink-muted">Min: {p.minimum_quantity}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {isSuperAdmin && pendingCount > 0 && (
            <div className="bg-surface border border-line rounded-xl">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-warning-fg" />
                  <h6 className="font-semibold text-ink">Pending Approvals</h6>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-ink-secondary mb-3">There are <strong className="text-ink">{pendingCount}</strong> user registrations waiting for approval.</p>
                <Link to="/users/pending" className="inline-flex items-center justify-center w-full gap-2 h-9 px-3 bg-warning-soft text-warning-fg text-sm font-medium rounded-lg hover:bg-warning-muted transition-colors">
                  Review Approvals
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Multi-Business Overview / Breakdown — Super Admin only */}
      {isSuperAdmin && (
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h6 className="font-bold text-ink text-sm tracking-tight">Business Operations Breakdown</h6>
              <p className="text-xs text-ink-muted">Live inventory totals and branch counts for all registered corporate entities</p>
            </div>
            <Link to="/businesses" className="text-xs font-semibold text-accent hover:text-accent-fg transition-colors">
              Manage Businesses &rarr;
            </Link>
          </div>

          {allBusinesses.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl p-8 text-center text-ink-muted text-xs">
              No registered businesses found in the system.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allBusinesses.map((biz, idx) => {
                const bizColor = getBusinessColor(biz, idx);
                const bizItems = allProducts.filter(p => Number(p.business_id) === Number(biz.id));
                const bizItemCount = bizItems.length;
                const bizTotalStock = bizItems.reduce((acc, p) => acc + Number(p.quantity || 0), 0);
                const bizBranches = allBranches.filter(br => Number(br.business_id) === Number(biz.id));
                const isSelected = selectedBusiness?.id === biz.id;

                return (
                  <div
                    key={biz.id}
                    onClick={() => setSelectedBusiness(isSelected ? null : biz)}
                    className={`bg-surface border rounded-xl p-5 transition-all cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'ring-2 ring-accent border-accent shadow-sm bg-accent-soft/10' 
                        : 'border-line hover:border-line-strong'
                    }`}
                    style={{ borderBottom: `3px solid ${bizColor}` }}
                    title={`Click to ${isSelected ? 'clear filter' : 'filter dashboard by ' + biz.name}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: bizColor }} />
                        <span className="font-bold text-sm text-ink truncate">{biz.name}</span>
                      </div>
                      {biz.industry && (
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-sunken text-ink-secondary flex-shrink-0">
                          {biz.industry}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-ink tracking-tight">{bizItemCount}</span>
                        <span className="text-xs font-semibold text-ink-muted">items</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-ink-muted pt-2 border-t border-line-soft">
                        <span>Stock on hand:</span>
                        <strong className="text-ink font-semibold">{bizTotalStock} units</strong>
                      </div>
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>Branches:</span>
                        <span className="text-ink-secondary font-medium">
                          {bizBranches.length} {bizBranches.length === 1 ? 'branch' : 'branches'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-line mt-8 pt-4 flex items-center justify-between text-[11px] font-semibold tracking-wide uppercase text-ink-muted">
        <div>
          {isSuperAdmin
            ? 'HQ INVENTORY · LIVE OPERATIONS'
            : `${user?.branch_name || 'BRANCH'} · LIVE OPERATIONS`}
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
