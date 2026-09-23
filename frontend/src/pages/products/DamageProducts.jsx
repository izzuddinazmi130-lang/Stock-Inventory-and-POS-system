import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AlertTriangle, Plus, RefreshCw, Search, Eye, Camera, X, 
  DollarSign, PackageX, Calendar, Filter, Building2, 
  Upload, AlertCircle, CheckCircle, ExternalLink, Image as ImageIcon,
  Layers, User, Trash2
} from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const REASON_CATEGORIES = [
  { value: 'transit_damage', label: 'Transit Damage', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'breakage', label: 'Breakage / Physical Impact', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'water_damage', label: 'Water / Weather Damage', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'expired', label: 'Expired / Past Shelf Life', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'manufacturing_defect', label: 'Manufacturing Defect', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'other', label: 'Other / Written-off', color: 'bg-slate-100 text-slate-700 border-slate-200' }
];

function getCategoryMeta(catValue) {
  return REASON_CATEGORIES.find(c => c.value === catValue) || {
    value: catValue,
    label: catValue || 'Other',
    color: 'bg-slate-100 text-slate-700 border-slate-200'
  };
}

export default function DamageProducts() {
  const { user } = useAuth();

  // Data states
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalReports: 0, totalQuantity: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

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

  // Delete Confirmation Modal states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      setFilterBranch(user.branch_id);
      setModalBranchId(user.branch_id);
    }
  }, [user, isSuperAdmin]);

  // When super_admin selects business in filter, cascade to branches
  const filteredBranchOptions = useMemo(() => {
    if (!filterBusiness) return branches;
    return branches.filter(b => String(b.business_id) === String(filterBusiness));
  }, [branches, filterBusiness]);

  // Fetch damage reports
  const fetchDamageReports = async () => {
    try {
      setLoading(true);
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
        setMessage({ type: 'danger', text: res.data.message || 'Failed to load damage reports.' });
      }
    } catch (err) {
      console.error('Error fetching damage reports:', err);
      setMessage({ type: 'danger', text: 'Error connecting to damage records API.' });
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
  const handleDeleteReport = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/damage-reports/${deleteTarget.id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message || `Damage report #${deleteTarget.id} deleted.` });
        setDeleteTarget(null);
        fetchDamageReports();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to delete damage report.' });
      }
    } catch (err) {
      console.error('Error deleting damage report:', err);
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Error connecting to damage records API.' });
    } finally {
      setDeleting(false);
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
    const defaultBranch = (filterBranch && filterBranch !== 'all') 
      ? filterBranch 
      : (isSuperAdmin ? (branches[0]?.id || '') : (user?.branch_id || ''));
    setModalBranchId(defaultBranch);
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
        setMessage({ type: 'success', text: res.data.message || 'Damage report logged successfully!' });
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
    setFilterBranch(isSuperAdmin ? '' : (user?.branch_id || ''));
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  return (
    <Layout>
      {/* Top Notification Banner */}
      {message && (
        <div className={`p-4 mb-6 rounded-xl flex items-center justify-between border ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
          <button 
            onClick={() => setMessage(null)}
            className="text-xs font-semibold px-2 py-1 rounded hover:bg-black/5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>Inventory</span>
            <span>/</span>
            <span>Damage & Loss Records</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Damage Products</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Log damaged items, snapshot financial loss, and inspect photographic proof.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDamageReports} 
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-slate-400' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={openAddModal} 
            className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            <span>Log Damage Report</span>
          </button>
        </div>
      </div>

      {/* 3 Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Total Reports */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">
              Total Reports Logged
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 block tracking-tight">
              {stats.totalReports}
            </span>
            <span className="text-xs mt-1 block text-slate-500">
              {hasActiveFilters ? 'Matching active filters' : 'Lifetime incident records'}
            </span>
          </div>
        </div>

        {/* Card 2: Total Items Damaged */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">
              Total Items Damaged
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <PackageX className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 block tracking-tight">
              {stats.totalQuantity.toLocaleString()} <span className="text-sm font-normal text-slate-500">units</span>
            </span>
            <span className="text-xs mt-1 block text-rose-600 font-medium">
              Written off from inventory
            </span>
          </div>
        </div>

        {/* Card 3: Total Financial Loss */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">
              Total Financial Loss
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 block tracking-tight">
              RM {stats.totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs mt-1 block text-slate-500">
              Snapshotted replacement cost
            </span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Business Selector (super_admin only) */}
          {isSuperAdmin && (
            <div className="min-w-[160px]">
              <select
                value={filterBusiness}
                onChange={e => {
                  setFilterBusiness(e.target.value);
                  setFilterBranch('');
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Businesses</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Branch Selector */}
          {isSuperAdmin && (
            <div className="min-w-[160px]">
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Branches</option>
                {filteredBranchOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range: Start Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date Range: End Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Search Query */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, notes, reporter..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="h-10 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
            >
              <X size={14} />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <h3 className="font-semibold text-slate-900 text-sm">Damage Incidents</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {reports.length} {reports.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200">
                  Report ID & Date
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200">
                  Product / SKU
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200">
                  Location
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-right">
                  Qty Damaged
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-right">
                  Value Lost
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200">
                  Reason & Note
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200">
                  Reported By
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-center">
                  Evidence
                </th>
                <th className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 px-4 py-3 border-b border-slate-200 text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-slate-400 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-indigo-600" />
                      <span>Loading damage reports...</span>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-14 text-center">
                    <PackageX className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-slate-700">No damage records found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {hasActiveFilters 
                        ? 'Try adjusting your search query or filter date range.' 
                        : 'No damaged or written-off items have been reported yet.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Reset active filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                reports.map(r => {
                  const cat = getCategoryMeta(r.reason_category);
                  const photoCount = r.photos?.length || 0;
                  const dateFormatted = new Date(r.created_at).toLocaleDateString('en-MY', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                  const timeFormatted = new Date(r.created_at).toLocaleTimeString('en-MY', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* ID & Date */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm">
                        <div className="font-mono font-semibold text-indigo-600 text-xs">
                          #DR-{r.id}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{dateFormatted}</div>
                        <div className="text-[10px] text-slate-400">{timeFormatted}</div>
                      </td>

                      {/* Product / SKU */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm">
                        <div className="font-medium text-slate-900">{r.item_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {r.item_code}
                          </span>
                          {r.category && (
                            <span className="text-[11px] text-slate-400">· {r.category}</span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm">
                        <div className="text-slate-800 font-medium text-xs">{r.branch_name}</div>
                        <div className="text-[11px] text-slate-400">{r.business_name}</div>
                      </td>

                      {/* Qty Damaged */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                          -{r.quantity}
                        </span>
                      </td>

                      {/* Value Lost */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm text-right">
                        <div className="font-semibold text-slate-900">
                          RM {parseFloat(r.total_value || 0).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          @ RM {parseFloat(r.cost_per_unit || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm max-w-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cat.color}`}>
                          {cat.label}
                        </span>
                        {r.reason_details && (
                          <div className="text-xs text-slate-500 mt-1 truncate" title={r.reason_details}>
                            {r.reason_details}
                          </div>
                        )}
                      </td>

                      {/* Reported By */}
                      <td className="px-4 py-3 border-b border-slate-100 text-sm">
                        <div className="text-xs font-medium text-slate-800">
                          {r.reported_by_name || 'System Admin'}
                        </div>
                        {r.reported_by_email && (
                          <div className="text-[11px] text-slate-400">{r.reported_by_email}</div>
                        )}
                      </td>

                      {/* Evidence Photo Count / Icon */}
                      <td className="px-4 py-3 border-b border-slate-100 text-center">
                        {photoCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700">
                            <Camera size={12} />
                            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 border-b border-slate-100 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setViewReport(r)}
                            className="inline-flex items-center gap-1 h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                            title="View Full Report & Photos"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="inline-flex items-center gap-1 h-8 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium rounded-lg transition-colors"
                            title="Delete Damage Report"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD DAMAGE REPORT MODAL                                                   */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 relative my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Log Damaged Inventory</h2>
                  <p className="text-xs text-slate-400">Deducts stock and records replacement cost snapshot</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Branch Selector (if super_admin) */}
              {isSuperAdmin ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Branch Location *
                  </label>
                  <select
                    required
                    value={modalBranchId}
                    onChange={e => {
                      setModalBranchId(e.target.value);
                      setSelectedProduct(null);
                      setProductSearch('');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Branch...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Branch'})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400" />
                  <span>Branch: <strong>{user?.branch_name || 'My Branch'}</strong></span>
                </div>
              )}

              {/* Product Selection with Search Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Damaged Product *
                </label>
                
                {selectedProduct ? (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-slate-900 text-sm">
                        {selectedProduct.name || selectedProduct.item_name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="font-mono bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-700 font-semibold">
                          {selectedProduct.sku || selectedProduct.item_code}
                        </span>
                        {selectedProduct.category && <span>· {selectedProduct.category}</span>}
                        <span>· In Stock: <strong className="text-slate-900">{selectedProduct.quantity || 0} units</strong></span>
                        <span>· Base Cost: <strong className="text-slate-900">RM {parseFloat(selectedProduct.cost_price || 0).toFixed(2)}</strong></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductSearch('');
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline flex-shrink-0 ml-2"
                    >
                      Change Product
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={loadingProducts ? 'Loading branch items...' : 'Search by product name or SKU...'}
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        disabled={loadingProducts}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Results dropdown */}
                    {loadingProducts ? (
                      <div className="mt-1 p-3 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-lg">
                        Loading branch inventory items...
                      </div>
                    ) : branchProducts.length === 0 ? (
                      <div className="mt-1 p-3 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-lg">
                        No products available at this branch.
                      </div>
                    ) : (
                      <div className="mt-1 border border-slate-200 rounded-lg max-h-56 overflow-y-auto bg-white shadow-lg divide-y divide-slate-100 z-10 relative">
                        {productSearchResults.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No matching products found matching "{productSearch}".
                          </div>
                        ) : (
                          productSearchResults.map(p => {
                            const prodName = p.name || p.item_name || 'Product';
                            const prodSku = p.sku || p.item_code || 'N/A';
                            const stockQty = parseInt(p.quantity || 0, 10);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setFormData(prev => ({
                                    ...prev,
                                    cost_per_unit: p.cost_price || ''
                                  }));
                                }}
                                className="w-full text-left p-2.5 hover:bg-indigo-50/50 flex items-center justify-between text-xs transition-colors group cursor-pointer"
                              >
                                <div className="min-w-0 pr-3">
                                  <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                    {prodName}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 font-mono text-[11px]">
                                    <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700 font-medium">
                                      {prodSku}
                                    </span>
                                    {p.category && <span className="text-slate-400">· {p.category}</span>}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                                    stockQty > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {stockQty} in stock
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity and Unit Cost row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Damaged Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct ? (selectedProduct.quantity || 1) : 9999}
                    required
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {selectedProduct && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Max available: {selectedProduct.quantity || 0} units
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Cost Per Unit (RM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Product cost price"
                    value={formData.cost_per_unit}
                    onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pre-filled with base cost; editable if adjusted.
                  </p>
                </div>
              </div>

              {/* Live Cost Snapshot Computation Highlight */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-rose-600 block">
                    Calculated Financial Loss Snapshot
                  </span>
                  <div className="text-xs text-rose-800 mt-0.5">
                    {formData.quantity || 0} units × RM {parseFloat(formData.cost_per_unit || (selectedProduct?.cost_price || 0)).toFixed(2)}
                  </div>
                </div>
                <div className="text-lg font-bold text-rose-700 tracking-tight">
                  RM {computedTotalLoss}
                </div>
              </div>

              {/* Reason Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Damage Reason Category *
                </label>
                <select
                  required
                  value={formData.reason_category}
                  onChange={e => setFormData({ ...formData, reason_category: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {REASON_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Reason Details */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Damage Incident Details
                </label>
                <textarea
                  rows="2"
                  value={formData.reason_details}
                  onChange={e => setFormData({ ...formData, reason_details: e.target.value })}
                  placeholder="Describe incident specifics, batch codes, or carrier details..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Evidence Photos Upload (up to 5) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Evidence Photos (Max 5)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {selectedPhotos.length} / 5 photos
                  </span>
                </div>

                {/* Previews grid */}
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {photoPreviews.map((url, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPhotos.length < 5 && (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="damage-photo-upload"
                    />
                    <label
                      htmlFor="damage-photo-upload"
                      className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-colors text-xs text-slate-600"
                    >
                      <Upload size={16} className="text-slate-400" />
                      <span>Click to upload evidence photos (JPG, PNG, WebP)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedProduct}
                  className="inline-flex items-center gap-2 h-10 px-5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Submitting Report...</span>
                    </>
                  ) : (
                    <>
                      <PackageX size={16} />
                      <span>Confirm & Deduct Stock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW DAMAGE REPORT DETAILS MODAL                                          */}
      {/* ========================================================================= */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 relative my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-indigo-600">
                    #DR-{viewReport.id}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    getCategoryMeta(viewReport.reason_category).color
                  }`}>
                    {getCategoryMeta(viewReport.reason_category).label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Recorded on {new Date(viewReport.created_at).toLocaleString('en-MY')}
                </p>
              </div>
              <button
                onClick={() => setViewReport(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Info Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Affected Inventory Item
                </span>
                <div className="text-base font-bold text-slate-900">{viewReport.item_name}</div>
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                  <span className="font-mono bg-white px-2 py-0.5 border border-slate-200 rounded">
                    SKU: {viewReport.item_code}
                  </span>
                  {viewReport.category && <span>· Category: {viewReport.category}</span>}
                </div>
              </div>

              {/* Loss Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Quantity</span>
                  <span className="text-lg font-bold text-rose-600 mt-0.5 block">
                    -{viewReport.quantity} units
                  </span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Unit Cost</span>
                  <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                    RM {parseFloat(viewReport.cost_per_unit || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-rose-600 block">Total Loss</span>
                  <span className="text-lg font-bold text-rose-700 mt-0.5 block">
                    RM {parseFloat(viewReport.total_value || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Location & Reporter Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Location</span>
                  <div className="font-medium text-slate-900">{viewReport.branch_name}</div>
                  <div className="text-slate-500">{viewReport.business_name}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Reported By</span>
                  <div className="font-medium text-slate-900">{viewReport.reported_by_name || 'System Admin'}</div>
                  <div className="text-slate-500">{viewReport.reported_by_email || '—'}</div>
                </div>
              </div>

              {/* Reason Details Note */}
              <div>
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Incident Explanation / Notes
                </span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed min-h-[50px]">
                  {viewReport.reason_details || 'No additional explanation was recorded.'}
                </div>
              </div>

              {/* Evidence Photos Gallery */}
              <div>
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
                  Photographic Evidence ({viewReport.photos?.length || 0})
                </span>
                {viewReport.photos && viewReport.photos.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {viewReport.photos.map((p, i) => (
                      <div
                        key={p.id || i}
                        onClick={() => setLightboxPhoto(p.photo_path)}
                        className="group relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-100 cursor-pointer shadow-xs"
                      >
                        <img
                          src={p.photo_path}
                          alt={`Evidence #${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ExternalLink size={16} className="text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs text-slate-400">
                    No photographic evidence was uploaded with this damage report.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewReport(null)}
                className="h-10 px-5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Delete Damage Report?</h3>
                <p className="text-xs text-slate-400">#DR-{deleteTarget.id}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-2">
              This will permanently delete this damage record for{' '}
              <span className="font-medium text-slate-900">{deleteTarget.item_name}</span> and any
              attached evidence photos.
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5">
              {deleteTarget.quantity} unit(s) will be restored back to {deleteTarget.branch_name}'s stock.
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteReport}
                disabled={deleting}
                className="inline-flex items-center gap-2 h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHOTO LIGHTBOX MODAL                                                      */}
      {/* ========================================================================= */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxPhoto}
              alt="Evidence Full Size"
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/20"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}