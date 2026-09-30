import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Plus, RefreshCw, Eye, Camera, Coins, PackageX, Trash2, Lock } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Button, Card, CardHeader, FilterBar, IconButton, Input, KpiCard, Menu, PageHeader, SearchInput, Select, Badge,
  Table, THead, TBody, TH, TR, TD, TableState, Tooltip, useConfirm, useToast,
} from '../../components/ui';
import { ReasonBadge, ReportDamageModal, DamageDetailModal, PhotoViewer } from './components/DamageModals';

export default function DamageProducts() {
  const { user } = useAuth();

  // Data states
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalReports: 0, totalQuantity: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // `message` now only carries errors shown inside the report form; page messages are toasts
  const [message, setMessage] = useState(null);
  const { toast } = useToast();
  const confirm = useConfirm();

  // Filter states
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterBusiness, setFilterBusiness] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalBranchId, setModalBranchId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [branchProducts, setBranchProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    quantity: 1,
    cost_per_unit: '',
    reason_category: 'transit_damage',
    reason_details: ''
  });
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const fileInputRef = useRef(null);

  // View Details Modal states
  const [viewReport, setViewReport] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);


  const isSuperAdmin = user?.role === 'super_admin';

  // Load business and branch lists for filters & modal
  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/businesses')
        .then(res => {
          if (res.data.success) {
            setBusinesses(res.data.businesses || []);
          }
        })
        .catch(err => console.error('Failed to load businesses:', err));

      api.get('/branches')
        .then(res => {
          if (res.data.success) {
            setBranches(res.data.branches || []);
          }
        })
        .catch(err => console.error('Failed to load branches:', err));
    } else if (user?.branch_id) {
      // Branch admin: may view damage records across all branches of their own business
      // (/branches is already scoped to it server-side); writes stay limited to their own branch.
      api.get('/branches')
        .then(res => {
          if (res.data.success) {
            setBranches(res.data.branches || []);
          }
        })
        .catch(err => console.error('Failed to load branches:', err));
      setModalBranchId(user.branch_id);
    }
  }, [user, isSuperAdmin]);

  // Branch admins may delete only records from their own branch (enforced server-side too)
  const canDeleteReport = (r) => isSuperAdmin || String(r.branch_id) === String(user?.branch_id);

  // When super_admin selects business in filter, cascade to branches
  const filteredBranchOptions = useMemo(() => {
    if (!filterBusiness) return branches;
    return branches.filter(b => String(b.business_id) === String(filterBusiness));
  }, [branches, filterBusiness]);

  // Fetch damage reports
  const fetchDamageReports = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (filterBusiness) params.business_id = filterBusiness;
      if (filterBranch) params.branch_id = filterBranch;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/damage-reports', { params });
      if (res.data.success) {
        setReports(res.data.reports || []);
        setStats(res.data.stats || { totalReports: 0, totalQuantity: 0, totalValue: 0 });
      } else {
        setLoadError(res.data.message || 'Failed to load damage reports.');
      }
    } catch (err) {
      console.error('Error fetching damage reports:', err);
      setLoadError(err.response?.data?.message || 'Could not reach the damage records service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDamageReports();
    }, 250);
    return () => clearTimeout(timer);
  }, [filterBusiness, filterBranch, startDate, endDate, searchQuery]);

  // Delete a damage report
  const handleDeleteReport = async (target) => {
    const ok = await confirm({
      title: `Delete damage report #DR-${target.id}?`,
      message: `This permanently deletes the record for ${target.item_name} and its photos.\n${target.quantity} unit(s) will be put back into ${target.branch_name}'s stock. This cannot be undone.`,
      confirmLabel: 'Delete report',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/damage-reports/${target.id}`);
      if (res.data.success) {
        toast.success(res.data.message || `Damage report #${target.id} deleted.`);
        fetchDamageReports();
      } else {
        toast.error(res.data.message || 'Failed to delete damage report.');
      }
    } catch (err) {
      console.error('Error deleting damage report:', err);
      toast.error(err.response?.data?.message || 'Could not reach the damage records service.');
    }
  };

  // Load products when modal branch changes
  useEffect(() => {
    if (!showAddModal) return;
    const targetBranch = isSuperAdmin ? modalBranchId : user?.branch_id;
    if (!targetBranch) {
      setBranchProducts([]);
      return;
    }

    setLoadingProducts(true);
    api.get(`/products?branch_id=${targetBranch}`)
      .then(res => {
        if (res.data.success) {
          setBranchProducts(res.data.items || []);
        }
      })
      .catch(err => console.error('Error fetching branch products:', err))
      .finally(() => setLoadingProducts(false));
  }, [showAddModal, modalBranchId, isSuperAdmin, user]);

  // Handle photo selection
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedPhotos.length + files.length > 5) {
      setMessage({ type: 'danger', text: 'You can upload a maximum of 5 evidence photos per report.' });
      return;
    }

    const newPhotos = [...selectedPhotos, ...files].slice(0, 5);
    setSelectedPhotos(newPhotos);

    // Create preview URLs
    const newPreviews = newPhotos.map(file => URL.createObjectURL(file));
    setPhotoPreviews(newPreviews);
  };

  const removePhoto = (index) => {
    const updatedPhotos = selectedPhotos.filter((_, i) => i !== index);
    const updatedPreviews = photoPreviews.filter((_, i) => i !== index);
    setSelectedPhotos(updatedPhotos);
    setPhotoPreviews(updatedPreviews);
  };

  // Open add modal
  const openAddModal = () => {
    setSelectedProduct(null);
    setProductSearch('');
    setFormData({
      quantity: 1,
      cost_per_unit: '',
      reason_category: 'transit_damage',
      reason_details: ''
    });
    setSelectedPhotos([]);
    setPhotoPreviews([]);
    // Reporting damage is always fixed to the admin's own branch, whatever the list filter shows
    const defaultBranch = !isSuperAdmin
      ? (user?.branch_id || '')
      : ((filterBranch && filterBranch !== 'all') ? filterBranch : (branches[0]?.id || ''));
    setModalBranchId(defaultBranch);
    setMessage(null);
    setShowAddModal(true);
  };

  // Live calculated total value snapshot
  const computedTotalLoss = useMemo(() => {
    const qty = parseInt(formData.quantity, 10) || 0;
    const unitCost = formData.cost_per_unit !== '' 
      ? parseFloat(formData.cost_per_unit) || 0 
      : (selectedProduct ? parseFloat(selectedProduct.cost_price || 0) : 0);
    return (qty * unitCost).toFixed(2);
  }, [formData.quantity, formData.cost_per_unit, selectedProduct]);

  // Filtered products for search dropdown in modal
  const productSearchResults = useMemo(() => {
    if (!branchProducts || !branchProducts.length) return [];
    if (!productSearch.trim()) return branchProducts.slice(0, 15);
    const q = productSearch.toLowerCase().trim();
    return branchProducts.filter(p => {
      const name = (p.name || p.item_name || '').toLowerCase();
      const sku = (p.sku || p.item_code || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || cat.includes(q);
    }).slice(0, 15);
  }, [branchProducts, productSearch]);

  // Handle Form Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const effectiveBranch = isSuperAdmin ? modalBranchId : user?.branch_id;

    if (!effectiveBranch) {
      setMessage({ type: 'danger', text: 'Please select a branch location.' });
      return;
    }

    if (!selectedProduct) {
      setMessage({ type: 'danger', text: 'Please select a product from the list.' });
      return;
    }

    const qty = parseInt(formData.quantity, 10);
    if (!qty || qty <= 0) {
      setMessage({ type: 'danger', text: 'Damage quantity must be at least 1 unit.' });
      return;
    }

    const availableStock = parseInt(selectedProduct.quantity || 0, 10);
    if (qty > availableStock) {
      setMessage({ 
        type: 'danger', 
        text: `Cannot report ${qty} units. Branch currently only has ${availableStock} units available.` 
      });
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('product_id', selectedProduct.id);
      data.append('branch_id', effectiveBranch);
      data.append('quantity', qty);
      if (formData.cost_per_unit !== '') {
        data.append('cost_per_unit', formData.cost_per_unit);
      }
      data.append('reason_category', formData.reason_category);
      data.append('reason_details', formData.reason_details);

      selectedPhotos.forEach(file => {
        data.append('photos', file);
      });

      const res = await api.post('/damage-reports', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Damage report logged.');
        setMessage(null);
        setShowAddModal(false);
        fetchDamageReports();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to submit damage report.' });
      }
    } catch (err) {
      console.error('Submission error:', err);
      const errMsg = err.response?.data?.message || err.message || 'An unexpected error occurred.';
      setMessage({ type: 'danger', text: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const hasActiveFilters = Boolean(
    filterBusiness || filterBranch || startDate || endDate || searchQuery
  );

  const resetFilters = () => {
    setFilterBusiness('');
    setFilterBranch('');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  return (
    <Layout>
      <PageHeader
        title="Damage records"
        description="Log damaged items, record the loss and keep photo evidence."
        actions={<>
          <Button variant="ghost" icon={RefreshCw} onClick={fetchDamageReports} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
          <Button variant="danger" icon={Plus} onClick={openAddModal}>Report damage</Button>
        </>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard loading={loading && reports.length === 0} label="Reports" value={stats.totalReports} icon={AlertTriangle} tone="warning" meta={hasActiveFilters ? 'Matching the filters' : 'All time'} />
        <KpiCard loading={loading && reports.length === 0} label="Units written off" value={stats.totalQuantity} icon={PackageX} tone="danger" meta="Removed from stock" />
        <KpiCard
          loading={loading && reports.length === 0}
          label="Value lost"
          value={stats.totalValue}
          format={v => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Coins}
          tone="neutral"
          meta="At recorded cost"
        />
      </div>

      <FilterBar onReset={resetFilters} resetVisible={hasActiveFilters}>
        <SearchInput
          wrapperClassName="md:flex-1 md:min-w-[14rem]"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search product, SKU, notes, reporter…"
          aria-label="Search damage records"
        />
        {isSuperAdmin && (
          <Select wrapperClassName="md:w-44" aria-label="Business" value={filterBusiness} onChange={e => { setFilterBusiness(e.target.value); setFilterBranch(''); }}>
            <option value="">All businesses</option>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        <Select wrapperClassName="md:w-48" aria-label="Branch" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="">All branches</option>
          {filteredBranchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Input type="date" wrapperClassName="md:w-40" className="md:w-40" aria-label="From date" value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)} />
        <Input type="date" className="md:w-40" aria-label="To date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} />
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader
          title="Damage incidents"
          description={loading && reports.length === 0 ? 'Loading…' : `${reports.length} ${reports.length === 1 ? 'record' : 'records'}`}
        />
        <Table minWidth="58rem">
          <THead>
            <TR>
              <TH>Report</TH>
              <TH>Product</TH>
              <TH>Location</TH>
              <TH numeric>Qty</TH>
              <TH numeric>Value lost</TH>
              <TH>Reason</TH>
              <TH>Reported by</TH>
              <TH className="w-px"><span className="sr-only">Actions</span></TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={8}
              loading={loading && reports.length === 0}
              error={!loading && loadError && reports.length === 0 ? loadError : null}
              onRetry={fetchDamageReports}
              empty={!loading && !loadError && reports.length === 0}
              emptyIcon={PackageX}
              emptyTitle={hasActiveFilters ? 'No records match these filters' : 'No damage reported yet'}
              emptyDescription={hasActiveFilters ? 'Try another date range or search.' : 'When something arrives broken or gets written off, report it here.'}
              emptyAction={hasActiveFilters
                ? <Button variant="secondary" size="sm" onClick={resetFilters}>Clear filters</Button>
                : <Button variant="danger" size="sm" icon={Plus} onClick={openAddModal}>Report damage</Button>}
            />
            {reports.map((r, i) => {
              const photoCount = r.photos?.length || 0;
              const when = new Date(r.created_at);
              const canDelete = canDeleteReport(r);
              return (
                <TR key={r.id} index={i} onClick={() => setViewReport(r)}>
                  <TD>
                    <div className="font-mono text-caption font-semibold text-accent">#DR-{r.id}</div>
                    <div className="text-caption text-ink-muted mt-0.5 whitespace-nowrap">
                      {when.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} · {when.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {photoCount > 0 && <Badge tone="neutral" size="sm" icon={Camera} className="mt-1">{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</Badge>}
                  </TD>
                  <TD className="max-w-[16rem]">
                    <div className="font-medium text-ink truncate">{r.item_name}</div>
                    <div className="text-caption text-ink-muted mt-0.5">
                      <span className="font-mono">{r.item_code}</span>{r.category && <> · {r.category}</>}
                    </div>
                  </TD>
                  <TD>
                    <div className="text-sm text-ink whitespace-nowrap">{r.branch_name}</div>
                    <div className="text-caption text-ink-muted whitespace-nowrap">{r.business_name}</div>
                  </TD>
                  <TD numeric className="font-semibold text-danger-fg">−{r.quantity}</TD>
                  <TD numeric>
                    <div className="font-semibold text-ink">RM {parseFloat(r.total_value || 0).toFixed(2)}</div>
                    <div className="text-caption text-ink-muted">@ RM {parseFloat(r.cost_per_unit || 0).toFixed(2)}</div>
                  </TD>
                  <TD className="max-w-[14rem]">
                    <ReasonBadge value={r.reason_category} />
                    {r.reason_details && <div className="text-caption text-ink-muted mt-1 truncate" title={r.reason_details}>{r.reason_details}</div>}
                  </TD>
                  <TD>
                    <div className="text-sm text-ink">{r.reported_by_name || 'System admin'}</div>
                    {r.reported_by_email && <div className="text-caption text-ink-muted">{r.reported_by_email}</div>}
                  </TD>
                  <TD onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton icon={Eye} label="View report" onClick={() => setViewReport(r)} />
                      {canDelete ? (
                        <Menu
                          label={`More actions for report ${r.id}`}
                          items={[{ label: 'Delete report', icon: Trash2, tone: 'danger', onClick: () => handleDeleteReport(r) }]}
                        />
                      ) : (
                        <Tooltip content="Records from other branches are read-only">
                          <span className="w-8 h-8 inline-flex items-center justify-center text-ink-subtle" tabIndex={0} aria-label="Read-only">
                            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {showAddModal && (
        <ReportDamageModal
          isSuperAdmin={isSuperAdmin}
          user={user}
          branches={branches}
          branchId={modalBranchId}
          onBranchChange={(v) => { setModalBranchId(v); setSelectedProduct(null); setProductSearch(''); }}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          products={branchProducts}
          productResults={productSearchResults}
          loadingProducts={loadingProducts}
          selectedProduct={selectedProduct}
          onSelectProduct={(p) => {
            const stockQty = parseInt(p.quantity || 0, 10);
            setSelectedProduct(p);
            setFormData(prev => ({ ...prev, quantity: Math.min(parseInt(prev.quantity, 10) || 1, stockQty), cost_per_unit: p.cost_price || '' }));
          }}
          onClearProduct={() => { setSelectedProduct(null); setProductSearch(''); }}
          form={formData}
          setForm={setFormData}
          totalLoss={computedTotalLoss}
          photos={selectedPhotos}
          previews={photoPreviews}
          onAddPhotos={handlePhotoSelect}
          onRemovePhoto={removePhoto}
          fileInputRef={fileInputRef}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          submitting={submitting}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
        />
      )}

      {viewReport && (
        <DamageDetailModal report={viewReport} onClose={() => setViewReport(null)} onOpenPhoto={setLightboxPhoto} />
      )}

      {lightboxPhoto && <PhotoViewer src={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </Layout>
  );
}
