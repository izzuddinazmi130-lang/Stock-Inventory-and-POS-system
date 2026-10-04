import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Plus, RefreshCw, Building2, Layers, PackagePlus } from 'lucide-react';
import {
  Button, BusinessBranchFilter, Card, CardHeader, FilterBar, PageHeader, SearchInput, Select, SegmentedControl, useConfirm, useToast,
} from '../../components/ui';
import { ByBranchTable, CombinedTable } from './components/ProductTables';
import { AdjustStockModal, EditProductModal, QrLabelModal, AddToBranchModal } from './components/ProductModals';

export default function ProductsList() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const queryBusinessId = searchParams.get('business_id') || '';
  const queryBranchId   = searchParams.get('branch_id') || '';
  const queryProductId  = searchParams.get('product_id') || '';

  // View mode: 'by_branch' | 'combined'
  const [viewMode, setViewMode] = useState('by_branch');
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStockStatus, setSelectedStockStatus] = useState('all');
  const [selectedProductStatus, setSelectedProductStatus] = useState('active');
  const [selectedSort, setSelectedSort] = useState('date_desc');

  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches]     = useState([]);
  const [filterBusiness, setFilterBusiness] = useState(queryBusinessId);
  const [filterBranch,   setFilterBranch]   = useState(queryBranchId);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');   // list failed to load (shown in the table)
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();
  // Page-level messages are toasts now
  const setSuccess = (msg) => { if (msg) toast.success(msg); };
  const notifyError = (msg) => { if (msg) toast.error(msg); };

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [showQrModal,     setShowQrModal]     = useState(false);
  const [showAddToBranchModal, setShowAddToBranchModal] = useState(false);
  const [selectedItem, setSelectedItem]       = useState(null);

  // Forms
  const [adjustForm, setAdjustForm] = useState({
    branch_id: '',
    adjustment_type: 'in',
    quantity: 1,
    note: '',
    payment_method: 'cash'
  });
  const [editForm, setEditForm] = useState({});

  // Add Existing to Branch Form
  const [addToBranchForm, setAddToBranchForm] = useState({
    business_id: '',
    branch_ids: [],
    product_ids: [],
    product_quantities: {}
  });
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading]   = useState(false);
  const [catalogSearch, setCatalogSearch]     = useState('');
  const [addToBranchResult, setAddToBranchResult] = useState(null);

  // QR Modal State
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrBranchOptions, setQrBranchOptions] = useState([]);
  const [selectedQrBranchId, setSelectedQrBranchId] = useState('');

  // Sync from URL params
  useEffect(() => {
    if (queryBusinessId) setFilterBusiness(queryBusinessId);
    if (queryBranchId)   setFilterBranch(queryBranchId);
  }, [queryBusinessId, queryBranchId]);

  // Fetch items
  const fetchItems = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/products', {
        params: {
          search:       search || undefined,
          category:     selectedCategory !== 'All' ? selectedCategory : undefined,
          status:       selectedProductStatus !== 'active' ? selectedProductStatus : undefined,
          stock_status: selectedStockStatus !== 'all' ? selectedStockStatus : undefined,
          sort:         selectedSort || undefined,
          business_id:  filterBusiness || undefined,
          branch_id:    filterBranch || undefined,
        }
      });
      if (res.data.success) {
        const fetched = res.data.items || [];
        setItems(fetched);
        if (queryProductId && fetched.length > 0) {
          const match = fetched.find(i => String(i.id) === String(queryProductId));
          if (match) {
            setSelectedItem(match);
            setAdjustForm(f => ({ ...f, branch_id: match.branch_id }));
            setShowAdjustModal(true);
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      if (res.data.success) setCategories(res.data.categories);
    } catch (err) {}
  };

  useEffect(() => {
    fetchItems();
  }, [search, selectedCategory, selectedStockStatus, selectedProductStatus, selectedSort, filterBusiness, filterBranch]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      api.get('/businesses').then(d => {
        if (d.data.success) setBusinesses(d.data.businesses || d.data.data || []);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (filterBusiness) {
      api.get(`/businesses/${filterBusiness}/branches`)
        .then(d => { if (d.data.success) setBranches(d.data.branches || d.data.data || []); })
        .catch(() => {});
    } else {
      setBranches([]);
    }
  }, [filterBusiness]);

  const clearFilters = () => {
    setFilterBusiness('');
    setFilterBranch('');
    setSelectedCategory('All');
    setSelectedStockStatus('all');
    setSelectedProductStatus('active');
    setSelectedSort('date_desc');
    setSearch('');
    setSearchParams({});
  };

  // ── Aggregation for "All Branches Combined" view ──
  const combinedItems = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const pid = item.id;
      if (!map.has(pid)) {
        map.set(pid, {
          ...item,
          branches: [],
          total_quantity: 0,
          has_critical: false,
          has_low: false,
        });
      }
      const entry = map.get(pid);
      const minQ = parseInt(item.minimum_quantity ?? item.min_quantity ?? 0, 10) || 0;
      const q = parseInt(item.quantity || 0);
      // Stock level comes from this branch's quantity (server sends stock_status), never from product status
      const isCrit = item.stock_status ? item.stock_status === 'out' : q <= 0;
      const isLow = item.stock_status ? item.stock_status === 'low' : (!isCrit && q <= minQ);

      if (isCrit) entry.has_critical = true;
      if (isLow) entry.has_low = true;

      entry.branches.push({
        branch_id: item.branch_id,
        branch_name: item.branch_name,
        branch_code: item.branch_code,
        quantity: q,
        min_quantity: minQ,
        is_critical: isCrit,
        is_low: isLow,
      });
      entry.total_quantity += q;
    });
    return Array.from(map.values());
  }, [items]);

  const toggleExpandProduct = (pid) => {
    setExpandedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  // ── Adjust Stock ──
  const openAdjustModal = (item, specificBranchId = null) => {
    setSelectedItem(item);
    setModalError('');
    setAdjustForm({
      branch_id: specificBranchId || item.branch_id || '',
      adjustment_type: 'in',
      quantity: 1,
      note: '',
      payment_method: 'cash'
    });
    setShowAdjustModal(true);
  };

  // Current stock of the selected item in the branch being adjusted (null if unknown)
  const adjustCurrentQty = (() => {
    if (!selectedItem) return null;
    const bid = String(adjustForm.branch_id || selectedItem.branch_id || '');
    const fromBranches = (selectedItem.branches || []).find(b => String(b.branch_id) === bid);
    if (fromBranches) return parseInt(fromBranches.quantity || 0, 10);
    if (String(selectedItem.branch_id) === bid) return parseInt(selectedItem.quantity || 0, 10);
    return null;
  })();
  const adjustQty = parseInt(adjustForm.quantity, 10) || 0;
  const adjustNewQty = adjustCurrentQty == null ? null
    : adjustForm.adjustment_type === 'in' ? adjustCurrentQty + adjustQty
    : adjustForm.adjustment_type === 'out' ? adjustCurrentQty - adjustQty
    : adjustQty;

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (adjustQty < 1) { setModalError('Enter a quantity of at least 1.'); return; }
    if (adjustNewQty != null && adjustNewQty < 0) { setModalError(`Only ${adjustCurrentQty} in stock. You can't remove ${adjustQty}.`); return; }
    try {
      setSaving(true);
      const res = await api.post('/products/adjust-stock', {
        item_id: selectedItem.id,
        ...adjustForm,
        branch_id: adjustForm.branch_id || selectedItem.branch_id,
        note: adjustForm.note.trim() || undefined
      });
      if (res.data.success) {
        setSuccess(res.data.message);
        setShowAdjustModal(false);
        fetchItems();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit Product ──
  // The edit form shows the same categories and extra fields as the business's Add Product form.
  const [editConfig, setEditConfig] = useState({ categories: [], attributes: [], loading: false });

  const openEditModal = (item) => {
    setSelectedItem(item);
    setModalError('');
    setEditForm({
      item_name:        item.item_name || item.name || '',
      sku:              item.item_code || item.sku || '',
      category:         item.category || '',
      variants:         { ...(item.variants || {}) },
      status:           item.status === 'discontinued' ? 'discontinued' : 'available',
      minimum_quantity: item.minimum_quantity ?? item.min_quantity ?? 5,
      selling_price:    item.selling_price ?? item.price_customer ?? '',
      price_dealer:     item.price_dealer ?? '',
      price_staff:      item.price_staff ?? '',
      unit_price:       item.cost_price ?? item.unit_price ?? '',
    });
    setShowEditModal(true);
    setEditConfig({ categories: [], attributes: [], loading: true });
    api.get('/products/form-config', { params: { business_id: item.business_id } })
      .then(r => setEditConfig({ categories: r.data.categories || [], attributes: r.data.attributes || [], loading: false }))
      .catch(() => setEditConfig({ categories: [], attributes: [], loading: false }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!editForm.item_name.trim()) { setModalError('Product name is required.'); return; }
    if (!editForm.sku.trim()) { setModalError('SKU is required.'); return; }
    const num = (v) => (v === '' || v == null ? 0 : parseFloat(v) || 0);
    try {
      setSaving(true);
      const res = await api.put(`/products/${selectedItem.id}`, {
        item_name: editForm.item_name.trim(),
        sku: editForm.sku.trim().replace(/\s+/g, ' '),
        category: editForm.category,
        status: editForm.status,
        variants: editForm.variants,
        minimum_quantity: parseInt(editForm.minimum_quantity, 10) || 0,
        selling_price: num(editForm.selling_price),
        price_dealer: num(editForm.price_dealer),
        price_staff: num(editForm.price_staff),
        unit_price: num(editForm.unit_price)
      });
      if (res.data.success) {
        setSuccess(res.data.message);
        setShowEditModal(false);
        fetchItems();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Product ──
  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: 'This permanently removes everything about this product in every branch: stock, movements, damage reports and photos. It cannot be undone.\n\nTo take it out of just one branch, use “Remove from branch” instead.',
      confirmLabel: 'Delete product',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/products/${id}`);
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchItems();
      }
    } catch (err) {
      notifyError(err.response?.data?.message || err.message);
    }
  };

  // ── Remove a product from ONE branch (it stays in the others) ──
  const handleRemoveFromBranch = async (product, branch, branchCount) => {
    const qty = parseInt(branch.quantity, 10) || 0;
    const others = branchCount - 1;
    const ok = await confirm({
      title: `Remove ${product.item_name} from ${branch.branch_name}?`,
      message: [
        others === 1 ? 'It stays in the other branch with its stock.' : `It stays in the other ${others} branches with their stock.`,
        qty !== 0 ? `The ${qty} unit${Math.abs(qty) === 1 ? '' : 's'} counted at ${branch.branch_name} will be written off (recorded as a stock adjustment).` : null,
        'Past sales and stock history for this branch are kept.',
      ].filter(Boolean).join('\n\n'),
      confirmLabel: 'Remove from branch',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/products/${product.id}/branches/${branch.branch_id}`);
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchItems();
      }
    } catch (err) {
      notifyError(err.response?.data?.message || err.message);
    }
  };

  // ── Quick QR Modal ──
  const openQrModal = async (item, branchList = null) => {
    setSelectedItem(item);
    setShowQrModal(true);
    setQrData(null);

    const branchesAvail = branchList || (item.branches ? item.branches : [{ branch_id: item.branch_id, branch_name: item.branch_name }]);
    setQrBranchOptions(branchesAvail);

    const initialBid = item.branch_id || (branchesAvail[0]?.branch_id) || '';
    setSelectedQrBranchId(initialBid);
    loadQrForProduct(item.id);
  };

  const loadQrForProduct = async (productId) => {
    try {
      setQrLoading(true);
      const res = await api.get(`/qr/generate/${productId}`);
      if (res.data.success) {
        setQrData(res.data);
      }
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not create the QR code.');
    } finally {
      setQrLoading(false);
    }
  };

  // ── Add Existing Product to Branch Flow ──
  const openAddToBranchModal = async () => {
    const defaultBiz = isSuperAdmin
      ? (filterBusiness || (businesses[0]?.id ? String(businesses[0].id) : ''))
      : String(user?.business_id || '');
    
    const defaultBranchIds = isSuperAdmin 
      ? (filterBranch ? [parseInt(filterBranch)] : [])
      : (user?.branch_id ? [parseInt(user.branch_id)] : []);
    
    setAddToBranchForm({
      business_id: defaultBiz,
      branch_ids: defaultBranchIds,
      product_ids: [],
      product_quantities: {}
    });
    setAddToBranchResult(null);
    setShowAddToBranchModal(true);
    if (defaultBiz) {
      loadCatalogForBusiness(defaultBiz, defaultBranchIds);
    }
  };

  // in_branch / branch_qty are computed for one target branch: the admin's own branch, or
  // (super admin) the single selected branch. With several branches selected there is no badge.
  const loadCatalogForBusiness = async (bizId, targetBranchIds = []) => {
    try {
      setCatalogLoading(true);
      const catalogParams = isSuperAdmin
        ? { business_id: bizId, branch_id: targetBranchIds.length === 1 ? targetBranchIds[0] : undefined }
        : {};
      const [catRes, brRes] = await Promise.all([
        api.get('/products/catalog', { params: catalogParams }),
        api.get(`/businesses/${bizId}/branches`)
      ]);
      if (catRes.data.success) setCatalogProducts(catRes.data.products || []);
      if (brRes.data.success) setBranches(brRes.data.branches || brRes.data.data || []);
    } catch (err) {
      notifyError('Could not load the business catalog.');
    } finally {
      setCatalogLoading(false);
    }
  };

  // Super admin: refresh the in-branch badges when the branch selection changes
  const targetBranchKey = addToBranchForm.branch_ids.length === 1 ? String(addToBranchForm.branch_ids[0]) : '';
  useEffect(() => {
    if (showAddToBranchModal && isSuperAdmin && addToBranchForm.business_id) {
      loadCatalogForBusiness(addToBranchForm.business_id, addToBranchForm.branch_ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBranchKey]);

  const handleAddToBranchSubmit = async (e) => {
    e.preventDefault();
    if (addToBranchForm.product_ids.length === 0) {
      toast.warning('Choose at least one product.');
      return;
    }
    if (isSuperAdmin && addToBranchForm.branch_ids.length === 0) {
      toast.warning('Select at least one branch.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/products/add-to-branch', addToBranchForm);
      const data = res.data;
      const results = data.results || [];
      const doneIds = new Set(results.filter(r => r.action !== 'skipped').map(r => r.product_id));
      const skippedIds = new Set(results.filter(r => r.action === 'skipped').map(r => r.product_id));
      if (doneIds.size > 0) fetchItems();

      if (data.success && !data.partial) {
        // Everything went through: close and show the summary on the page
        setSuccess(data.message);
        setShowAddToBranchModal(false);
        setAddToBranchResult(null);
      } else {
        // Partial or total failure: keep the modal open with per-item results
        setAddToBranchResult({ message: data.message, results });
        if (doneIds.size > 0) {
          loadCatalogForBusiness(addToBranchForm.business_id, addToBranchForm.branch_ids);
          // Deselect fully-successful products so a retry only re-sends what was skipped
          setAddToBranchForm(f => ({
            ...f,
            product_ids: f.product_ids.filter(id => skippedIds.has(id) || !doneIds.has(id))
          }));
        }
      }
    } catch (err) {
      setAddToBranchResult({ message: err.response?.data?.message || err.message, results: [] });
    } finally {
      setSaving(false);
    }
  };

  const hasFilterQuery = Boolean(filterBusiness || filterBranch || selectedCategory !== 'All' || selectedStockStatus !== 'all');
  const hasAnyFilter = hasFilterQuery || Boolean(search) || selectedProductStatus !== 'active' || selectedSort !== 'date_desc';

  const combined = viewMode === 'combined';
  const listCount = combined ? combinedItems.length : items.length;

  return (
    <Layout>
      <PageHeader
        title="Products"
        description="Every product, its stock in each branch, alert levels and prices."
        actions={<>
          <Button variant="secondary" icon={PackagePlus} onClick={openAddToBranchModal}>Add to branch / Restock</Button>
          <Button icon={Plus} to="/products/add">Add product</Button>
        </>}
      />

      <FilterBar onReset={clearFilters} resetVisible={hasAnyFilter}>
        <SearchInput
          wrapperClassName="md:flex-1 md:min-w-[16rem] md:max-w-sm"
          placeholder="Search SKU, name, colour, model…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search products"
        />
        {isSuperAdmin && (
          <BusinessBranchFilter
            businesses={businesses}
            branches={branches}
            businessId={filterBusiness}
            branchId={filterBranch}
            onBusinessChange={id => { setFilterBusiness(id); setFilterBranch(''); }}
            onBranchChange={setFilterBranch}
            businessClassName="md:w-44"
            branchClassName="md:w-52"
          />
        )}
        <Select wrapperClassName="md:w-40" aria-label="Category" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          <option value="All">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select wrapperClassName="md:w-40" aria-label="Stock level" value={selectedStockStatus} onChange={e => setSelectedStockStatus(e.target.value)}>
          <option value="all">Any stock level</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </Select>
        <Select wrapperClassName="md:w-36" aria-label="Product status" value={selectedProductStatus} onChange={e => setSelectedProductStatus(e.target.value)}>
          <option value="active">Selling</option>
          <option value="discontinued">Discontinued</option>
          <option value="All">Any status</option>
        </Select>
        <Select wrapperClassName="md:w-44" aria-label="Sort by" value={selectedSort} onChange={e => setSelectedSort(e.target.value)}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="sku_asc">SKU A–Z</option>
          <option value="qty_desc">Most stock</option>
          <option value="qty_asc">Least stock</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader
          title={combined ? 'All branches combined' : isSuperAdmin ? 'By branch' : 'Products in your branch'}
          description={loading && listCount === 0 ? 'Loading…' : `${listCount} ${combined ? (listCount === 1 ? 'product' : 'products') : (listCount === 1 ? 'row' : 'rows')}`}
          actions={<>
            {isSuperAdmin && (
              <SegmentedControl
                size="sm"
                label="View"
                value={viewMode}
                onChange={setViewMode}
                tabs={[{ value: 'by_branch', label: 'By branch', icon: Building2 }, { value: 'combined', label: 'Combined', icon: Layers }]}
              />
            )}
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchItems} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
          </>}
        />
        {combined ? (
          <CombinedTable
            products={combinedItems}
            loading={loading}
            error={error}
            onRetry={fetchItems}
            expandedIds={expandedProductIds}
            onToggle={toggleExpandProduct}
            hasFilters={hasAnyFilter}
            onClearFilters={clearFilters}
            onAdjust={openAdjustModal}
            onQr={openQrModal}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onRemoveFromBranch={handleRemoveFromBranch}
          />
        ) : (
          <ByBranchTable
            items={items}
            loading={loading}
            error={error}
            onRetry={fetchItems}
            isSuperAdmin={isSuperAdmin}
            highlightId={queryProductId}
            hasFilters={hasAnyFilter}
            onClearFilters={clearFilters}
            onAdjust={openAdjustModal}
            onQr={openQrModal}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onRemoveFromBranch={handleRemoveFromBranch}
          />
        )}
      </Card>

      {showAdjustModal && selectedItem && (
        <AdjustStockModal
          item={selectedItem}
          form={adjustForm}
          setForm={setAdjustForm}
          branches={branches}
          currentQty={adjustCurrentQty}
          newQty={adjustNewQty}
          error={modalError}
          onDismissError={() => setModalError('')}
          onClose={() => setShowAdjustModal(false)}
          onSubmit={handleAdjustSubmit}
          saving={saving}
        />
      )}

      {showEditModal && selectedItem && (
        <EditProductModal
          item={selectedItem}
          form={editForm}
          setForm={setEditForm}
          config={editConfig}
          error={modalError}
          onDismissError={() => setModalError('')}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          saving={saving}
        />
      )}

      {showQrModal && selectedItem && (
        <QrLabelModal
          item={selectedItem}
          qrData={qrData}
          loading={qrLoading}
          branchOptions={qrBranchOptions}
          branchId={selectedQrBranchId}
          onBranchChange={setSelectedQrBranchId}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {showAddToBranchModal && (
        <AddToBranchModal
          isSuperAdmin={isSuperAdmin}
          user={user}
          form={addToBranchForm}
          setForm={setAddToBranchForm}
          businesses={businesses}
          branches={branches}
          onBusinessChange={(bid) => {
            setAddToBranchForm({ ...addToBranchForm, business_id: bid, branch_ids: [], product_ids: [], product_quantities: {} });
            setAddToBranchResult(null);
            if (bid) loadCatalogForBusiness(bid);
          }}
          catalog={catalogProducts}
          catalogLoading={catalogLoading}
          catalogSearch={catalogSearch}
          setCatalogSearch={setCatalogSearch}
          result={addToBranchResult}
          onClose={() => setShowAddToBranchModal(false)}
          onSubmit={handleAddToBranchSubmit}
          saving={saving}
        />
      )}
    </Layout>
  );
}
