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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Product Inventory Catalog</h1>
          <p className="text-xs text-slate-500 mt-1">Manage master product variants, multi-branch stock levels, thresholds, and pricing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddToBranchModal}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Building className="w-4 h-4 text-indigo-600" />
            <span>Add to branch / Restock</span>
          </button>
          <Link
            to="/products/add"
            className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Filter Chip Banner */}
      {hasFilterQuery && (
        <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-indigo-700">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>Active Filters:
              {activeBusinessName && <> Business: <strong className="text-indigo-900 font-bold mr-2">{activeBusinessName}</strong></>}
              {activeBranchName && <> Branch: <strong className="text-indigo-900 font-bold mr-2">{activeBranchName}</strong></>}
              {selectedCategory !== 'All' && <> Category: <strong className="text-indigo-900 font-bold mr-2">{selectedCategory}</strong></>}
              {selectedStockStatus !== 'all' && <> Stock: <strong className="text-indigo-900 font-bold mr-2 uppercase">{selectedStockStatus.replace('_', ' ')}</strong></>}
            </span>
          </div>
          <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</span>
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Controls Bar: Search, View Mode Toggle, Filters, Sorting */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search SKU, name, colour, model..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full pl-9"
            />
          </div>

          {/* View Toggle: By Branch vs All Branches Combined */}
          {user?.role === 'super_admin' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto justify-center">
              <button
                onClick={() => setViewMode('by_branch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'by_branch'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                <span>By Branch</span>
              </button>
              <button
                onClick={() => setViewMode('combined')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'combined'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>All Branches Combined</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {user?.role === 'super_admin' && (
            <>
              <select
                value={filterBusiness}
                onChange={e => { setFilterBusiness(e.target.value); setFilterBranch(''); }}
                className="bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Businesses</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                disabled={!filterBusiness && branches.length === 0}
                className="bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={selectedStockStatus}
            onChange={e => setSelectedStockStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock (Healthy)</option>
            <option value="low_stock">Low Stock Alerts</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          <select
            value={selectedProductStatus}
            onChange={e => setSelectedProductStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="active">Selling (not discontinued)</option>
            <option value="discontinued">Discontinued only</option>
            <option value="All">All products</option>
          </select>

          {/* Sort Dropdown */}
          <div className="ml-auto flex items-center gap-1.5 text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={selectedSort}
              onChange={e => setSelectedSort(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <h6 className="font-semibold text-slate-900">
              {viewMode === 'by_branch'
                ? `Inventory Items by Branch (${items.length})`
                : `All Master Products (${combinedItems.length} unique products)`}
            </h6>
          </div>
          <button
            onClick={fetchItems}
            className="inline-flex items-center gap-2 h-8 px-2.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
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
                <tr className="bg-slate-50">
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">SKU &amp; Product</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Category / Variant</th>
                  {user?.role === 'super_admin' && (
                    <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Branch</th>
                  )}
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Stock Status</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Pricing</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-12 text-center text-slate-400 font-mono text-xs">Loading inventory catalog...</td></tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-12 text-center">
                      <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm font-medium">No products found matching criteria.</p>
                      <Link to="/products/add" className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold mt-1 inline-block">
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
                      ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                      : isLow
                      ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                      : "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200";

                    return (
                      <tr key={`${item.id}-${item.branch_id}`} className={`hover:bg-slate-50 transition-colors ${isHighlighted ? 'bg-indigo-50/60 border-l-4 border-indigo-500' : ''}`}>
                        <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 bg-white">
                          <div className="font-bold text-slate-900 flex items-center">
                            <span>{item.item_name}</span>
                            {item.new_until && new Date(item.new_until) > new Date() && (
                              <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 ml-2">NEW</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              onClick={() => openQrModal(item)}
                              className="font-mono text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1"
                              title="Click to view QR label"
                            >
                              <QrCode className="w-3 h-3 text-indigo-500" />
                              {item.item_code}
                            </button>
                            <span className="text-[10px] text-slate-400 capitalize">{item.business_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 bg-white">
                          <div className="flex flex-wrap gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700">{item.category}</span>
                            {item.variant_color && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700">{item.variant_color}</span>}
                            {item.size && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">{item.size}</span>}
                            {item.model && <span className="text-[10px] text-slate-500 block mt-1 font-mono">{item.model}</span>}
                          </div>
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 bg-white">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 w-fit">
                              <Building className="w-3 h-3 text-slate-500" />
                              {item.branch_name || 'Main Branch'}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 bg-white">
                          <div className="flex items-center gap-2 font-mono font-bold">
                            <span className={stockBadgeClass}>
                              {item.quantity} units
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Min Threshold: {minQty}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 bg-white">
                          <div className="text-xs space-y-0.5">
                            <div className="text-emerald-700 font-mono font-bold">
                              RM {parseFloat(item.selling_price || 0).toFixed(2)} <span className="text-slate-400 font-normal">(cust)</span>
                            </div>
                            {item.price_dealer > 0 && (
                              <div className="text-indigo-700 font-mono text-[11px]">
                                RM {parseFloat(item.price_dealer).toFixed(2)} <span className="text-slate-400">dealer</span>
                              </div>
                            )}
                            {item.price_staff > 0 && (
                              <div className="text-purple-700 font-mono text-[11px]">
                                RM {parseFloat(item.price_staff).toFixed(2)} <span className="text-slate-400">staff</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 bg-white text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openAdjustModal(item)}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-emerald-600 text-xs font-medium rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
                              title="Stock In / Stock Out"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Adjust
                            </button>
                            <button
                              onClick={() => openQrModal(item)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                              title="View & Print QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              title="Edit Master Product Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.item_name)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
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
                <tr className="bg-slate-50">
                  <th className="w-10 px-3 py-3 border-b border-slate-200"></th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">SKU &amp; Product</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Category / Variant</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Branches Carrying</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Total Combined Stock</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-left">Pricing</th>
                  <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400 font-mono text-xs">Loading combined inventory...</td></tr>
                ) : combinedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center">
                      <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm font-medium">No products found matching criteria.</p>
                    </td>
                  </tr>
                ) : (
                  combinedItems.map((prod) => {
                    const isExpanded = expandedProductIds.has(prod.id);
                    // Combined status reflects WORST branch status
                    const combinedBadge = prod.has_critical
                      ? { label: 'Critical / Out of Stock at branch', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
                      : prod.has_low
                      ? { label: 'Low Stock at branch', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                      : { label: 'Healthy across all branches', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

                    return (
                      <React.Fragment key={prod.id}>
                        <tr className="hover:bg-slate-50 transition-colors bg-white">
                          {/* Expand chevron */}
                          <td className="px-3 py-3 border-b border-slate-100 text-center">
                            <button
                              onClick={() => toggleExpandProduct(prod.id)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Expand / Collapse branch stock"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900">
                            <div className="font-bold text-slate-900 flex items-center">
                              <span>{prod.item_name}</span>
                              {prod.new_until && new Date(prod.new_until) > new Date() && (
                                <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 ml-2">NEW</span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <button
                                onClick={() => openQrModal(prod, prod.branches)}
                                className="font-mono text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1"
                                title="Click to view QR label"
                              >
                                <QrCode className="w-3 h-3 text-indigo-500" />
                                {prod.item_code}
                              </button>
                              <span className="text-[10px] text-slate-400 capitalize">{prod.business_name}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900">
                            <div className="flex flex-wrap gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700">{prod.category}</span>
                              {prod.variant_color && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700">{prod.variant_color}</span>}
                              {prod.size && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">{prod.size}</span>}
                              {prod.model && <span className="text-[10px] text-slate-500 block mt-1 font-mono">{prod.model}</span>}
                            </div>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                              <Building className="w-3 h-3" />
                              {prod.branches.length} branch{prod.branches.length !== 1 ? 'es' : ''}
                            </span>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900">
                            <div className="font-mono font-bold text-slate-900 text-base">
                              {prod.total_quantity} <span className="text-xs font-normal text-slate-500">units total</span>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border mt-1 ${combinedBadge.cls}`}>
                              {combinedBadge.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900">
                            <div className="text-xs space-y-0.5">
                              <div className="text-emerald-700 font-mono font-bold">
                                RM {parseFloat(prod.selling_price || 0).toFixed(2)} <span className="text-slate-400 font-normal">(cust)</span>
                              </div>
                              {prod.price_dealer > 0 && (
                                <div className="text-indigo-700 font-mono text-[11px]">
                                  RM {parseFloat(prod.price_dealer).toFixed(2)} <span className="text-slate-400">dealer</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-900 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openQrModal(prod, prod.branches)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                title="View QR Tag"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(prod)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                title="Edit Master Product Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(prod.id, prod.item_name)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                title="Permanently Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Inline expanded per-branch breakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan="7" className="px-8 py-3.5">
                              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                Branch Stock Breakdown for {prod.item_name}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {prod.branches.map(br => {
                                  const brBadge = br.is_critical
                                    ? "bg-rose-100 text-rose-700 border-rose-200"
                                    : br.is_low
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-emerald-100 text-emerald-700 border-emerald-200";

                                  return (
                                    <div key={br.branch_id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-xs">
                                      <div>
                                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                          <Building className="w-3.5 h-3.5 text-indigo-500" />
                                          {br.branch_name}
                                          {br.branch_code && <span className="font-mono text-slate-400 font-normal">({br.branch_code})</span>}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                          Min threshold: {br.min_quantity}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${brBadge}`}>
                                          {br.quantity} units
                                        </span>
                                        <button
                                          onClick={() => openAdjustModal(prod, br.branch_id)}
                                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
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
          description={<>{selectedItem.item_name} <span className="font-mono text-indigo-600">({selectedItem.item_code})</span></>}
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
                { value: 'in', icon: ArrowDownLeft, activeColor: 'text-emerald-600', label: 'Stock in', description: 'New stock arrived.' },
                { value: 'out', icon: ShoppingBag, activeColor: 'text-rose-600', label: 'Stock out', description: 'Sold or taken out.' },
                { value: 'adjust', icon: Hash, activeColor: 'text-violet-600', label: 'Set count', description: 'After a stock take.' }
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
            <div className={`p-3 rounded-lg border text-sm flex items-center justify-between ${adjustNewQty < 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <span>Stock after saving</span>
              <span className="font-mono font-semibold">{adjustCurrentQty} → <span className={adjustNewQty < 0 ? 'text-rose-700' : 'text-indigo-700'}>{adjustNewQty}</span></span>
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
          description={<>SKU <span className="font-mono text-indigo-600">{selectedItem.item_code}</span> (cannot be changed). Changes apply in every branch that carries this product.</>}
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">HQ Asset Tag</span>
              <button onClick={() => setShowQrModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {/* If product carried in multiple branches, allow choosing branch */}
            {qrBranchOptions.length > 1 && (
              <div className="mb-4 text-left">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Branch Selection
                </label>
                <select
                  value={selectedQrBranchId}
                  onChange={e => setSelectedQrBranchId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500">Generating vector QR code...</p>
              </div>
            ) : qrData ? (
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">{selectedItem.item_name}</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {selectedItem.category} &bull; <span className="font-mono text-indigo-600 font-bold">SKU: {selectedItem.item_code}</span>
                </p>

                {/* SVG Render */}
                <div
                  className="bg-white p-3 border border-slate-200 rounded-xl inline-block mb-3 shadow-xs"
                  dangerouslySetInnerHTML={{ __html: qrData.qr_svg }}
                />

                <div className="bg-slate-50 p-2 rounded-lg font-mono text-xs font-bold text-indigo-600 mb-4 tracking-wider border border-slate-100">
                  {qrData.qr_code}
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 mb-4">
                  <span className="text-slate-500 font-medium">Selling Price</span>
                  <span className="font-extrabold text-slate-900 text-sm">RM {parseFloat(selectedItem.selling_price || 0).toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> Print Label
                  </button>
                  <Link
                    to={`/qr/generate?product_id=${selectedItem.id}`}
                    className="inline-flex items-center justify-center px-4 h-10 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
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
                    <p className="text-xs text-slate-400 italic">Choose a business first.</p>
                  ) : (
                    <div>
                      <div className="flex justify-end mb-1">
                        <button
                          type="button"
                          onClick={() => setAddToBranchForm(f => ({ ...f, branch_ids: f.branch_ids.length === branches.length ? [] : branches.map(b => b.id) }))}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
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
                              className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm border transition-colors ${isChecked ? 'bg-indigo-50 text-indigo-900 font-semibold border-indigo-300' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            >
                              {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />}
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
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
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
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by product name or SKU…"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className={`text-xs font-semibold whitespace-nowrap ${addToBranchForm.product_ids.length ? 'text-indigo-600' : 'text-slate-400'}`}>{addToBranchForm.product_ids.length} selected</span>
            </div>

            {catalogLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading products…</div>
            ) : catalogProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
                {isSuperAdmin && !addToBranchForm.business_id ? 'Choose a business first.' : 'This business has no products yet.'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
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
                      <div key={p.id} className={`px-3 py-2 flex items-center gap-3 text-sm ${isChecked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}>
                        <button type="button" onClick={toggle} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                          {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{p.name}</span>
                            <span className="block text-[11px] text-slate-500">
                              <span className="font-mono text-indigo-600">{p.sku}</span>
                              {p.category && <> · {p.category}</>}
                              {' · '}RM {parseFloat(p.price_customer || 0).toFixed(2)}
                            </span>
                          </span>
                        </button>
                        {p.in_branch
                          ? <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">In branch · {p.branch_qty}</span>
                          : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">New to branch</span>}
                        {isChecked && (
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-shrink-0">
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
                              className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
              <p className="font-semibold text-amber-900 mb-1">{addToBranchResult.message}</p>
              {addToBranchResult.results.length > 0 && (
                <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                  {addToBranchResult.results.map(r => {
                    const prod = catalogProducts.find(cp => cp.id === r.product_id);
                    const br = branches.find(b => b.id === r.branch_id);
                    return (
                      <li key={`${r.product_id}-${r.branch_id}`} className={r.action === 'skipped' ? 'text-red-700' : 'text-emerald-700'}>
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