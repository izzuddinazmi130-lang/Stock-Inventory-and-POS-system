import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Field, Input, Select, MoneyInput, FormAlert } from '../../components/ui/Form';
import {
  Package, ChevronRight, ChevronLeft, Building, Store, Hash, CheckCircle, QrCode,
  Sparkles, AlertTriangle, RefreshCw, Plus, Minus, ArrowLeft, Briefcase, Pencil, Info
} from 'lucide-react';

function getAttributeOptions(options) {
  if (Array.isArray(options)) return options;
  if (typeof options !== 'string') return [];
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return options.split(',').map(option => option.trim()).filter(Boolean);
  }
}

const money = (v) => `RM ${(parseFloat(v) || 0).toFixed(2)}`;
const toInt = (v) => parseInt(v, 10) || 0;
const toMoney = (v) => parseFloat(v) || 0;

// Per-product numbers. With sizes, each size row has its own copy of these.
const PRICE_FIELDS = [
  { key: 'selling_price', label: 'Customer price', hint: 'Normal walk-in price.' },
  { key: 'price_dealer',  label: 'Dealer price',   hint: 'For resellers / wholesale.' },
  { key: 'price_staff',   label: 'Staff price',    hint: 'Employee purchase price.' },
  { key: 'unit_price',    label: 'Cost price',     hint: 'What you paid. Internal only.' },
];
const ROW_FIELDS = ['quantity', 'minimum_quantity', ...PRICE_FIELDS.map(p => p.key)];

const EMPTY_FORM = {
  item_name: '',
  category: '',
  variants: {},
  size_variants: [],
  mark_as_new: false,
  new_duration_days: 14,
  // For a product without sizes these are its values; with sizes they are the "fill all sizes" defaults.
  quantity: '',
  minimum_quantity: 5,
  selling_price: '',
  price_dealer: '',
  price_staff: '',
  unit_price: '',
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ steps, current }) {
  const currentIdx = steps.findIndex(s => s.key === current);
  return (
    <ol className="flex items-center mb-6">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <li className="flex items-center gap-2 min-w-0">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                done ? 'bg-success-muted text-success-fg' : active ? 'bg-accent text-white' : 'bg-sunken text-ink-muted'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </span>
              <span className={`text-xs font-semibold truncate hidden sm:block ${active ? 'text-ink' : done ? 'text-success-fg' : 'text-ink-muted'}`}>{s.label}</span>
            </li>
            {i < steps.length - 1 && <li className={`h-px flex-1 mx-3 min-w-4 ${done ? 'bg-success-line' : 'bg-line'}`} aria-hidden="true" />}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function Card({ title, description, icon: Icon, children, footer }) {
  return (
    <div className="bg-surface border border-line rounded-xl">
      <div className="px-6 pt-5 pb-4 border-b border-line-soft flex items-start gap-3">
        {Icon && <div className="p-2 rounded-lg bg-accent-soft text-accent"><Icon className="w-5 h-5" /></div>}
        <div>
          <h2 className="font-bold text-ink">{title}</h2>
          {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6 space-y-6">{children}</div>
      {footer && <div className="px-6 py-4 border-t border-line-soft bg-subtle/60 rounded-b-xl flex items-center justify-between gap-3">{footer}</div>}
    </div>
  );
}

const btnPrimary = 'inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = 'inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors';

// ─── Main component ───────────────────────────────────────────────────────────
export default function AddProductPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = user?.role === 'super_admin';

  const steps = useMemo(() => [
    ...(isSuperAdmin ? [{ key: 'where', label: 'Where' }] : []),
    { key: 'details', label: 'Product details' },
    { key: 'pricing', label: 'Stock & prices' },
    { key: 'review', label: 'Review' },
  ], [isSuperAdmin]);

  const [step, setStep] = useState(isSuperAdmin ? 'where' : 'details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  // Where
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [selectedBranches, setSelectedBranches] = useState([]);

  // Business form configuration
  const [categories, setCategories] = useState([]);
  const [variantAttributes, setVariantAttributes] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [createdProduct, setCreatedProduct] = useState(null);
  const [previewSku, setPreviewSku] = useState('');

  // ── Init
  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin) {
      api.get('/businesses').then(r => {
        if (r.data.success) setBusinesses(r.data.businesses || r.data.data || []);
      }).catch(() => {});
      // Deep link from a branch page: /products/add?business_id=1&branch_id=2
      const qBiz = searchParams.get('business_id');
      const qBranch = searchParams.get('branch_id');
      if (qBiz) setSelectedBiz(String(qBiz));
      if (qBiz && qBranch) {
        setSelectedBranches([parseInt(qBranch, 10)]);
        setStep('details');
      }
    } else if (user.branch_id) {
      // Branch admins always add to their own branch; no network round trip needed
      setSelectedBiz(String(user.business_id || ''));
      setBranches([{ id: user.branch_id, name: user.branch_name }]);
      setSelectedBranches([user.branch_id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isSuperAdmin]);

  // Load branches + product form configuration whenever the business changes
  useEffect(() => {
    setConfigLoaded(false);
    if (!selectedBiz) { setCategories([]); setVariantAttributes([]); return; }

    api.get('/products/form-config', { params: { business_id: selectedBiz } })
      .then(r => {
        if (r.data.success) {
          setCategories(r.data.categories || []);
          setVariantAttributes(r.data.attributes || []);
          setForm(prev => ({ ...prev, category: '', variants: {}, size_variants: [] }));
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));

    if (isSuperAdmin) {
      api.get(`/businesses/${selectedBiz}/branches`).then(r => {
        if (r.data.success) setBranches(r.data.branches || r.data.data || []);
      }).catch(() => {});
    }
  }, [selectedBiz, isSuperAdmin]);

  // SKU preview for the review step
  useEffect(() => {
    const branchId = selectedBranches[0];
    if (!branchId || !form.category) { setPreviewSku(''); return; }
    api.get('/products/preview-sku', { params: { branch_id: branchId, category: form.category } })
      .then(r => { if (r.data.success) setPreviewSku(r.data.sku); })
      .catch(() => {});
  }, [selectedBranches, form.category]);

  const sizeAttribute = variantAttributes.find(attr => attr.attribute_key === 'size' && attr.input_type === 'select');
  const otherAttributes = variantAttributes.filter(attr => attr !== sizeAttribute);
  const hasSizes = form.size_variants.length > 0;
  const selectedBizObj = isSuperAdmin
    ? businesses.find(b => String(b.id) === String(selectedBiz))
    : { id: user?.business_id, name: user?.business_name };
  const selectedBranchObjs = branches.filter(b => selectedBranches.includes(b.id));

  // ── Form helpers
  const setField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const toggleSize = (size) => {
    setForm(prev => {
      const exists = prev.size_variants.some(row => row.size === size);
      if (exists) return { ...prev, size_variants: prev.size_variants.filter(row => row.size !== size) };
      // New size rows start from the "fill all sizes" defaults
      const row = { size };
      ROW_FIELDS.forEach(k => { row[k] = prev[k]; });
      // Keep sizes in the order the business defined them
      const order = getAttributeOptions(sizeAttribute?.options);
      const rows = [...prev.size_variants, row].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
      return { ...prev, size_variants: rows };
    });
    setErrors(e => ({ ...e, sizes: undefined }));
  };

  const updateSizeRow = (size, key, value) => {
    setForm(prev => ({ ...prev, size_variants: prev.size_variants.map(row => (row.size === size ? { ...row, [key]: value } : row)) }));
  };

  const applyDefaultsToAllSizes = () => {
    setForm(prev => ({
      ...prev,
      size_variants: prev.size_variants.map(row => {
        const next = { ...row };
        ROW_FIELDS.forEach(k => { if (prev[k] !== '' && prev[k] != null) next[k] = prev[k]; });
        return next;
      })
    }));
  };

  // ── Validation per step
  const validate = (which) => {
    const e = {};
    if (which === 'where') {
      if (!selectedBiz) e.business = 'Choose a business.';
      if (selectedBranches.length === 0) e.branches = 'Choose at least one branch.';
    }
    if (which === 'details') {
      if (!form.item_name.trim()) e.item_name = 'Enter the product name.';
      if (!form.category) e.category = 'Choose a category.';
      if (sizeAttribute && form.size_variants.length === 0) e.sizes = `Pick at least one ${sizeAttribute.label.toLowerCase()}.`;
    }
    if (which === 'pricing') {
      const rows = hasSizes ? form.size_variants : [form];
      rows.forEach(row => {
        const prefix = hasSizes ? `${row.size}.` : '';
        if (row.quantity !== '' && (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 0)) e[`${prefix}quantity`] = 'Whole number, 0 or more.';
        if (row.minimum_quantity !== '' && (!Number.isInteger(Number(row.minimum_quantity)) || Number(row.minimum_quantity) < 0)) e[`${prefix}minimum_quantity`] = 'Whole number, 0 or more.';
        PRICE_FIELDS.forEach(p => { if (row[p.key] !== '' && Number(row[p.key]) < 0) e[`${prefix}${p.key}`] = 'Cannot be negative.'; });
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (target) => { setError(''); setStep(target); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const next = (from, to) => { if (validate(from)) go(to); };

  // Soft warnings shown on review (not blocking)
  const warnings = useMemo(() => {
    const list = [];
    const rows = hasSizes ? form.size_variants : [{ ...form, size: null }];
    rows.forEach(row => {
      const label = row.size ? `Size ${row.size}: ` : '';
      if (toMoney(row.selling_price) === 0) list.push(`${label}customer price is RM 0.00.`);
      if (toMoney(row.unit_price) > 0 && toMoney(row.selling_price) > 0 && toMoney(row.selling_price) < toMoney(row.unit_price)) {
        list.push(`${label}customer price is lower than the cost price.`);
      }
    });
    return list;
  }, [form, hasSizes]);

  // ── Submit
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        item_name:         form.item_name.trim(),
        category:          form.category,
        quantity:          toInt(form.quantity),
        minimum_quantity:  form.minimum_quantity === '' ? 5 : toInt(form.minimum_quantity),
        unit_price:        toMoney(form.unit_price),
        selling_price:     toMoney(form.selling_price),
        price_dealer:      toMoney(form.price_dealer),
        price_staff:       toMoney(form.price_staff),
        size_variants:     form.size_variants.map(row => ({
          size: row.size,
          quantity: toInt(row.quantity),
          minimum_quantity: row.minimum_quantity === '' ? 5 : toInt(row.minimum_quantity),
          unit_price: toMoney(row.unit_price),
          selling_price: toMoney(row.selling_price),
          price_dealer: toMoney(row.price_dealer),
          price_staff: toMoney(row.price_staff),
        })),
        branch_ids:        selectedBranches,
        branch_id:         selectedBranches[0],
        variants:          form.variants,
        mark_as_new:       form.mark_as_new,
        new_duration_days: form.new_duration_days
      };

      const res = await api.post('/products', payload);
      if (res.data.success) {
        setCreatedProduct(res.data);
        go('done');
      } else {
        setError(res.data.message || 'Failed to create product.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Keep business + branches, clear the product
  const startAnother = () => {
    setForm(f => ({ ...EMPTY_FORM, minimum_quantity: f.minimum_quantity }));
    setCreatedProduct(null);
    setErrors({});
    go('details');
  };

  const whereLabel = (
    <>
      <strong className="text-ink">{selectedBizObj?.name || 'Business'}</strong>
      {' · '}
      {selectedBranchObjs.length === 0 ? '—'
        : selectedBranchObjs.length === 1 ? selectedBranchObjs[0].name
        : `${selectedBranchObjs[0].name} + ${selectedBranchObjs.length - 1} more`}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/products" className="p-2 rounded-lg text-ink-muted hover:bg-sunken hover:text-ink" title="Back to products">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Add New Product</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {step === 'done' ? 'Print the QR labels and stick them on the stock.' : 'Create a product in the catalog and give it starting stock.'}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {step !== 'done' && <StepBar steps={steps} current={step} />}

        {/* Where the product is going (steps after "Where") */}
        {step !== 'where' && step !== 'done' && (
          <div className="mb-4 px-4 py-2.5 bg-surface border border-line rounded-xl flex items-center justify-between gap-3 text-sm text-ink-secondary">
            <span className="flex items-center gap-2 min-w-0">
              <Store className="w-4 h-4 text-warning-fg flex-shrink-0" />
              <span className="truncate">Adding to {whereLabel}</span>
            </span>
            {isSuperAdmin && (
              <button type="button" onClick={() => go('where')} className="text-xs font-semibold text-accent hover:text-accent-fg flex-shrink-0">Change</button>
            )}
          </div>
        )}

        {error && <div className="mb-4"><FormAlert onClose={() => setError('')}>{error}</FormAlert></div>}

        {/* ── STEP: Where ─────────────────────────────────────────────── */}
        {step === 'where' && (
          <Card
            icon={Building}
            title="Where is this product sold?"
            description="Choose the business, then every branch that will stock it. Each branch gets its own stock count."
            footer={<>
              <Link to="/products" className={btnSecondary}>Cancel</Link>
              <button type="button" onClick={() => next('where', 'details')} className={btnPrimary}>
                Next: Product details <ChevronRight className="w-4 h-4" />
              </button>
            </>}
          >
            <Field label="Business" required error={errors.business}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {businesses.map(biz => {
                  const active = String(selectedBiz) === String(biz.id);
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      onClick={() => { if (!active) { setSelectedBiz(String(biz.id)); setSelectedBranches([]); } setErrors(e => ({ ...e, business: undefined })); }}
                      className={`p-3 rounded-lg border text-left transition-colors ${active ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-line-strong'}`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Briefcase className={`w-4 h-4 ${active ? 'text-accent' : 'text-ink-muted'}`} /> {biz.name}
                      </div>
                      <div className="text-[11px] text-ink-muted capitalize mt-0.5">{biz.industry || 'General'}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            {selectedBiz && (
              <Field label="Branches" required error={errors.branches}>
                {branches.length === 0 ? (
                  <p className="text-sm text-ink-muted">This business has no branches yet. Add one under Businesses first.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-ink-muted">{selectedBranches.length} of {branches.length} selected</span>
                      <button
                        type="button"
                        onClick={() => { setSelectedBranches(selectedBranches.length === branches.length ? [] : branches.map(b => b.id)); setErrors(e => ({ ...e, branches: undefined })); }}
                        className="text-xs font-semibold text-accent hover:text-accent-fg"
                      >
                        {selectedBranches.length === branches.length ? 'Clear all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {branches.map(br => {
                        const checked = selectedBranches.includes(br.id);
                        return (
                          <button
                            key={br.id}
                            type="button"
                            onClick={() => {
                              setSelectedBranches(prev => (checked ? prev.filter(id => id !== br.id) : [...prev, br.id]));
                              setErrors(e => ({ ...e, branches: undefined }));
                            }}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${checked ? 'border-success bg-success-soft' : 'border-line bg-surface hover:border-line-strong'}`}
                          >
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 border ${checked ? 'bg-success border-success' : 'border-line-strong bg-surface'}`}>
                              {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink truncate">{br.name}</span>
                              <span className="block text-[11px] text-ink-muted font-mono">
                                {br.branch_code || `BR${br.id}`}{Number(br.is_active) === 0 && <span className="ml-1 font-sans text-warning-fg">· inactive</span>}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </Field>
            )}
          </Card>
        )}

        {/* ── STEP: Product details ───────────────────────────────────── */}
        {step === 'details' && (
          <Card
            icon={Package}
            title="Product details"
            description="What the product is. Stock and prices come next."
            footer={<>
              {isSuperAdmin
                ? <button type="button" onClick={() => go('where')} className={btnSecondary}><ChevronLeft className="w-4 h-4" /> Back</button>
                : <Link to="/products" className={btnSecondary}>Cancel</Link>}
              <button type="button" onClick={() => next('details', 'pricing')} className={btnPrimary}>
                Next: Stock &amp; prices <ChevronRight className="w-4 h-4" />
              </button>
            </>}
          >
            <Field label="Product name" required error={errors.item_name}>
              <Input
                autoFocus
                value={form.item_name}
                onChange={e => setField('item_name', e.target.value)}
                placeholder="e.g. Kaftan Aisyah Embroidered"
                error={errors.item_name}
                maxLength={200}
              />
            </Field>

            <Field label="Category" required error={errors.category}>
              {configLoaded && categories.length === 0 ? (
                <div className="p-3 bg-warning-soft border border-warning-line rounded-lg text-sm text-warning-fg">
                  This business has no categories yet.{' '}
                  {isSuperAdmin
                    ? <Link to={`/businesses/${selectedBiz}/forms`} className="font-semibold underline">Set them up in Product Form Setup</Link>
                    : 'Ask HQ to add categories for your business.'}
                </div>
              ) : (
                <Select value={form.category} onChange={e => setField('category', e.target.value)} error={errors.category}>
                  <option value="">Choose a category…</option>
                  {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                </Select>
              )}
            </Field>

            {otherAttributes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {otherAttributes.map(attr => {
                  const value = form.variants?.[attr.attribute_key] || '';
                  const setValue = (v) => setForm(prev => ({ ...prev, variants: { ...prev.variants, [attr.attribute_key]: v } }));
                  return (
                    <Field key={attr.attribute_key} label={attr.label} optional>
                      {attr.input_type === 'select' ? (
                        <Select value={value} onChange={e => setValue(e.target.value)}>
                          <option value="">Choose…</option>
                          {getAttributeOptions(attr.options).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </Select>
                      ) : (
                        <Input value={value} onChange={e => setValue(e.target.value)} placeholder={attr.label} />
                      )}
                    </Field>
                  );
                })}
              </div>
            )}

            {sizeAttribute && (
              <Field
                label={`${sizeAttribute.label}s you are adding`}
                required
                error={errors.sizes}
                hint="Each size becomes its own product with its own SKU, stock and prices."
              >
                <div className="flex flex-wrap gap-2">
                  {getAttributeOptions(sizeAttribute.options).map(size => {
                    const selected = form.size_variants.some(row => row.size === size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        aria-pressed={selected}
                        className={`min-w-12 h-9 px-3 rounded-lg border text-sm font-semibold transition-colors ${selected ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink-secondary hover:border-accent-line'}`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            <div className="p-3 bg-subtle rounded-lg border border-line space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-ink">Mark as new arrival</div>
                  <div className="text-xs text-ink-muted">Shows a “NEW” badge on the product for a while.</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.mark_as_new}
                  onClick={() => setField('mark_as_new', !form.mark_as_new)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${form.mark_as_new ? 'bg-accent' : 'bg-line-strong'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${form.mark_as_new ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {form.mark_as_new && (
                <Field label="Show the badge for">
                  <Select value={form.new_duration_days || 14} onChange={e => setField('new_duration_days', parseInt(e.target.value, 10))} className="sm:max-w-[12rem]">
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </Select>
                </Field>
              )}
            </div>
          </Card>
        )}

        {/* ── STEP: Stock & prices ────────────────────────────────────── */}
        {step === 'pricing' && (
          <Card
            icon={Hash}
            title="Stock & prices"
            description={selectedBranches.length > 1
              ? `The starting stock is added in each of the ${selectedBranches.length} selected branches.`
              : 'How many you have now, and what to charge.'}
            footer={<>
              <button type="button" onClick={() => go('details')} className={btnSecondary}><ChevronLeft className="w-4 h-4" /> Back</button>
              <button type="button" onClick={() => next('pricing', 'review')} className={btnPrimary}>
                Next: Review <ChevronRight className="w-4 h-4" />
              </button>
            </>}
          >
            {!hasSizes ? (
              <>
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-3">Stock</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Starting stock" hint="Units on hand right now. 0 is fine." error={errors.quantity}>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Decrease" onClick={() => setField('quantity', Math.max(0, toInt(form.quantity) - 1))} className="h-10 w-10 flex items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-subtle flex-shrink-0"><Minus className="w-4 h-4" /></button>
                        <Input type="number" min="0" step="1" placeholder="0" value={form.quantity} onChange={e => setField('quantity', e.target.value)} className="text-center font-mono font-semibold" error={errors.quantity} />
                        <button type="button" aria-label="Increase" onClick={() => setField('quantity', toInt(form.quantity) + 1)} className="h-10 w-10 flex items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-subtle flex-shrink-0"><Plus className="w-4 h-4" /></button>
                      </div>
                    </Field>
                    <Field label="Low-stock alert at" hint="Flag the product when stock drops to this number." error={errors.minimum_quantity}>
                      <Input type="number" min="0" step="1" value={form.minimum_quantity} onChange={e => setField('minimum_quantity', e.target.value)} className="font-mono" error={errors.minimum_quantity} />
                    </Field>
                  </div>
                </section>
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Prices</h3>
                  <p className="text-xs text-ink-muted mb-3">The POS charges one of the first three, depending on who is buying.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PRICE_FIELDS.map(p => (
                      <Field key={p.key} label={p.label} hint={p.hint} error={errors[p.key]}>
                        <MoneyInput value={form[p.key]} onChange={e => setField(p.key, e.target.value)} error={errors[p.key]} />
                      </Field>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="p-4 bg-accent-soft/60 border border-accent-muted rounded-xl">
                  <div className="flex items-start gap-2 mb-3">
                    <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-accent-fg">
                      <strong>Same for every size?</strong> Fill these in and press <em>Apply to all sizes</em>. Then change any size in the table below.
                    </p>
                  </div>
                  <SizeGrid
                    rows={[{ key: '__all', label: 'All sizes', values: form }]}
                    onChange={(_, key, value) => setField(key, value)}
                    errors={{}}
                  />
                  <div className="flex justify-end mt-3">
                    <button type="button" onClick={applyDefaultsToAllSizes} className="inline-flex items-center gap-1.5 h-9 px-3 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-hover">
                      Apply to all {form.size_variants.length} sizes
                    </button>
                  </div>
                </section>
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-3">Each size</h3>
                  <SizeGrid
                    rows={form.size_variants.map(row => ({ key: row.size, label: `Size ${row.size}`, values: row }))}
                    onChange={(size, key, value) => updateSizeRow(size, key, value)}
                    errors={errors}
                  />
                </section>
              </>
            )}
          </Card>
        )}

        {/* ── STEP: Review ────────────────────────────────────────────── */}
        {step === 'review' && (
          <Card
            icon={Sparkles}
            title="Review and create"
            description="Check everything below. Use Edit to go back and change a section."
            footer={<>
              <button type="button" onClick={() => go('pricing')} className={btnSecondary}><ChevronLeft className="w-4 h-4" /> Back</button>
              <button type="button" onClick={handleSubmit} disabled={loading} className={btnPrimary}>
                {loading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating…</>
                  : <><CheckCircle className="w-4 h-4" /> Create {hasSizes ? `${form.size_variants.length} products` : 'product'}</>}
              </button>
            </>}
          >
            {warnings.length > 0 && (
              <FormAlert type="warning">
                <div className="font-semibold mb-0.5">Please double-check:</div>
                <ul className="list-disc pl-4 space-y-0.5">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
              </FormAlert>
            )}

            <ReviewSection title="Where" onEdit={isSuperAdmin ? () => go('where') : null}>
              <div className="text-sm text-ink-secondary">{selectedBizObj?.name}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedBranchObjs.map(br => (
                  <span key={br.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-sunken rounded-lg text-xs text-ink-secondary">
                    <Store className="w-3 h-3 text-warning-fg" /> {br.name}
                  </span>
                ))}
              </div>
            </ReviewSection>

            <ReviewSection title="Product" onEdit={() => go('details')}>
              <div className="font-semibold text-ink">{form.item_name}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-soft text-violet-fg">{form.category}</span>
                {otherAttributes.map(attr => form.variants?.[attr.attribute_key] && (
                  <span key={attr.attribute_key} className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-success-soft text-success-fg">
                    {attr.label}: {form.variants[attr.attribute_key]}
                  </span>
                ))}
                {form.mark_as_new && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg">NEW for {form.new_duration_days} days</span>}
              </div>
              <div className="text-xs text-ink-muted mt-2">
                SKU: {hasSizes
                  ? `one per size, generated automatically (${form.size_variants.length} total)`
                  : <span className="font-mono text-accent">{previewSku || 'generated automatically'}</span>}
              </div>
            </ReviewSection>

            <ReviewSection title="Stock & prices" onEdit={() => go('pricing')}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-ink-muted text-left">
                      {hasSizes && <th className="py-1 pr-3 font-semibold">Size</th>}
                      <th className="py-1 pr-3 font-semibold">Stock</th>
                      <th className="py-1 pr-3 font-semibold">Alert at</th>
                      <th className="py-1 pr-3 font-semibold">Customer</th>
                      <th className="py-1 pr-3 font-semibold">Dealer</th>
                      <th className="py-1 pr-3 font-semibold">Staff</th>
                      <th className="py-1 font-semibold">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-ink">
                    {(hasSizes ? form.size_variants : [form]).map((row, i) => (
                      <tr key={row.size || i} className="border-t border-line-soft">
                        {hasSizes && <td className="py-1.5 pr-3 font-sans font-semibold">{row.size}</td>}
                        <td className="py-1.5 pr-3">{toInt(row.quantity)}</td>
                        <td className="py-1.5 pr-3">{row.minimum_quantity === '' ? 5 : toInt(row.minimum_quantity)}</td>
                        <td className="py-1.5 pr-3">{money(row.selling_price)}</td>
                        <td className="py-1.5 pr-3">{money(row.price_dealer)}</td>
                        <td className="py-1.5 pr-3">{money(row.price_staff)}</td>
                        <td className="py-1.5">{money(row.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedBranches.length > 1 && (
                <p className="text-xs text-ink-muted mt-2">Stock shown is per branch ({selectedBranches.length} branches).</p>
              )}
            </ReviewSection>
          </Card>
        )}

        {/* ── Done ────────────────────────────────────────────────────── */}
        {step === 'done' && createdProduct && (() => {
          const created = createdProduct.products || [];
          const first = created[0] || {};
          const hasSizes = created.some(p => p.size);
          const noPrice = created.some(p => !(parseFloat(p.selling_price) > 0));
          return (
            <div className="space-y-5">
              {/* Success summary */}
              <div className="bg-surface border border-line rounded-xl overflow-hidden">
                <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-line-soft">
                  <div className="w-12 h-12 rounded-full bg-success-soft border border-success-line flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-success-fg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold text-ink truncate">{first.item_name || 'Product'} is ready</h2>
                    <p className="text-sm text-ink-muted mt-0.5">
                      {created.length} {hasSizes ? (created.length === 1 ? 'size' : 'sizes') : (created.length === 1 ? 'item' : 'items')} added to {whereLabel}.
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-line-soft text-center">
                  {[
                    ['Category', form.category || '—'],
                    [hasSizes ? 'Sizes' : 'Items', created.length],
                    ['Branches', createdProduct.total_branches ?? selectedBranchObjs.length],
                    ['Total stock', created.reduce((s, p) => s + (parseInt(p.quantity, 10) || 0), 0)],
                  ].map(([label, value]) => (
                    <div key={label} className="px-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
                      <dd className="mt-0.5 text-sm font-bold text-ink truncate">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {noPrice && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-warning-line bg-warning-soft text-sm text-warning-fg">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning-fg" />
                  <span>Some items have no customer price (RM 0.00). They will ring up free at the POS until you set a price in <Link to="/products" className="font-semibold underline">Products</Link>.</span>
                </div>
              )}

              {/* One label card per created SKU */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">QR labels</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {created.map(product => (
                    <div key={product.id} className="bg-surface border border-line rounded-xl p-4 flex gap-4">
                      <div className="w-24 h-24 flex-shrink-0 rounded-lg border border-line bg-surface p-1.5 flex items-center justify-center overflow-hidden">
                        {product.qr_svg
                          ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: product.qr_svg }} />
                          : <QrCode className="w-10 h-10 text-ink-subtle" />}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-ink text-sm leading-snug line-clamp-2">{product.item_name}</p>
                          {product.size && (
                            <span className="flex-shrink-0 rounded-lg bg-accent-soft border border-accent-muted px-2 py-0.5 text-xs font-bold text-accent-fg">{product.size}</span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-ink-muted mt-0.5">{product.sku}</p>
                        <div className="mt-2 flex items-baseline gap-3 text-xs">
                          <span className={`font-mono font-bold text-sm ${parseFloat(product.selling_price) > 0 ? 'text-ink' : 'text-warning-fg'}`}>{money(product.selling_price)}</span>
                          <span className={parseInt(product.quantity, 10) > 0 ? 'text-ink-muted' : 'text-warning-fg'}>
                            {parseInt(product.quantity, 10) || 0} in stock
                          </span>
                        </div>
                        <Link
                          to={`/qr/generate?product_id=${product.id}`}
                          className="mt-auto pt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-fg self-start"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Print label
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button onClick={startAnother} className={`${btnSecondary} flex-1 justify-center`}>
                  <Plus className="w-4 h-4" /> Add another product here
                </button>
                <button onClick={() => navigate('/products')} className={`${btnPrimary} flex-1 justify-center`}>
                  <Package className="w-4 h-4" /> Go to products
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <section className="pb-5 border-b border-line-soft last:border-0 last:pb-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
        {onEdit && (
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-fg">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// Compact table of stock/price inputs, one row per size (or a single "All sizes" row)
function SizeGrid({ rows, onChange, errors }) {
  const cols = [
    { key: 'quantity', label: 'Stock', int: true },
    { key: 'minimum_quantity', label: 'Alert at', int: true },
    { key: 'selling_price', label: 'Customer RM' },
    { key: 'price_dealer', label: 'Dealer RM' },
    { key: 'price_staff', label: 'Staff RM' },
    { key: 'unit_price', label: 'Cost RM' },
  ];
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[40rem]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-ink-muted text-left">
            <th className="pb-1.5 pr-2 font-semibold w-24" />
            {cols.map(c => <th key={c.key} className="pb-1.5 px-1 font-semibold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td className="py-1 pr-2 text-sm font-semibold text-ink whitespace-nowrap">{row.label}</td>
              {cols.map(c => {
                const err = errors[`${row.key}.${c.key}`];
                return (
                  <td key={c.key} className="py-1 px-1">
                    <input
                      type="number"
                      min="0"
                      step={c.int ? '1' : '0.01'}
                      placeholder={c.int ? '0' : '0.00'}
                      value={row.values[c.key]}
                      onChange={e => onChange(row.key, c.key, e.target.value)}
                      title={err || undefined}
                      aria-label={`${row.label} ${c.label}`}
                      className={`h-9 w-full rounded-lg border bg-surface px-2 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-accent ${err ? 'border-danger' : 'border-line'}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some(r => cols.some(c => errors[`${r.key}.${c.key}`])) && (
        <p className="mt-1 text-xs text-danger-fg flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fix the highlighted boxes: stock must be a whole number, and nothing can be negative.</p>
      )}
    </div>
  );
}
