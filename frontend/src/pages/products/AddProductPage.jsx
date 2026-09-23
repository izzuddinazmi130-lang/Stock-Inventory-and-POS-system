import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  Package, ChevronRight, ChevronLeft, Building, Store, Tag, Palette,
  Ruler, Hash, DollarSign, ShoppingBag, Users, Briefcase, CheckCircle,
  QrCode, Sparkles, X, AlertTriangle, RefreshCw, Plus, Minus, ArrowLeft
} from 'lucide-react';

// ─── Business-type field schemas ─────────────────────────────────────────────
const FASHION_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', 'Custom'];
const FASHION_CATEGORIES = ['Abaya', 'Kaftan', 'Jubah', 'Blouse', 'Dress', 'Scarf', 'Accessories', 'Other'];
const TECH_CATEGORIES   = ['Keyboard', 'Mouse', 'Monitor', 'CPU', 'RAM', 'SSD', 'HDD', 'Laptop', 'Headset', 'Accessories', 'Other'];

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ['Select Branches', 'Product Details', 'Review & Create'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done   = step > idx;
        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                done   ? 'bg-emerald-50 text-emerald-700' :
                active ? 'bg-indigo-600 text-white' :
                         'bg-slate-100 text-slate-500'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : idx}
              </div>
              <span className={`text-xs font-semibold hidden sm:block truncate ${active ? 'text-indigo-900' : done ? 'text-emerald-700' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 flex-shrink-0 mx-2 transition-all ${done ? 'bg-emerald-200' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AddProductPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 state
  const [businesses, setBusinesses]   = useState([]);
  const [branches, setBranches]       = useState([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [selectedBizObj, setSelectedBizObj] = useState(null);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [variantAttributes, setVariantAttributes] = useState([]);

  // Step 2 state — product form
  const [form, setForm] = useState({
    item_name:       '',
    category:        '',
    customCategory:  '',
    variants:        {},
    mark_as_new:     false,
    new_duration_days: 14,
    variant_color:   '',
    size:            '',
    model:           '',
    quantity:        0,
    minimum_quantity: 5,
    unit_price:      0,
    selling_price:   0,
    price_dealer:    0,
    price_staff:     0,
  });

  // Step 3 — result
  const [createdProduct, setCreatedProduct] = useState(null);
  const [previewSku, setPreviewSku]         = useState('');
  const [previewQr,  setPreviewQr]          = useState('');

  // ── Init: load businesses (super_admin) or get own branch
  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/businesses').then(r => {
        if (r.data.success) setBusinesses(r.data.businesses || r.data.data || []);
      }).catch(() => {});
    } else if (user?.branch_id) {
      // Non-super_admin: load own branch info
      api.get(`/branches/${user.branch_id}`).then(r => {
        if (r.data.success) {
          const br = r.data.data || r.data.branch;
          setBranches([br]);
          setSelectedBranches([br.id]);
          setStep(2);
          // Also load business
          if (br.business_id) {
            api.get('/businesses').then(rb => {
              if (rb.data.success) {
                const biz = (rb.data.businesses || rb.data.data || []).find(b => b.id === br.business_id);
                if (biz) { setSelectedBizObj(biz); setSelectedBiz(String(biz.id)); }
              }
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    }
  }, [user, isSuperAdmin]);

  // Load branches when biz changes
  useEffect(() => {
    if (!selectedBiz) {
      setVariantAttributes([]);
      if (isSuperAdmin) {
        setBranches([]);
        setSelectedBranches([]);
      }
      return;
    }
    
    api.get('/products/variant-attributes', { params: { business_id: selectedBiz } })
      .then(r => {
        if (r.data.success) setVariantAttributes(r.data.attributes);
      })
      .catch(() => {});

    if (isSuperAdmin) {
      api.get(`/businesses/${selectedBiz}/branches`).then(r => {
        if (r.data.success) {
          const brs = r.data.branches || r.data.data || [];
          setBranches(brs);
        }
      }).catch(() => {});
    }
    const obj = businesses.find(b => String(b.id) === String(selectedBiz));
    setSelectedBizObj(obj || null);
  }, [selectedBiz, businesses, isSuperAdmin]);

  // Preview SKU whenever branch / category changes
  useEffect(() => {
    const branchId = selectedBranches[0];
    const cat = form.category === 'Other' ? form.customCategory : form.category;
    if (!branchId || !cat) { setPreviewSku(''); setPreviewQr(''); return; }
    api.get('/products/preview-sku', { params: { branch_id: branchId, category: cat } })
      .then(r => {
        if (r.data.success) { setPreviewSku(r.data.sku); setPreviewQr(r.data.qr_code); }
      }).catch(() => {});
  }, [selectedBranches, form.category, form.customCategory]);

  const bizType = selectedBizObj?.industry || 'general';
  const isFashion = bizType === 'fashion';
  const isTech    = bizType === 'technology';

  const effectiveCategory = form.category === 'Other' ? form.customCategory : form.category;
  const effectiveSize     = form.size && !FASHION_SIZES.includes(form.size) ? form.size : form.size;

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const toggleBranch = (brId) => {
    setSelectedBranches(prev =>
      prev.includes(brId) ? prev.filter(id => id !== brId) : [...prev, brId]
    );
  };

  // ── Step navigation
  const goStep2 = () => {
    if (selectedBranches.length === 0) { setError('Please select at least one branch.'); return; }
    setError('');
    setStep(2);
  };

  const goStep3 = () => {
    if (!form.item_name.trim())    { setError('Product name is required.'); return; }
    if (!effectiveCategory.trim()) { setError('Category is required.'); return; }
    setError('');
    setStep(3);
  };

  // ── Submit
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Build variants object from individual fields
      const variants = { ...form.variants };
      if (form.variant_color) variants.colour = form.variant_color;
      if (effectiveSize) variants.size = effectiveSize;
      if (form.model) variants.model = form.model;

      const payload = {
        item_name:        form.item_name.trim(),
        category:         effectiveCategory,
        quantity:         parseInt(form.quantity) || 0,
        minimum_quantity: parseInt(form.minimum_quantity) || 5,
        unit_price:       parseFloat(form.unit_price) || 0,
        selling_price:    parseFloat(form.selling_price) || 0,
        price_dealer:     parseFloat(form.price_dealer) || 0,
        price_staff:      parseFloat(form.price_staff) || 0,
        branch_ids:       selectedBranches,
        branch_id:        selectedBranches[0],
        variants:         variants,
        mark_as_new:      form.mark_as_new,
        new_duration_days: form.new_duration_days
      };

      const res = await api.post('/products', payload);
      if (res.data.success) {
        setCreatedProduct(res.data);
        setStep(4); // success screen
      } else {
        setError(res.data.message || 'Failed to create product.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedBranchObjs = branches.filter(b => selectedBranches.includes(b.id));

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/products" className="inline-flex items-center gap-2 h-9 px-3 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Add New Product</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {step < 4 ? 'Fill out the product details to create inventory entries' : 'Product created successfully!'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {step < 4 && isSuperAdmin && <StepBar step={step} />}

        {/* Global error */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── STEP 1: Select Branches ──────────────────────────────────── */}
        {step === 1 && isSuperAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
              <Building className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900">Select Business & Branches</h3>
              {user?.role === 'super_admin' && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700">Multi-branch supported</span>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Business *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {businesses.map(biz => (
                  <button
                    key={biz.id}
                    type="button"
                    onClick={() => { setSelectedBiz(String(biz.id)); setSelectedBranches([]); }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      String(selectedBiz) === String(biz.id)
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-sm">{biz.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 capitalize">
                      {biz.industry || 'General'} business
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {selectedBiz && branches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Branches (multi-select) *
                  </label>
                  {user?.role === 'super_admin' && (
                    <div className="flex gap-2">
                      <button type="button" className="text-[11px] text-indigo-600 hover:text-indigo-700"
                        onClick={() => setSelectedBranches(branches.map(b => b.id))}>Select All</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" className="text-[11px] text-slate-500 hover:text-slate-700"
                        onClick={() => setSelectedBranches([])}>Clear</button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {branches.map(br => {
                    const isChecked = selectedBranches.includes(br.id);
                    return (
                      <button
                        key={br.id}
                        type="button"
                        onClick={() => toggleBranch(br.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        } cursor-pointer`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                          isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-slate-100'
                        }`}>
                          {isChecked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <Store className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{br.name}</div>
                          {br.branch_code && (
                            <div className="text-[11px] text-slate-500 font-mono">Code: {br.branch_code}</div>
                          )}
                        </div>
                        {isChecked && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 ml-auto">Selected</span>}
                      </button>
                    );
                  })}
                </div>

                {selectedBranches.length > 0 && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
                    <span className="font-bold text-indigo-900">{selectedBranches.length} branch(es)</span> selected — product will be created in each.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={goStep2}
                disabled={selectedBranches.length === 0}
                className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next: Product Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 1 && !isSuperAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-3" />
            Loading your branch product form...
          </div>
        )}

        {/* ── STEP 2: Product Details ──────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
              <Package className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900">Product Details</h3>
              <span className="ml-auto text-[11px] text-slate-500 capitalize">
                {selectedBizObj?.name} · {bizType} type
              </span>
            </div>

            {/* SKU Preview */}
            {previewSku && (
              <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Hash className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">Auto-Generated SKU Preview</div>
                  <div className="font-mono text-sm font-bold text-indigo-600">{previewSku}</div>
                </div>
                <div className="flex-1 min-w-0 pl-3 border-l border-slate-200">
                  <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">QR Token Preview</div>
                  <div className="font-mono text-[11px] text-slate-500 truncate">{previewQr}</div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  name="item_name"
                  required
                  placeholder={isFashion ? 'e.g. Abaya Zehra - Black' : 'e.g. Mechanical Keyboard RGB'}
                  className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                  value={form.item_name}
                  onChange={handleFormChange}
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select name="category" value={form.category} onChange={handleFormChange} className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full">
                    <option value="">-- Select --</option>
                    {(isFashion ? FASHION_CATEGORIES : isTech ? TECH_CATEGORIES : [...FASHION_CATEGORIES, ...TECH_CATEGORIES]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {form.category === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Custom Category *</label>
                    <input type="text" name="customCategory" placeholder="Type category..."
                      className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full" value={form.customCategory} onChange={handleFormChange} />
                  </div>
                )}
              </div>

              {/* Product Variants */}
              {isFashion ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1"><Palette className="w-3.5 h-3.5 inline mr-1 text-pink-500" />Colour / Variant</label>
                      <input
                        type="text"
                        name="variant_color"
                        className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                        placeholder="e.g. Black, Mint Green"
                        value={form.variant_color}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1"><Ruler className="w-3.5 h-3.5 inline mr-1 text-amber-500" />Size</label>
                      <select
                        name="size"
                        className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                        value={form.size}
                        onChange={handleFormChange}
                      >
                        <option value="">-- Select --</option>
                        {FASHION_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value={form.size && !FASHION_SIZES.includes(form.size) ? form.size : ''}>
                          {form.size && !FASHION_SIZES.includes(form.size) ? form.size : 'Other'}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1"><Tag className="w-3.5 h-3.5 inline mr-1 text-purple-600" />Style / Model</label>
                    <input
                      type="text"
                      name="model"
                      className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                      placeholder="e.g. Modern, Classic"
                      value={form.model}
                      onChange={handleFormChange}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model / Part Number</label>
                  <input
                    type="text"
                    name="model"
                    className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                    placeholder="e.g. WH-1000XM5"
                    value={form.model}
                    onChange={handleFormChange}
                  />
                </div>
              )}

              {/* Dynamic Variants */}
              {variantAttributes.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <label className="block text-sm font-medium text-slate-700 mb-1">Additional Custom Attributes</label>
                  </div>
                  {variantAttributes.map(attr => (
                    <div key={attr.attribute_key} className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1">{attr.label}</label>
                      {attr.input_type === 'select' ? (
                        <select
                          value={form.variants?.[attr.attribute_key] || ''}
                          onChange={e => setForm(prev => ({ ...prev, variants: { ...prev.variants, [attr.attribute_key]: e.target.value } }))}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select {attr.label}</option>
                          {(attr.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={form.variants?.[attr.attribute_key] || ''}
                          onChange={e => setForm(prev => ({ ...prev, variants: { ...prev.variants, [attr.attribute_key]: e.target.value } }))}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder={attr.label}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Stock *</label>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, quantity: Math.max(0, parseInt(f.quantity || 0) - 1) }))}
                      className="inline-flex items-center gap-2 h-9 px-3 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors p-2 flex-shrink-0">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input type="number" name="quantity" min="0"
                      className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full text-center font-mono font-bold"
                      value={form.quantity} onChange={handleFormChange} />
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, quantity: parseInt(f.quantity || 0) + 1 }))}
                      className="inline-flex items-center gap-2 h-9 px-3 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors p-2 flex-shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-500" />Low Stock Threshold
                  </label>
                  <input type="number" name="minimum_quantity" min="0"
                    className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full font-mono"
                    value={form.minimum_quantity} onChange={handleFormChange} />
                </div>
              </div>

              {/* Mark as New toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-700">Mark as New Arrival</div>
                  <div className="text-xs text-slate-500">Shows a "NEW" badge on the product</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, mark_as_new: !prev.mark_as_new }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.mark_as_new ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.mark_as_new ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {form.mark_as_new && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New badge duration</label>
                  <select
                    value={form.new_duration_days || 14}
                    onChange={e => setForm(prev => ({ ...prev, new_duration_days: parseInt(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </div>
              )}

              {/* 3-Tier Pricing */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  <label className="block text-sm font-medium text-slate-700">3-Tier Pricing</label>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Customer Price', key: 'selling_price', icon: ShoppingBag, color: 'text-emerald-600' },
                    { label: 'Dealer Price',   key: 'price_dealer',  icon: Briefcase,   color: 'text-indigo-600'  },
                    { label: 'Staff Price',    key: 'price_staff',   icon: Users,       color: 'text-purple-600'  },
                  ].map(p => (
                    <div key={p.key} className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <p.icon className={`w-4 h-4 flex-shrink-0 ${p.color}`} />
                      <span className="text-xs text-slate-600 w-32 flex-shrink-0">{p.label}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">RM</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name={p.key}
                          className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full pl-9 font-mono"
                          value={form[p.key]}
                          onChange={handleFormChange}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Price (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 text-slate-500">
                  Cost / Purchase Price (internal use, optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">RM</span>
                  <input type="number" step="0.01" min="0" name="unit_price"
                    className="bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full pl-9 font-mono"
                    placeholder="0.00" value={form.unit_price} onChange={handleFormChange} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
              {isSuperAdmin ? (
                <button onClick={() => { setStep(1); setError(''); }} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <Link to="/products" className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back to Products
                </Link>
              )}
              <button onClick={goStep3} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                Review & Confirm <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900">Review &amp; Confirm</h3>
            </div>

            {/* Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
              <h4 className="font-bold text-slate-900 text-base mb-1">{form.item_name}</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700">{effectiveCategory}</span>
                {form.variant_color && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700">{form.variant_color}</span>}
                {effectiveSize && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">{effectiveSize}</span>}
                {form.model && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600">{form.model}</span>}
                {Object.entries(form.variants || {}).map(([key, value]) => (
                  value && <span key={key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-teal-50 text-teal-700">{value}</span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">Stock</div>
                  <div className="text-slate-900 font-mono font-bold">{form.quantity} units initial</div>
                  <div className="text-amber-600">Min threshold: {form.minimum_quantity}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">SKU (auto-generated)</div>
                  <div className="font-mono text-indigo-600 font-bold">{previewSku || 'Generating...'}</div>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                {[
                  { label: 'Customer Price', key: 'selling_price', icon: ShoppingBag, color: 'text-emerald-600' },
                  { label: 'Dealer Price',   key: 'price_dealer',  icon: Briefcase,   color: 'text-indigo-600'  },
                  { label: 'Staff Price',    key: 'price_staff',   icon: Users,       color: 'text-purple-600'  },
                ].map(p => (
                  <div key={p.key} className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <p.icon className={`w-4 h-4 flex-shrink-0 ${p.color}`} />
                    <span className="text-xs text-slate-600 w-32 flex-shrink-0">{p.label}</span>
                    <div className="font-mono font-bold text-sm text-slate-900">RM {parseFloat(form[p.key] || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Branches */}
            <div className="mb-5">
              <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 mb-2">
                Creating in {selectedBranchObjs.length} Branch(es)
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedBranchObjs.map(br => (
                  <div key={br.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700">
                    <Store className="w-3.5 h-3.5 text-amber-500" />
                    {br.name}
                    {br.branch_code && <span className="font-mono text-slate-500">({br.branch_code})</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button onClick={() => { setStep(2); setError(''); }} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</> : <><Sparkles className="w-4 h-4" /> Create Product</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Success Screen ──────────────────────────────────── */}
        {step === 4 && createdProduct && (
          <div className="space-y-5">
            {/* Success header */}
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-1">Product Created!</h2>
              <p className="text-sm text-slate-500">{createdProduct.message}</p>
            </div>

            {/* Product detail card */}
            {createdProduct.item && (
              <div className="bg-white border border-emerald-200 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">{createdProduct.item.item_name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700">{createdProduct.item.category}</span>
                      {createdProduct.item.variant_color && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700">{createdProduct.item.variant_color}</span>}
                      {createdProduct.item.size && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">{createdProduct.item.size}</span>}
                      {createdProduct.item.model && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600">{createdProduct.item.model}</span>}
                      {Object.entries(createdProduct.item.variants || {}).map(([key, value]) => (
                        value && <span key={key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-teal-50 text-teal-700">{value}</span>
                      ))}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> New
                  </span>
                </div>

                {/* SKU & QR */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Auto-Generated SKU
                    </div>
                    <div className="font-mono text-lg font-extrabold text-indigo-600">{createdProduct.item.item_code}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <QrCode className="w-3 h-3" /> QR Token
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 break-all leading-relaxed">{createdProduct.item.qr_code}</div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-2 mb-5 text-center">
                  {[
                    { label: 'Customer', value: createdProduct.item.selling_price, color: 'text-emerald-600' },
                    { label: 'Dealer', value: createdProduct.item.price_dealer, color: 'text-indigo-600' },
                    { label: 'Staff', value: createdProduct.item.price_staff, color: 'text-purple-600' },
                  ].map(p => (
                    <div key={p.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400">{p.label} Price</div>
                      <div className={`font-mono font-bold text-sm mt-1 ${p.color}`}>RM {parseFloat(p.value || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                {/* Stock & Branch */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Initial Stock: <strong className="text-slate-900 font-mono">{createdProduct.item.quantity} units</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Store className="w-4 h-4 text-amber-500" />
                    <span>Branch: <strong className="text-slate-900">{createdProduct.item.branch_name}</strong></span>
                  </div>
                </div>

                {createdProduct.total_branches > 1 && (
                  <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700">
                    Product also created in {createdProduct.total_branches - 1} additional branch(es) with unique SKUs.
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setStep(isSuperAdmin ? 1 : 2); setForm({ item_name:'', category:'', customCategory:'', variants:{}, mark_as_new:false, new_duration_days:14, variant_color:'', size:'', model:'', quantity:0, minimum_quantity:5, unit_price:0, selling_price:0, price_dealer:0, price_staff:0 }); setCreatedProduct(null); setPreviewSku(''); setPreviewQr(''); setError(''); }}
                className="flex-1 inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center"
              >
                <Plus className="w-4 h-4" /> Add Another Product
              </button>
              <button onClick={() => navigate('/products')} className="flex-1 inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center">
                <Package className="w-4 h-4" /> View All Products
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
