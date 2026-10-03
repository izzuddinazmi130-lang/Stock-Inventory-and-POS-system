import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  Field, Input, Select, MoneyInput, Alert, Button, ButtonBase, IconButton, Switch, PageHeader, Card as UiCard, Badge,
  BusinessDot, Table, THead, TBody, TH, TR, TD, cn,
} from '../../components/ui';
import {
  Package, ChevronRight, ChevronLeft, Building2, Store, Hash, Check, CheckCircle2, QrCode, Printer,
  Sparkles, Plus, Minus, Pencil, Info, AlertTriangle,
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
    <ol className="flex items-center mb-6" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <li className="flex items-center gap-2 min-w-0" aria-current={active ? 'step' : undefined}>
              <span className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-caption font-semibold flex-shrink-0 transition-colors duration-base',
                done ? 'bg-accent-soft text-accent' : active ? 'bg-accent text-white shadow-xs' : 'bg-sunken text-ink-muted'
              )}>
                {done ? <Check className="w-4 h-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn('text-caption font-medium truncate hidden sm:block', active ? 'text-ink' : 'text-ink-muted')}>{s.label}</span>
            </li>
            {i < steps.length - 1 && (
              <li className="relative h-px flex-1 mx-3 min-w-4 bg-line overflow-hidden" aria-hidden="true">
                <span className={cn('absolute inset-y-0 left-0 bg-accent transition-[width] duration-slow ease-out', done ? 'w-full' : 'w-0')} />
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/** One wizard step: header, body, footer with Back / Next. */
function Card({ title, description, icon: Icon, children, footer }) {
  return (
    <UiCard className="animate-slide-up">
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-line-soft flex items-start gap-3">
        {Icon && <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><Icon className="w-[18px] h-[18px]" aria-hidden="true" /></div>}
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="text-sm text-ink-muted mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-6">{children}</div>
      {footer && <div className="px-5 sm:px-6 py-4 border-t border-line-soft bg-subtle/60 rounded-b-xl flex flex-wrap items-center justify-between gap-3">{footer}</div>}
    </UiCard>
  );
}

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

  // ── Warn before closing or reloading the tab with a half-filled product
  const hasUnsavedWork = !createdProduct && JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);
  useEffect(() => {
    if (!hasUnsavedWork) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork]);

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
      <PageHeader
        back={{ to: '/products', label: 'Back to products' }}
        breadcrumbs={[{ label: 'Products', to: '/products' }, { label: 'Add product' }]}
        title="Add product"
        description={step === 'done' ? 'Print the QR labels and stick them on the stock.' : 'Create a product in the catalog and give it starting stock.'}
      />

      <div className="max-w-3xl mx-auto">
        {step !== 'done' && <StepBar steps={steps} current={step} />}

        {/* Where the product is going (steps after "Where") */}
        {step !== 'where' && step !== 'done' && (
          <div className="mb-4 px-4 py-2.5 bg-surface border border-line rounded-xl shadow-card flex items-center justify-between gap-3 text-sm text-ink-secondary">
            <span className="flex items-center gap-2 min-w-0">
              {selectedBizObj ? <BusinessDot business={selectedBizObj} /> : <Store className="w-4 h-4 text-ink-muted flex-shrink-0" aria-hidden="true" />}
              <span className="truncate">Adding to {whereLabel}</span>
            </span>
            {isSuperAdmin && (
              <Button variant="link" size="sm" onClick={() => go('where')}>Change</Button>
            )}
          </div>
        )}

        {error && <Alert tone="danger" className="mb-4" onClose={() => setError('')}>{error}</Alert>}

        {/* ── STEP: Where ─────────────────────────────────────────────── */}
        {step === 'where' && (
          <Card
            icon={Building2}
            title="Where is this product sold?"
            description="Choose the business, then every branch that will stock it. Each branch gets its own stock count."
            footer={<>
              <Button variant="secondary" to="/products">Cancel</Button>
              <Button iconRight={ChevronRight} onClick={() => next('where', 'details')}>Next: Product details</Button>
            </>}
          >
            <Field label="Business" required error={errors.business}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {businesses.map(biz => {
                  const active = String(selectedBiz) === String(biz.id);
                  return (
                    <ButtonBase
                      key={biz.id}
                      aria-pressed={active}
                      onClick={() => { if (!active) { setSelectedBiz(String(biz.id)); setSelectedBranches([]); } setErrors(e => ({ ...e, business: undefined })); }}
                      className={cn('p-3 rounded-lg border text-left', active ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-line-strong hover:bg-subtle')}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <BusinessDot business={biz} /> {biz.name}
                      </span>
                      <span className="block text-caption text-ink-muted capitalize mt-0.5">{biz.industry || 'General'}</span>
                    </ButtonBase>
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
                      <span className="text-caption text-ink-muted tabular-nums">{selectedBranches.length} of {branches.length} selected</span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => { setSelectedBranches(selectedBranches.length === branches.length ? [] : branches.map(b => b.id)); setErrors(e => ({ ...e, branches: undefined })); }}
                      >
                        {selectedBranches.length === branches.length ? 'Clear all' : 'Select all'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {branches.map(br => {
                        const checked = selectedBranches.includes(br.id);
                        return (
                          <ButtonBase
                            key={br.id}
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => {
                              setSelectedBranches(prev => (checked ? prev.filter(id => id !== br.id) : [...prev, br.id]));
                              setErrors(e => ({ ...e, branches: undefined }));
                            }}
                            className={cn('flex items-center gap-3 p-3 rounded-lg border text-left', checked ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-line-strong hover:bg-subtle')}
                          >
                            <span className={cn('w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors', checked ? 'bg-accent border-accent' : 'border-line-strong bg-surface')}>
                              {checked && <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink truncate">{br.name}</span>
                              <span className="block text-caption text-ink-muted font-mono">
                                {br.branch_code || `BR${br.id}`}{Number(br.is_active) === 0 && <span className="ml-1 font-sans text-warning-fg">· inactive</span>}
                              </span>
                            </span>
                          </ButtonBase>
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
                ? <Button variant="secondary" icon={ChevronLeft} onClick={() => go('where')}>Back</Button>
                : <Button variant="secondary" to="/products">Cancel</Button>}
              <Button iconRight={ChevronRight} onClick={() => next('details', 'pricing')}>Next: Stock &amp; prices</Button>
            </>}
          >
            <Field label="Product name" required error={errors.item_name}>
              <Input
                autoFocus
                value={form.item_name}
                onChange={e => setField('item_name', e.target.value)}
                placeholder="e.g. Kaftan Safira"
                error={errors.item_name}
                maxLength={200}
              />
            </Field>

            <Field label="Category" required error={errors.category}>
              {configLoaded && categories.length === 0 ? (
                <Alert tone="warning">
                  This business has no categories yet.{' '}
                  {isSuperAdmin
                    ? <Link to={`/businesses/${selectedBiz}/forms`} className="font-semibold underline">Set them up in Product Form Setup</Link>
                    : 'Ask HQ to add categories for your business.'}
                </Alert>
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
                      <ButtonBase
                        key={size}
                        onClick={() => toggleSize(size)}
                        aria-pressed={selected}
                        className={cn('min-w-12 h-10 px-3 rounded-lg border text-sm font-semibold active:scale-[0.97]', selected ? 'border-accent bg-accent text-white shadow-xs' : 'border-line bg-surface text-ink-secondary hover:border-accent-line hover:text-ink')}
                      >
                        {size}
                      </ButtonBase>
                    );
                  })}
                </div>
              </Field>
            )}

            <div className="p-4 bg-subtle rounded-lg border border-line-soft space-y-3">
              <Switch
                checked={form.mark_as_new}
                onChange={v => setField('mark_as_new', v)}
                label="Mark as new arrival"
                description="Shows a “NEW” badge on the product for a while."
              />
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
              <Button variant="secondary" icon={ChevronLeft} onClick={() => go('details')}>Back</Button>
              <Button iconRight={ChevronRight} onClick={() => next('pricing', 'review')}>Next: Review</Button>
            </>}
          >
            {!hasSizes ? (
              <>
                <section>
                  <h3 className="text-sm font-semibold text-ink mb-3">Stock</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Starting stock" hint="Units on hand right now. 0 is fine." error={errors.quantity}>
                      <div className="flex items-center gap-2">
                        <IconButton icon={Minus} label="One less" variant="secondary" size="md" tooltip={false} onClick={() => setField('quantity', Math.max(0, toInt(form.quantity) - 1))} />
                        <Input type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={form.quantity} onChange={e => setField('quantity', e.target.value)} className="text-center font-mono font-semibold" error={errors.quantity} />
                        <IconButton icon={Plus} label="One more" variant="secondary" size="md" tooltip={false} onClick={() => setField('quantity', toInt(form.quantity) + 1)} />
                      </div>
                    </Field>
                    <Field label="Low-stock alert at" hint="Flag the product when stock drops to this number." error={errors.minimum_quantity}>
                      <Input type="number" min="0" step="1" value={form.minimum_quantity} onChange={e => setField('minimum_quantity', e.target.value)} className="font-mono" error={errors.minimum_quantity} />
                    </Field>
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-ink">Prices</h3>
                  <p className="text-caption text-ink-muted mt-0.5 mb-3">The POS charges one of the first three, depending on who is buying.</p>
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
                    <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-caption text-accent-fg">
                      <strong>Same for every size?</strong> Fill these in and press <em>Apply to all sizes</em>. Then change any size in the table below.
                    </p>
                  </div>
                  <SizeGrid
                    rows={[{ key: '__all', label: 'All sizes', values: form }]}
                    onChange={(_, key, value) => setField(key, value)}
                    errors={{}}
                  />
                  <div className="flex justify-end mt-3">
                    <Button size="sm" onClick={applyDefaultsToAllSizes}>
                      Apply to all {form.size_variants.length} sizes
                    </Button>
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-ink mb-3">Each size</h3>
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
              <Button variant="secondary" icon={ChevronLeft} onClick={() => go('pricing')}>Back</Button>
              <Button icon={CheckCircle2} loading={loading} onClick={handleSubmit}>
                {loading ? 'Creating…' : `Create ${hasSizes ? `${form.size_variants.length} products` : 'product'}`}
              </Button>
            </>}
          >
            {warnings.length > 0 && (
              <Alert tone="warning" title="Please double-check">
                <ul className="list-disc pl-4 space-y-0.5">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
              </Alert>
            )}

            <ReviewSection title="Where" onEdit={isSuperAdmin ? () => go('where') : null}>
              <div className="text-sm text-ink-secondary">{selectedBizObj?.name}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedBranchObjs.map(br => (
                  <Badge key={br.id} icon={Store}>{br.name}</Badge>
                ))}
              </div>
            </ReviewSection>

            <ReviewSection title="Product" onEdit={() => go('details')}>
              <div className="font-semibold text-ink">{form.item_name}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge tone="accent">{form.category}</Badge>
                {otherAttributes.map(attr => form.variants?.[attr.attribute_key] && (
                  <Badge key={attr.attribute_key}>{attr.label}: {form.variants[attr.attribute_key]}</Badge>
                ))}
                {form.mark_as_new && <Badge tone="violet" icon={Sparkles}>New for {form.new_duration_days} days</Badge>}
              </div>
              <div className="text-caption text-ink-muted mt-2">
                SKU: {hasSizes
                  ? `one per size, generated automatically (${form.size_variants.length} total)`
                  : <span className="font-mono text-accent">{previewSku || 'generated automatically'}</span>}
              </div>
            </ReviewSection>

            <ReviewSection title="Stock & prices" onEdit={() => go('pricing')}>
              <div className="border border-line rounded-lg overflow-hidden">
                <Table dense minWidth="32rem">
                  <THead>
                    <TR>
                      {hasSizes && <TH>Size</TH>}
                      <TH numeric>Stock</TH>
                      <TH numeric>Alert at</TH>
                      <TH numeric>Customer</TH>
                      <TH numeric>Dealer</TH>
                      <TH numeric>Staff</TH>
                      <TH numeric>Cost</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {(hasSizes ? form.size_variants : [form]).map((row, i) => (
                      <TR key={row.size || i}>
                        {hasSizes && <TD className="font-semibold">{row.size}</TD>}
                        <TD numeric>{toInt(row.quantity)}</TD>
                        <TD numeric>{row.minimum_quantity === '' ? 5 : toInt(row.minimum_quantity)}</TD>
                        <TD numeric>{money(row.selling_price)}</TD>
                        <TD numeric>{money(row.price_dealer)}</TD>
                        <TD numeric>{money(row.price_staff)}</TD>
                        <TD numeric>{money(row.unit_price)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              {selectedBranches.length > 1 && (
                <p className="text-caption text-ink-muted mt-2">Stock shown is per branch ({selectedBranches.length} branches).</p>
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
            <div className="space-y-5 animate-slide-up">
              {/* Success summary */}
              <UiCard className="overflow-hidden">
                <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-line-soft">
                  <div className="w-12 h-12 rounded-full bg-success-soft ring-8 ring-success-soft/50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-success-fg" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-semibold text-ink truncate">{first.item_name || 'Product'} is ready</h2>
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
                      <dt className="text-caption text-ink-muted">{label}</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-ink truncate tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </UiCard>

              {noPrice && (
                <Alert tone="warning">
                  Some items have no customer price (RM 0.00). They will ring up free at the POS until you set a price in <Link to="/products" className="font-semibold underline">Products</Link>.
                </Alert>
              )}

              {/* One label card per created SKU */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">QR labels</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {created.map(product => (
                    <UiCard key={product.id} className="p-4 flex gap-4">
                      <div className="w-24 h-24 flex-shrink-0 rounded-lg border border-line bg-surface p-1.5 flex items-center justify-center overflow-hidden">
                        {product.qr_svg
                          ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: product.qr_svg }} />
                          : <QrCode className="w-10 h-10 text-ink-subtle" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-ink text-sm leading-snug line-clamp-2">{product.item_name}</p>
                          {product.size && <Badge tone="accent" className="flex-shrink-0 font-semibold">{product.size}</Badge>}
                        </div>
                        <p className="font-mono text-caption text-ink-muted mt-0.5">{product.sku}</p>
                        <div className="mt-2 flex items-baseline gap-3 text-caption">
                          <span className={cn('font-semibold text-sm tabular-nums', parseFloat(product.selling_price) > 0 ? 'text-ink' : 'text-warning-fg')}>{money(product.selling_price)}</span>
                          <span className={parseInt(product.quantity, 10) > 0 ? 'text-ink-muted' : 'text-warning-fg'}>
                            {parseInt(product.quantity, 10) || 0} in stock
                          </span>
                        </div>
                        <Button variant="link" size="sm" icon={Printer} to={`/qr/generate?product_id=${product.id}`} className="mt-auto pt-2 self-start">
                          Print label
                        </Button>
                      </div>
                    </UiCard>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button variant="secondary" icon={Plus} onClick={startAnother} className="flex-1">Add another product here</Button>
                <Button icon={Package} onClick={() => navigate('/products')} className="flex-1">Go to products</Button>
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
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {onEdit && <Button variant="link" size="sm" icon={Pencil} onClick={onEdit}>Edit</Button>}
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
    <div className="border border-line rounded-lg overflow-hidden bg-surface">
      <Table dense minWidth="40rem">
        <THead>
          <TR>
            <TH className="w-24"><span className="sr-only">Row</span></TH>
            {cols.map(c => <TH key={c.key} className="px-1.5">{c.label}</TH>)}
          </TR>
        </THead>
        <TBody>
          {rows.map(row => (
            <TR key={row.key}>
              <TD className="text-sm font-semibold whitespace-nowrap">{row.label}</TD>
              {cols.map(c => {
                const err = errors[`${row.key}.${c.key}`];
                return (
                  <TD key={c.key} className="px-1.5">
                    <Input
                      type="number"
                      size="sm"
                      min="0"
                      step={c.int ? '1' : '0.01'}
                      inputMode={c.int ? 'numeric' : 'decimal'}
                      placeholder={c.int ? '0' : '0.00'}
                      value={row.values[c.key]}
                      onChange={e => onChange(row.key, c.key, e.target.value)}
                      title={err || undefined}
                      aria-label={`${row.label} ${c.label}`}
                      aria-invalid={err ? true : undefined}
                      error={Boolean(err)}
                      className="h-9 px-2 font-mono tabular-nums"
                    />
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>
      {rows.some(r => cols.some(c => errors[`${r.key}.${c.key}`])) && (
        <p className="mt-1 text-caption text-danger-fg flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Fix the highlighted boxes: stock must be a whole number, and nothing can be negative.</p>
      )}
    </div>
  );
}
