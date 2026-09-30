import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Modal, FormSection, Field, Input, Select, MoneyInput, ChoiceCards, PrimaryButton, SecondaryButton } from '../../components/ui/Form';
import {
  Package, Plus, Search, Filter, Edit3, Trash2, ArrowDownLeft,
  QrCode, AlertTriangle, X, RotateCcw, Hash,
  Palette, Ruler, Tag, DollarSign, ShoppingBag, Users, Briefcase,
  CheckCircle, RefreshCw, Building, ChevronDown, ChevronRight,
  Layers, Printer, ArrowUpDown, CheckSquare, Square
} from 'lucide-react';

// Business form-config options may be a JSON array, a JSON string or a comma list
function parseFormOptions(options) {
  if (Array.isArray(options)) return options;
  if (typeof options !== 'string') return [];
  try { const parsed = JSON.parse(options); return Array.isArray(parsed) ? parsed : []; }
  catch { return options.split(',').map(o => o.trim()).filter(Boolean); }
}

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
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modalError, setModalError] = useState('');

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
    setError(''); setSuccess(''); setModalError('');
    if (adjustQty < 1) { setModalError('Enter a quantity of at least 1.'); return; }
    if (adjustNewQty != null && adjustNewQty < 0) { setModalError(`Only ${adjustCurrentQty} in stock. You can't remove ${adjustQty}.`); return; }
    try {
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
    setError(''); setSuccess(''); setModalError('');
    if (!editForm.item_name.trim()) { setModalError('Product name is required.'); return; }
    const num = (v) => (v === '' || v == null ? 0 : parseFloat(v) || 0);
    try {
      const res = await api.put(`/products/${selectedItem.id}`, {
        item_name: editForm.item_name.trim(),
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
    }
  };

  // ── Delete Product ──
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${name}'?\n\nThis will completely purge ALL information for this product (branch stock, movements, damage reports, and photos) across all branches.`)) return;
    try {
      const res = await api.delete(`/products/${id}`);
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchItems();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  // ── Quick QR Modal ──
  const openQrModal = async (item, branchList = null) => {
    setSelectedItem(item);
    setShowQrModal(true);
    setError('');
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
      setError(err.response?.data?.message || 'Failed to render QR Code');
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
      setError('Failed to load business catalog');
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
    setError(''); setSuccess('');
    if (addToBranchForm.product_ids.length === 0) {
      setError('Please choose at least one product.');
      return;
    }
    if (isSuperAdmin && addToBranchForm.branch_ids.length === 0) {
      setError('Please select at least one branch.');
      return;
    }

    try {
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
    }
  };

  const hasFilterQuery = Boolean(filterBusiness || filterBranch || selectedCategory !== 'All' || selectedStockStatus !== 'all');
  const activeBranchName   = branches.find(b => String(b.id) === String(filterBranch))?.name;
  const activeBusinessName = businesses.find(b => String(b.id) === String(filterBusiness))?.name;

  return (
    <Layout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Product Inventory Catalog</h1>
          <p className="text-xs text-ink-muted mt-1">Manage master product variants, multi-branch stock levels, thresholds, and pricing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddToBranchModal}
            className="inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors shadow-sm"
          >
            <Building className="w-4 h-4 text-accent" />
            <span>Add to branch / Restock</span>
          </button>
          <Link
            to="/products/add"
            className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Filter Chip Banner */}
      {hasFilterQuery && (
        <div className="mb-4 p-3 rounded-xl bg-accent-soft border border-accent-line flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-accent-fg">
            <Filter className="w-4 h-4 text-accent" />
            <span>Active Filters:
              {activeBusinessName && <> Business: <strong className="text-accent-fg font-bold mr-2">{activeBusinessName}</strong></>}
              {activeBranchName && <> Branch: <strong className="text-accent-fg font-bold mr-2">{activeBranchName}</strong></>}
              {selectedCategory !== 'All' && <> Category: <strong className="text-accent-fg font-bold mr-2">{selectedCategory}</strong></>}
              {selectedStockStatus !== 'all' && <> Stock: <strong className="text-accent-fg font-bold mr-2 uppercase">{selectedStockStatus.replace('_', ' ')}</strong></>}
            </span>
          </div>
          <button onClick={clearFilters} className="text-xs text-accent hover:text-accent-fg flex items-center gap-1 font-semibold transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-danger-soft border border-danger-line rounded-xl text-danger-fg text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-success-soft border border-success-line rounded-xl text-success-fg text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</span>
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Controls Bar: Search, View Mode Toggle, Filters, Sorting */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search SKU, name, colour, model..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-surface border border-line rounded-lg px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent w-full pl-9"
            />
          </div>

          {/* View Toggle: By Branch vs All Branches Combined */}
          {user?.role === 'super_admin' && (
            <div className="flex items-center bg-sunken p-1 rounded-lg border border-line w-full sm:w-auto justify-center">
              <button
                onClick={() => setViewMode('by_branch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'by_branch'
                    ? 'bg-surface text-ink shadow-sm border border-line'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-accent" />
                <span>By Branch</span>
              </button>
              <button
                onClick={() => setViewMode('combined')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'combined'
                    ? 'bg-surface text-ink shadow-sm border border-line'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>All Branches Combined</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-line-soft text-xs">
          {user?.role === 'super_admin' && (
            <>
              <select
                value={filterBusiness}
                onChange={e => { setFilterBusiness(e.target.value); setFilterBranch(''); }}
                className="bg-surface border border-line rounded-lg px-2.5 h-9 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All Businesses</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                disabled={!filterBusiness && branches.length === 0}
                className="bg-surface border border-line rounded-lg px-2.5 h-9 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-surface border border-line rounded-lg px-2.5 h-9 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={selectedStockStatus}
            onChange={e => setSelectedStockStatus(e.target.value)}
            className="bg-surface border border-line rounded-lg px-2.5 h-9 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock (Healthy)</option>
            <option value="low_stock">Low Stock Alerts</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          <select
            value={selectedProductStatus}
            onChange={e => setSelectedProductStatus(e.target.value)}
            className="bg-surface border border-line rounded-lg px-2.5 h-9 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="active">Selling (not discontinued)</option>
            <option value="discontinued">Discontinued only</option>
            <option value="All">All products</option>
          </select>

          {/* Sort Dropdown */}
          <div className="ml-auto flex items-center gap-1.5 text-ink-muted">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={selectedSort}
              onChange={e => setSelectedSort(e.target.value)}
              className="bg-surface border border-line rounded-lg px-2.5 h-9 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="date_desc">Newest Added</option>
              <option value="date_asc">Oldest Added</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="sku_asc">SKU (A-Z)</option>
              <option value="qty_desc">Quantity (High to Low)</option>
              <option value="qty_asc">Quantity (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            <h6 className="font-semibold text-ink">
              {viewMode === 'by_branch'
                ? `Inventory Items by Branch (${items.length})`
                : `All Master Products (${combinedItems.length} unique products)`}
            </h6>
          </div>
          <button
            onClick={fetchItems}
            className="inline-flex items-center gap-2 h-8 px-2.5 text-ink-muted text-xs font-medium rounded-lg hover:bg-sunken hover:text-ink transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'by_branch' ? (
            /* ── BY BRANCH TABLE (Default) ── */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-subtle">
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">SKU &amp; Product</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Category / Variant</th>
                  {user?.role === 'super_admin' && (
                    <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Branch</th>
                  )}
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Stock Status</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Pricing</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-12 text-center text-ink-muted font-mono text-xs">Loading inventory catalog...</td></tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-12 text-center">
                      <Package className="w-10 h-10 text-ink-subtle mx-auto mb-3" />
                      <p className="text-ink-muted text-sm font-medium">No products found matching criteria.</p>
                      <Link to="/products/add" className="text-accent hover:text-accent-fg text-xs font-semibold mt-1 inline-block">
                        Add New Product
                      </Link>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const minQty = parseInt(item.minimum_quantity ?? item.min_quantity ?? 0, 10) || 0;
                    const qty = parseInt(item.quantity || 0);
                    const isOutOfStock = item.stock_status ? item.stock_status === 'out' : qty <= 0;
                    const isLow = item.stock_status ? item.stock_status === 'low' : (!isOutOfStock && qty <= minQty);
                    const isHighlighted = String(item.id) === String(queryProductId);

                    const stockBadgeClass = isOutOfStock
                      ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-danger-soft text-danger-fg border border-danger-line"
                      : isLow
                      ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg border border-warning-line"
                      : "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-success-soft text-success-fg border border-success-line";

                    return (
                      <tr key={`${item.id}-${item.branch_id}`} className={`hover:bg-subtle transition-colors ${isHighlighted ? 'bg-accent-soft/60 border-l-4 border-accent' : ''}`}>
                        <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                          <div className="font-bold text-ink flex items-center">
                            <span>{item.item_name}</span>
                            {item.new_until && new Date(item.new_until) > new Date() && (
                              <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-accent-muted text-accent-fg ml-2">NEW</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              onClick={() => openQrModal(item)}
                              className="font-mono text-[11px] text-accent hover:text-accent-fg font-bold hover:underline flex items-center gap-1"
                              title="Click to view QR label"
                            >
                              <QrCode className="w-3 h-3 text-accent" />
                              {item.item_code}
                            </button>
                            <span className="text-[10px] text-ink-muted capitalize">{item.business_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                          <div className="flex flex-wrap gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-soft text-violet-fg">{item.category}</span>
                            {item.variant_color && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-info-soft text-info-fg">{item.variant_color}</span>}
                            {item.size && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg">{item.size}</span>}
                            {item.model && <span className="text-[10px] text-ink-muted block mt-1 font-mono">{item.model}</span>}
                          </div>
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-sunken text-ink-secondary w-fit">
                              <Building className="w-3 h-3 text-ink-muted" />
                              {item.branch_name || 'Main Branch'}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                          <div className="flex items-center gap-2 font-mono font-bold">
                            <span className={stockBadgeClass}>
                              {item.quantity} units
                            </span>
                          </div>
                          <div className="text-[10px] text-ink-muted mt-0.5 font-mono">Min Threshold: {minQty}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface">
                          <div className="text-xs space-y-0.5">
                            <div className="text-success-fg font-mono font-bold">
                              RM {parseFloat(item.selling_price || 0).toFixed(2)} <span className="text-ink-muted font-normal">(cust)</span>
                            </div>
                            {item.price_dealer > 0 && (
                              <div className="text-accent-fg font-mono text-[11px]">
                                RM {parseFloat(item.price_dealer).toFixed(2)} <span className="text-ink-muted">dealer</span>
                              </div>
                            )}
                            {item.price_staff > 0 && (
                              <div className="text-violet-fg font-mono text-[11px]">
                                RM {parseFloat(item.price_staff).toFixed(2)} <span className="text-ink-muted">staff</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 border-b border-line-soft text-sm text-ink bg-surface text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openAdjustModal(item)}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-success-fg text-xs font-medium rounded-lg bg-success-soft hover:bg-success-muted transition-colors"
                              title="Stock In / Stock Out"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Adjust
                            </button>
                            <button
                              onClick={() => openQrModal(item)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent-soft text-accent hover:bg-accent-muted transition-colors"
                              title="View & Print QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink-muted hover:bg-sunken hover:text-ink transition-colors"
                              title="Edit Master Product Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.item_name)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-danger-fg hover:bg-danger-soft hover:text-danger-fg transition-colors"
                              title="Permanently Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ── ALL BRANCHES COMBINED TABLE (Aggregated view with expand) ── */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-subtle">
                  <th className="w-10 px-3 py-3 border-b border-line"></th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">SKU &amp; Product</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Category / Variant</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Branches Carrying</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Total Combined Stock</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-left">Pricing</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted px-4 py-3 border-b border-line text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-ink-muted font-mono text-xs">Loading combined inventory...</td></tr>
                ) : combinedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center">
                      <Package className="w-10 h-10 text-ink-subtle mx-auto mb-3" />
                      <p className="text-ink-muted text-sm font-medium">No products found matching criteria.</p>
                    </td>
                  </tr>
                ) : (
                  combinedItems.map((prod) => {
                    const isExpanded = expandedProductIds.has(prod.id);
                    // Combined status reflects WORST branch status
                    const combinedBadge = prod.has_critical
                      ? { label: 'Critical / Out of Stock at branch', cls: 'bg-danger-soft text-danger-fg border-danger-line' }
                      : prod.has_low
                      ? { label: 'Low Stock at branch', cls: 'bg-warning-soft text-warning-fg border-warning-line' }
                      : { label: 'Healthy across all branches', cls: 'bg-success-soft text-success-fg border-success-line' };

                    return (
                      <React.Fragment key={prod.id}>
                        <tr className="hover:bg-subtle transition-colors bg-surface">
                          {/* Expand chevron */}
                          <td className="px-3 py-3 border-b border-line-soft text-center">
                            <button
                              onClick={() => toggleExpandProduct(prod.id)}
                              className="p-1 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors"
                              title="Expand / Collapse branch stock"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>

                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink">
                            <div className="font-bold text-ink flex items-center">
                              <span>{prod.item_name}</span>
                              {prod.new_until && new Date(prod.new_until) > new Date() && (
                                <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-accent-muted text-accent-fg ml-2">NEW</span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <button
                                onClick={() => openQrModal(prod, prod.branches)}
                                className="font-mono text-[11px] text-accent hover:text-accent-fg font-bold hover:underline flex items-center gap-1"
                                title="Click to view QR label"
                              >
                                <QrCode className="w-3 h-3 text-accent" />
                                {prod.item_code}
                              </button>
                              <span className="text-[10px] text-ink-muted capitalize">{prod.business_name}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink">
                            <div className="flex flex-wrap gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-soft text-violet-fg">{prod.category}</span>
                              {prod.variant_color && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-info-soft text-info-fg">{prod.variant_color}</span>}
                              {prod.size && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg">{prod.size}</span>}
                              {prod.model && <span className="text-[10px] text-ink-muted block mt-1 font-mono">{prod.model}</span>}
                            </div>
                          </td>

                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-accent-soft text-accent-fg">
                              <Building className="w-3 h-3" />
                              {prod.branches.length} branch{prod.branches.length !== 1 ? 'es' : ''}
                            </span>
                          </td>

                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink">
                            <div className="font-mono font-bold text-ink text-base">
                              {prod.total_quantity} <span className="text-xs font-normal text-ink-muted">units total</span>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border mt-1 ${combinedBadge.cls}`}>
                              {combinedBadge.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink">
                            <div className="text-xs space-y-0.5">
                              <div className="text-success-fg font-mono font-bold">
                                RM {parseFloat(prod.selling_price || 0).toFixed(2)} <span className="text-ink-muted font-normal">(cust)</span>
                              </div>
                              {prod.price_dealer > 0 && (
                                <div className="text-accent-fg font-mono text-[11px]">
                                  RM {parseFloat(prod.price_dealer).toFixed(2)} <span className="text-ink-muted">dealer</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 border-b border-line-soft text-sm text-ink text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openQrModal(prod, prod.branches)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent-soft text-accent hover:bg-accent-muted transition-colors"
                                title="View QR Tag"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(prod)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink-muted hover:bg-sunken hover:text-ink transition-colors"
                                title="Edit Master Product Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(prod.id, prod.item_name)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-danger-fg hover:bg-danger-soft hover:text-danger-fg transition-colors"
                                title="Permanently Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Inline expanded per-branch breakdown */}
                        {isExpanded && (
                          <tr className="bg-subtle/70 border-b border-line">
                            <td colSpan="7" className="px-8 py-3.5">
                              <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
                                Branch Stock Breakdown for {prod.item_name}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {prod.branches.map(br => {
                                  const brBadge = br.is_critical
                                    ? "bg-danger-muted text-danger-fg border-danger-line"
                                    : br.is_low
                                    ? "bg-warning-muted text-warning-fg border-warning-line"
                                    : "bg-success-muted text-success-fg border-success-line";

                                  return (
                                    <div key={br.branch_id} className="bg-surface border border-line rounded-lg p-3 flex items-center justify-between shadow-xs">
                                      <div>
                                        <div className="font-semibold text-ink text-xs flex items-center gap-1.5">
                                          <Building className="w-3.5 h-3.5 text-accent" />
                                          {br.branch_name}
                                          {br.branch_code && <span className="font-mono text-ink-muted font-normal">({br.branch_code})</span>}
                                        </div>
                                        <div className="text-[11px] text-ink-muted font-mono mt-0.5">
                                          Min threshold: {br.min_quantity}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border ${brBadge}`}>
                                          {br.quantity} units
                                        </span>
                                        <button
                                          onClick={() => openAdjustModal(prod, br.branch_id)}
                                          className="text-xs font-medium text-accent hover:text-accent-fg bg-accent-soft hover:bg-accent-muted px-2 py-1 rounded-lg transition-colors"
                                          title="Adjust Stock for this branch"
                                        >
                                          Adjust
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal 1: Adjust Stock ── */}
      {showAdjustModal && selectedItem && (
        <Modal
          icon={ArrowUpDown}
          title="Adjust stock"
          description={<>{selectedItem.item_name} <span className="font-mono text-accent">({selectedItem.item_code})</span></>}
          onClose={() => setShowAdjustModal(false)}
          onSubmit={handleAdjustSubmit}
          error={modalError}
          onDismissError={() => setModalError('')}
          footer={<>
            <SecondaryButton onClick={() => setShowAdjustModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton>Save adjustment</PrimaryButton>
          </>}
        >
          {branches.length > 1 && (
            <Field label="Branch" required>
              <Select required value={adjustForm.branch_id} onChange={e => setAdjustForm({ ...adjustForm, branch_id: e.target.value })}>
                <option value="">Choose a branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}

          <Field label="What happened?">
            <ChoiceCards
              columns={3}
              value={adjustForm.adjustment_type}
              onChange={v => setAdjustForm({ ...adjustForm, adjustment_type: v })}
              options={[
                { value: 'in', icon: ArrowDownLeft, activeColor: 'text-success-fg', label: 'Stock in', description: 'New stock arrived.' },
                { value: 'out', icon: ShoppingBag, activeColor: 'text-danger-fg', label: 'Stock out', description: 'Sold or taken out.' },
                { value: 'adjust', icon: Hash, activeColor: 'text-violet-fg', label: 'Set count', description: 'After a stock take.' }
              ]}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={adjustForm.adjustment_type === 'adjust' ? 'Actual count on shelf' : 'Quantity'} required>
              <Input type="number" min="1" step="1" required value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} className="font-mono" />
            </Field>
            {adjustForm.adjustment_type === 'out' && (
              <Field label="Payment method" hint="Used in the sales report.">
                <Select value={adjustForm.payment_method || 'cash'} onChange={e => setAdjustForm({ ...adjustForm, payment_method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="qr">QR / e-Wallet</option>
                  <option value="online_banking">Online Banking</option>
                </Select>
              </Field>
            )}
          </div>

          {adjustCurrentQty != null && (
            <div className={`p-3 rounded-lg border text-sm flex items-center justify-between ${adjustNewQty < 0 ? 'bg-danger-soft border-danger-line text-danger-fg' : 'bg-subtle border-line text-ink-secondary'}`}>
              <span>Stock after saving</span>
              <span className="font-mono font-semibold">{adjustCurrentQty} → <span className={adjustNewQty < 0 ? 'text-danger-fg' : 'text-accent-fg'}>{adjustNewQty}</span></span>
            </div>
          )}

          <Field label="Note" optional>
            <Input placeholder="e.g. Delivery from supplier, invoice #1234" value={adjustForm.note} onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })} />
          </Field>
        </Modal>
      )}

      {/* ── Modal 2: Edit Product ── */}
      {showEditModal && selectedItem && (
        <Modal
          size="lg"
          icon={Edit3}
          title="Edit product"
          description={<>SKU <span className="font-mono text-accent">{selectedItem.item_code}</span> (cannot be changed). Changes apply in every branch that carries this product.</>}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={modalError}
          onDismissError={() => setModalError('')}
          footer={<>
            <SecondaryButton onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton><CheckCircle className="w-4 h-4" /> Save changes</PrimaryButton>
          </>}
        >
          <FormSection title="Product">
            <Field label="Product name" required>
              <Input required value={editForm.item_name} onChange={e => setEditForm({ ...editForm, item_name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category" required>
                <Select required value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} disabled={editConfig.loading}>
                  <option value="">Choose a category…</option>
                  {/* Keep the current value selectable even if it was removed from the business's list */}
                  {editForm.category && !editConfig.categories.some(c => c.name === editForm.category) && (
                    <option value={editForm.category}>{editForm.category}</option>
                  )}
                  {editConfig.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Status" hint={editForm.status === 'discontinued' ? 'Hidden from the POS and the product list.' : 'Out of stock / low stock is worked out from each branch’s quantity.'}>
                <Select value={editForm.status || 'available'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="available">Selling</option>
                  <option value="discontinued">Discontinued</option>
                </Select>
              </Field>
            </div>
            {editConfig.attributes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editConfig.attributes.map(attr => {
                  const value = editForm.variants?.[attr.attribute_key] || '';
                  const setValue = (v) => setEditForm({ ...editForm, variants: { ...editForm.variants, [attr.attribute_key]: v } });
                  const options = parseFormOptions(attr.options);
                  return (
                    <Field key={attr.attribute_key} label={attr.label} optional>
                      {attr.input_type === 'select' ? (
                        <Select value={value} onChange={e => setValue(e.target.value)}>
                          <option value="">Choose…</option>
                          {value && !options.includes(value) && <option value={value}>{value}</option>}
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </Select>
                      ) : (
                        <Input value={value} onChange={e => setValue(e.target.value)} placeholder={attr.label} />
                      )}
                    </Field>
                  );
                })}
              </div>
            )}
          </FormSection>

          <FormSection title="Prices" description="Which price is charged depends on the tier chosen at the POS.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Customer price" hint="Normal walk-in price.">
                <MoneyInput value={editForm.selling_price} onChange={e => setEditForm({ ...editForm, selling_price: e.target.value })} />
              </Field>
              <Field label="Dealer price" hint="For resellers / wholesale.">
                <MoneyInput value={editForm.price_dealer} onChange={e => setEditForm({ ...editForm, price_dealer: e.target.value })} />
              </Field>
              <Field label="Staff price" hint="Employee purchase price.">
                <MoneyInput value={editForm.price_staff} onChange={e => setEditForm({ ...editForm, price_staff: e.target.value })} />
              </Field>
              <Field label="Cost price" hint="What you paid. Internal only, used for damage loss.">
                <MoneyInput value={editForm.unit_price} onChange={e => setEditForm({ ...editForm, unit_price: e.target.value })} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Stock alert">
            <Field label="Low-stock alert at" hint="The product is flagged “low stock” when a branch has this many or fewer.">
              <Input type="number" min="0" step="1" value={editForm.minimum_quantity} onChange={e => setEditForm({ ...editForm, minimum_quantity: e.target.value })} className="font-mono sm:max-w-[10rem]" />
            </Field>
          </FormSection>
        </Modal>
      )}

      {/* ── Modal 3: Quick QR Label Modal (Click to View QR) ── */}
      {showQrModal && selectedItem && (
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-line-soft mb-4">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-accent">HQ Asset Tag</span>
              <button onClick={() => setShowQrModal(false)}><X className="w-5 h-5 text-ink-muted" /></button>
            </div>

            {/* If product carried in multiple branches, allow choosing branch */}
            {qrBranchOptions.length > 1 && (
              <div className="mb-4 text-left">
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">
                  Branch Selection
                </label>
                <select
                  value={selectedQrBranchId}
                  onChange={e => setSelectedQrBranchId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {qrBranchOptions.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.branch_name} ({b.branch_code || `BR-${b.branch_id}`}) - {b.quantity} in stock
                    </option>
                  ))}
                </select>
              </div>
            )}

            {qrLoading ? (
              <div className="py-12">
                <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
                <p className="text-xs text-ink-muted">Generating vector QR code...</p>
              </div>
            ) : qrData ? (
              <div>
                <h3 className="font-bold text-ink text-base mb-1">{selectedItem.item_name}</h3>
                <p className="text-xs text-ink-muted mb-4">
                  {selectedItem.category} &bull; <span className="font-mono text-accent font-bold">SKU: {selectedItem.item_code}</span>
                </p>

                {/* SVG Render */}
                <div
                  className="bg-surface p-3 border border-line rounded-xl inline-block mb-3 shadow-xs"
                  dangerouslySetInnerHTML={{ __html: qrData.qr_svg }}
                />

                <div className="bg-subtle p-2 rounded-lg font-mono text-xs font-bold text-accent mb-4 tracking-wider border border-line-soft">
                  {qrData.qr_code}
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-line-soft mb-4">
                  <span className="text-ink-muted font-medium">Selling Price</span>
                  <span className="font-extrabold text-ink text-sm">RM {parseFloat(selectedItem.selling_price || 0).toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    <Printer className="w-4 h-4" /> Print Label
                  </button>
                  <Link
                    to={`/qr/generate?product_id=${selectedItem.id}`}
                    className="inline-flex items-center justify-center px-4 h-10 rounded-lg bg-surface border border-line text-ink-secondary text-sm font-medium hover:bg-subtle"
                  >
                    Full Page
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Modal 4: Add Existing Product to Branch / Restock ── */}
      {showAddToBranchModal && (
        <Modal
          size="lg"
          icon={Building}
          title="Add to branch / Restock"
          description="Put products that already exist in the business catalog into a branch, or top up ones the branch already carries."
          onClose={() => setShowAddToBranchModal(false)}
          onSubmit={handleAddToBranchSubmit}
          footer={<>
            <SecondaryButton onClick={() => setShowAddToBranchModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={addToBranchForm.product_ids.length === 0 || (isSuperAdmin && addToBranchForm.branch_ids.length === 0)}>
              Add / Restock {addToBranchForm.product_ids.length > 0 ? `${addToBranchForm.product_ids.length} product${addToBranchForm.product_ids.length === 1 ? '' : 's'}` : ''}
            </PrimaryButton>
          </>}
        >
          <FormSection title="1. Where">
            {isSuperAdmin ? (
              <>
                <Field label="Business" required>
                  <Select
                    required
                    value={addToBranchForm.business_id}
                    onChange={e => {
                      const bid = e.target.value;
                      setAddToBranchForm({ ...addToBranchForm, business_id: bid, branch_ids: [], product_ids: [], product_quantities: {} });
                      setAddToBranchResult(null);
                      if (bid) loadCatalogForBusiness(bid);
                    }}
                  >
                    <option value="">Choose a business…</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </Field>
                <Field label="Branches" required hint="Pick one branch to see which products it already has.">
                  {branches.length === 0 ? (
                    <p className="text-xs text-ink-muted italic">Choose a business first.</p>
                  ) : (
                    <div>
                      <div className="flex justify-end mb-1">
                        <button
                          type="button"
                          onClick={() => setAddToBranchForm(f => ({ ...f, branch_ids: f.branch_ids.length === branches.length ? [] : branches.map(b => b.id) }))}
                          className="text-xs text-accent hover:text-accent-fg font-semibold"
                        >
                          {addToBranchForm.branch_ids.length === branches.length ? 'Clear all' : 'Select all'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                        {branches.map(br => {
                          const isChecked = addToBranchForm.branch_ids.includes(br.id);
                          return (
                            <button
                              key={br.id}
                              type="button"
                              onClick={() => setAddToBranchForm(f => ({ ...f, branch_ids: isChecked ? f.branch_ids.filter(id => id !== br.id) : [...f.branch_ids, br.id] }))}
                              className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm border transition-colors ${isChecked ? 'bg-accent-soft text-accent-fg font-semibold border-accent-line' : 'bg-surface text-ink-secondary border-line hover:bg-subtle'}`}
                            >
                              {isChecked ? <CheckSquare className="w-4 h-4 text-accent flex-shrink-0" /> : <Square className="w-4 h-4 text-ink-muted flex-shrink-0" />}
                              <span className="truncate">{br.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Field>
              </>
            ) : (
              <div className="p-2.5 bg-subtle border border-line-soft rounded-lg text-sm text-ink-secondary flex items-center gap-2">
                <Building className="w-4 h-4 text-ink-muted" />
                <span><strong>{user?.branch_name || 'Your branch'}</strong> · {user?.business_name || 'Your business'}</span>
              </div>
            )}
          </FormSection>

          <FormSection
            title="2. Products and quantities"
            description="For a product already in the branch, the quantity is added to its current stock. For a new one, it's the starting stock (0 is allowed)."
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by product name or SKU…"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <span className={`text-xs font-semibold whitespace-nowrap ${addToBranchForm.product_ids.length ? 'text-accent' : 'text-ink-muted'}`}>{addToBranchForm.product_ids.length} selected</span>
            </div>

            {catalogLoading ? (
              <div className="py-8 text-center text-xs text-ink-muted">Loading products…</div>
            ) : catalogProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted italic border border-dashed border-line rounded-xl">
                {isSuperAdmin && !addToBranchForm.business_id ? 'Choose a business first.' : 'This business has no products yet.'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-line-soft border border-line rounded-xl bg-surface">
                {catalogProducts
                  .filter(p => !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || p.sku.toLowerCase().includes(catalogSearch.toLowerCase()))
                  .map(p => {
                    const isChecked = addToBranchForm.product_ids.includes(p.id);
                    const toggle = () => setAddToBranchForm(f => ({
                      ...f,
                      product_ids: isChecked ? f.product_ids.filter(id => id !== p.id) : [...f.product_ids, p.id],
                      product_quantities: isChecked
                        ? Object.fromEntries(Object.entries(f.product_quantities || {}).filter(([id]) => String(id) !== String(p.id)))
                        : { ...(f.product_quantities || {}), [p.id]: f.product_quantities?.[p.id] ?? 1 }
                    }));
                    return (
                      <div key={p.id} className={`px-3 py-2 flex items-center gap-3 text-sm ${isChecked ? 'bg-accent-soft/70' : 'hover:bg-subtle'}`}>
                        <button type="button" onClick={toggle} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                          {isChecked ? <CheckSquare className="w-4 h-4 text-accent flex-shrink-0" /> : <Square className="w-4 h-4 text-ink-muted flex-shrink-0" />}
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{p.name}</span>
                            <span className="block text-[11px] text-ink-muted">
                              <span className="font-mono text-accent">{p.sku}</span>
                              {p.category && <> · {p.category}</>}
                              {' · '}RM {parseFloat(p.price_customer || 0).toFixed(2)}
                            </span>
                          </span>
                        </button>
                        {p.in_branch
                          ? <span className="rounded-full bg-success-soft border border-success-line px-2 py-0.5 text-[10px] font-semibold text-success-fg whitespace-nowrap">In branch · {p.branch_qty}</span>
                          : <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-ink-muted whitespace-nowrap">New to branch</span>}
                        {isChecked && (
                          <label className="flex items-center gap-1.5 text-[11px] text-ink-muted flex-shrink-0">
                            {p.in_branch ? 'Add' : 'Start with'}
                            <input
                              type="number"
                              min={p.in_branch ? 1 : 0}
                              step="1"
                              value={addToBranchForm.product_quantities?.[p.id] ?? 1}
                              onChange={e => {
                                const value = e.target.value;
                                setAddToBranchForm(f => ({ ...f, product_quantities: { ...(f.product_quantities || {}), [p.id]: value } }));
                              }}
                              className="h-8 w-16 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                              aria-label={p.in_branch ? `Quantity to add for ${p.name}` : `Starting stock for ${p.name}`}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </FormSection>

          {addToBranchResult && (
            <div className="rounded-xl border border-warning-line bg-warning-soft p-3 text-xs">
              <p className="font-semibold text-warning-fg mb-1">{addToBranchResult.message}</p>
              {addToBranchResult.results.length > 0 && (
                <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                  {addToBranchResult.results.map(r => {
                    const prod = catalogProducts.find(cp => cp.id === r.product_id);
                    const br = branches.find(b => b.id === r.branch_id);
                    return (
                      <li key={`${r.product_id}-${r.branch_id}`} className={r.action === 'skipped' ? 'text-danger-fg' : 'text-success-fg'}>
                        <span className="font-semibold uppercase">{r.action}</span>{' '}
                        {prod ? `${prod.name} (${prod.sku})` : `Product #${r.product_id}`}
                        {' → '}{br?.name || (isSuperAdmin ? `Branch #${r.branch_id}` : user?.branch_name)}
                        {r.action === 'skipped' ? `: ${r.reason}` : ` (qty ${r.qty_before} → ${r.qty_after})`}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
}