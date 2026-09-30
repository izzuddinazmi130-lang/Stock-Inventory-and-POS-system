import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Tag, ListChecks, Type, List, Eye, Info, Lock, Layers } from 'lucide-react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  Alert, Badge, Button, ButtonBase, Card, ChoiceCards, Field, IconButton, Input, PageHeader, Select, Skeleton,
  useConfirm, useToast, cn,
} from '../../components/ui';

const emptyField = { label: '', input_type: 'text', options: [] };

// Same rule the backend applies to attribute keys: "Fabric Type" → "fabric_type"
const toFieldKey = (label) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1');

function parseOptions(options) {
  if (Array.isArray(options)) return options;
  if (typeof options !== 'string') return [];
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return options.split(',').map(o => o.trim()).filter(Boolean);
  }
}

const isSizeField = (f) => f.attribute_key === 'size' && f.input_type === 'select';

function StepBadge({ n }) {
  return <span className="w-6 h-6 rounded-full bg-accent text-white text-caption font-semibold flex items-center justify-center flex-shrink-0">{n}</span>;
}

/** A removable chip (category or dropdown option). */
function Chip({ children, onRemove, removeLabel, tone = 'neutral' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 pl-3 pr-1 h-8 rounded-full text-sm animate-fade-in',
      tone === 'accent' ? 'bg-accent-soft text-accent-fg' : 'bg-sunken text-ink'
    )}>
      {children}
      <ButtonBase
        onClick={onRemove}
        aria-label={removeLabel}
        className="w-6 h-6 rounded-full flex items-center justify-center text-ink-muted hover:bg-danger-muted hover:text-danger-fg"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </ButtonBase>
    </span>
  );
}

// ── Live preview of the "Add product" form, built from the current settings ──
function FormPreview({ businessName, categories, attributes, draftField }) {
  const draftKey = toFieldKey(draftField.label);
  const draft = draftField.label.trim()
    ? { ...draftField, attribute_key: draftKey, options: draftField.options, isDraft: true }
    : null;
  const all = draft ? [...attributes, draft] : attributes;
  const regular = all.filter(f => !isSizeField(f));
  const size = all.find(isSizeField);

  const draftRing = (f) => (f.isDraft ? 'rounded-lg outline-dashed outline-2 outline-warning outline-offset-2' : '');
  const DraftTag = ({ f }) => (f.isDraft ? <Badge tone="warning" size="sm" className="ml-2">Not saved yet</Badge> : null);
  const Label = ({ children }) => <span className="block text-caption font-medium text-ink mb-1">{children}</span>;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-subtle border-b border-line-soft">
        <Eye className="w-4 h-4 text-accent" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-ink">Live preview</div>
          <div className="text-caption text-ink-muted">What staff see on “Add product” for {businessName || 'this business'}</div>
        </div>
      </div>

      <div className="p-4 space-y-3 pointer-events-none select-none" aria-hidden="true" inert="">
        <div>
          <Label>Product name *</Label>
          <Input size="sm" placeholder="e.g. Product name" readOnly tabIndex={-1} />
        </div>

        <div className="rounded-lg ring-2 ring-accent-line ring-offset-2 p-1 -m-1">
          <Label>Category * <span className="ml-1 text-[11px] font-semibold text-accent">from step 1</span></Label>
          <Select size="sm" defaultValue="" tabIndex={-1}><option value="">Choose…</option></Select>
          {categories.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {categories.map(c => <Badge key={c.id} size="sm">{c.name}</Badge>)}
            </div>
          ) : (
            <p className="mt-1 text-caption text-warning-fg">Empty: add categories in step 1, or staff can’t pick one.</p>
          )}
        </div>

        {(regular.length > 0 || size) && (
          <div className="rounded-lg ring-2 ring-accent-line ring-offset-2 p-1 -m-1 space-y-3">
            <div className="flex items-center gap-1.5 text-caption font-medium text-ink">
              <Layers className="w-3.5 h-3.5 text-accent" /> Extra details
              <span className="text-[11px] font-semibold text-accent">from step 2</span>
            </div>
            {regular.map(f => (
              <div key={f.attribute_key || 'draft'} className={draftRing(f)}>
                <Label>{f.label}<DraftTag f={f} /></Label>
                {f.input_type === 'select' ? (
                  <>
                    <Select size="sm" defaultValue="" tabIndex={-1}><option value="">Choose {f.label}</option></Select>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {parseOptions(f.options).length > 0
                        ? parseOptions(f.options).map(o => <Badge key={o} size="sm">{o}</Badge>)
                        : <span className="text-caption text-warning-fg">No options yet</span>}
                    </div>
                  </>
                ) : (
                  <Input size="sm" placeholder={f.label} readOnly tabIndex={-1} />
                )}
              </div>
            ))}
            {size && (
              <div className={cn('border-t border-line-soft pt-3', draftRing(size))}>
                <Label>{size.label}s<DraftTag f={size} /></Label>
                <div className="flex flex-wrap gap-1.5">
                  {parseOptions(size.options).map((o, i) => (
                    <span key={o} className={cn('min-w-10 h-8 px-2.5 inline-flex items-center justify-center rounded-lg border text-caption font-semibold', i === 0 ? 'border-accent bg-accent text-white' : 'border-line text-ink-secondary')}>{o}</span>
                  ))}
                </div>
                <p className="mt-1.5 text-caption text-ink-muted">Each size picked becomes its own SKU with its own stock and prices.</p>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-dashed border-line">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted mb-2">
            <Lock className="w-3 h-3" /> Always included
          </div>
          <div className="grid grid-cols-2 gap-2 opacity-60">
            {['Starting stock *', 'Low-stock alert', 'Customer price', 'Dealer price', 'Staff price', 'Cost price'].map(l => (
              <div key={l}>
                <span className="block text-[11px] font-medium text-ink-secondary mb-0.5">{l}</span>
                <div className="h-8 rounded-lg border border-line bg-subtle" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function BusinessFormManager() {
  const { id: routeBusinessId } = useParams();
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(routeBusinessId || '');
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [category, setCategory] = useState('');
  const [field, setField] = useState(emptyField);
  const [optionDraft, setOptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const { toast } = useToast();
  const confirm = useConfirm();

  const businessName = useMemo(
    () => businesses.find(b => String(b.id) === String(businessId))?.name || '',
    [businesses, businessId]
  );

  const loadBusinesses = async () => {
    const res = await api.get('/businesses');
    const rows = res.data.businesses || res.data.data || [];
    setBusinesses(rows);
    if (routeBusinessId && rows.some(row => String(row.id) === String(routeBusinessId))) {
      setBusinessId(String(routeBusinessId));
    } else if (!routeBusinessId && rows[0]) {
      setBusinessId(String(rows[0].id));
    }
  };

  const loadConfig = async () => {
    if (!businessId) return;
    setLoading(true);
    setLoadError('');
    try {
      const [categoriesRes, fieldsRes] = await Promise.all([
        api.get(`/businesses/${businessId}/categories`),
        api.get(`/businesses/${businessId}/variant-attributes`)
      ]);
      setCategories(categoriesRes.data.categories || []);
      setAttributes(fieldsRes.data.attributes || []);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load the form setup.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBusinesses().catch(() => toast.error('Could not load businesses.')); }, [routeBusinessId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadConfig(); setField(emptyField); setOptionDraft(''); setCategory(''); }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCategory = async (event) => {
    event.preventDefault();
    const name = category.trim();
    if (!name) return;
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.warning(`“${name}” is already a category.`);
      return;
    }
    setSaving(true);
    try {
      await api.post(`/businesses/${businessId}/categories`, { name, sort_order: categories.length * 10 });
      setCategory(''); toast.success(`Category “${name}” added.`); await loadConfig();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add category'); }
    finally { setSaving(false); }
  };

  // Dropdown options are entered one at a time (Enter or comma adds one)
  const addOption = () => {
    const values = optionDraft.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return;
    setField(f => ({ ...f, options: [...new Set([...f.options, ...values])] }));
    setOptionDraft('');
  };
  const removeOption = (opt) => setField(f => ({ ...f, options: f.options.filter(o => o !== opt) }));

  const fieldKey = toFieldKey(field.label);
  const fieldError = !field.label.trim()
    ? null
    : !fieldKey
      ? 'Use letters or numbers in the field name.'
      : attributes.some(a => a.attribute_key === fieldKey || a.label.toLowerCase() === field.label.trim().toLowerCase())
        ? 'A field with this name already exists.'
        : null;
  const pendingOptions = field.input_type === 'select' && optionDraft.trim()
    ? [...new Set([...field.options, ...optionDraft.split(',').map(v => v.trim()).filter(Boolean)])]
    : field.options;
  const canSaveField = field.label.trim() && !fieldError && (field.input_type === 'text' || pendingOptions.length > 0);

  const addField = async (event) => {
    event.preventDefault();
    if (!canSaveField) return;
    setSaving(true);
    try {
      await api.post(`/businesses/${businessId}/variant-attributes`, {
        attribute_key: fieldKey,
        label: field.label.trim(),
        input_type: field.input_type,
        options: field.input_type === 'select' ? pendingOptions : [],
        sort_order: attributes.length * 10
      });
      toast.success(`Field “${field.label.trim()}” added to the product form.`);
      setField(emptyField); setOptionDraft('');
      await loadConfig();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add field'); }
    finally { setSaving(false); }
  };

  const remove = async (path, label, note) => {
    const ok = await confirm({ title: `Remove ${label}?`, message: note, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    try { await api.delete(path); toast.success(`Removed ${label}.`); await loadConfig(); }
    catch (err) { toast.error(err.response?.data?.message || `Failed to remove ${label}`); }
  };

  return (
    <Layout>
      <PageHeader
        back={{ to: '/businesses', label: 'Back to businesses' }}
        breadcrumbs={[{ label: 'Businesses', to: '/businesses' }, { label: businessName || 'Business' }, { label: 'Product form' }]}
        title="Product form setup"
        description={<>Choose what staff fill in when they add a product{businessName ? <> for <strong className="text-ink-secondary font-medium">{businessName}</strong></> : ''}. Changes apply right away.</>}
      />

      <Field label="Business you are setting up" className="mb-6 max-w-sm">
        <Select value={businessId} onChange={event => setBusinessId(event.target.value)}>
          {businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
        </Select>
      </Field>

      {loadError && <Alert tone="danger" className="mb-4" action={<Button variant="secondary" size="sm" onClick={loadConfig}>Try again</Button>}>{loadError}</Alert>}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-5"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* ── Editor ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Step 1: Categories */}
            <Card as="section" className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <StepBadge n={1} />
                <div>
                  <h2 className="text-sm font-semibold text-ink flex items-center gap-2"><Tag className="w-4 h-4 text-accent" aria-hidden="true" /> Product categories</h2>
                  <p className="text-caption text-ink-muted mt-0.5">The choices in the <strong className="font-medium">Category</strong> dropdown. Every product must belong to one, e.g. Kaftan, Blouse, Scarf.</p>
                </div>
              </div>
              <form onSubmit={addCategory} className="flex gap-2 mb-3">
                <Input value={category} onChange={event => setCategory(event.target.value)} placeholder="Type a category name, e.g. Kaftan" wrapperClassName="flex-1" className="flex-1" maxLength={100} aria-label="New category name" />
                <Button type="submit" icon={Plus} loading={saving && Boolean(category.trim())} disabled={!category.trim()}>Add</Button>
              </form>
              {categories.length === 0 ? (
                <Alert tone="warning">No categories yet. Add at least one: staff can’t save a product without a category.</Alert>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map(item => (
                    <Chip
                      key={item.id}
                      removeLabel={`Remove ${item.name}`}
                      onRemove={() => remove(`/businesses/${businessId}/categories/${item.id}`, `category “${item.name}”`, 'Existing products keep their category; it just stops appearing in the dropdown.')}
                    >
                      {item.name}
                    </Chip>
                  ))}
                </div>
              )}
            </Card>

            {/* Step 2: Extra fields */}
            <Card as="section" className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <StepBadge n={2} />
                <div>
                  <h2 className="text-sm font-semibold text-ink flex items-center gap-2"><ListChecks className="w-4 h-4 text-accent" aria-hidden="true" /> Extra details <span className="text-ink-muted font-normal">(optional)</span></h2>
                  <p className="text-caption text-ink-muted mt-0.5">Extra questions staff answer for each product, such as Colour, Material or Model. Leave empty if name, category and prices are enough.</p>
                </div>
              </div>

              {attributes.length > 0 && (
                <ul className="space-y-2 mb-5">
                  {attributes.map(item => {
                    const opts = parseOptions(item.options);
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-3 p-3 bg-subtle border border-line-soft rounded-lg">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm font-medium text-ink">{item.label}</strong>
                            <Badge size="sm" icon={item.input_type === 'select' ? List : Type}>{item.input_type === 'select' ? 'Dropdown' : 'Free text'}</Badge>
                            {isSizeField(item) && <Badge size="sm" tone="accent">One SKU per size</Badge>}
                          </div>
                          {opts.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {opts.map(o => <Badge key={o} size="sm" className="bg-surface">{o}</Badge>)}
                            </div>
                          )}
                        </div>
                        <IconButton
                          icon={Trash2}
                          label={`Remove ${item.label}`}
                          className="hover:bg-danger-muted hover:text-danger-fg flex-shrink-0"
                          onClick={() => remove(`/businesses/${businessId}/variant-attributes/${item.id}`, `field “${item.label}”`, 'Products already saved keep their values; the field just stops appearing on the form.')}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              <form onSubmit={addField} className="rounded-xl border border-dashed border-line-strong p-4 space-y-4">
                <div className="text-sm font-semibold text-ink">Add a new field</div>

                <Field label="Field name" hint={!fieldError ? 'What staff will see on the form.' : undefined} error={fieldError}>
                  <Input value={field.label} onChange={event => setField({ ...field, label: event.target.value })} placeholder="e.g. Material" maxLength={100} />
                </Field>

                <Field label="How should staff answer?">
                  <ChoiceCards
                    name="Answer type"
                    value={field.input_type}
                    onChange={v => setField({ ...field, input_type: v })}
                    options={[
                      { value: 'text', icon: Type, label: 'Free text', description: 'Staff type anything. Good for Colour or Model number.' },
                      { value: 'select', icon: List, label: 'Dropdown list', description: 'Staff pick from options you set. Good for Material or Size.' },
                    ]}
                  />
                </Field>

                {field.input_type === 'select' && (
                  <Field label="Dropdown options" hint={field.options.length === 0 ? 'Add at least one option.' : undefined}>
                    <div className="flex gap-2">
                      <Input
                        value={optionDraft}
                        onChange={e => setOptionDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addOption(); } }}
                        placeholder="Type an option, then press Enter"
                        wrapperClassName="flex-1"
                      />
                      <Button variant="secondary" onClick={addOption} disabled={!optionDraft.trim()}>Add option</Button>
                    </div>
                    {field.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {field.options.map(o => <Chip key={o} tone="accent" onRemove={() => removeOption(o)} removeLabel={`Remove ${o}`}>{o}</Chip>)}
                      </div>
                    )}
                    {fieldKey === 'size' && (
                      <Alert tone="accent" icon={Info} className="mt-2">
                        A dropdown called “Size” is special: staff can tick several sizes at once, and each size becomes its own product (SKU) with its own stock and prices.
                      </Alert>
                    )}
                  </Field>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-caption text-ink-muted">{field.label.trim() ? 'Shown in the preview with a dashed outline until you save.' : 'Start typing to see it in the preview.'}</p>
                  <Button type="submit" icon={Plus} loading={saving && Boolean(field.label.trim())} disabled={!canSaveField} className="flex-shrink-0">Save field</Button>
                </div>
              </form>
            </Card>
          </div>

          {/* ── Live preview ── */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-20">
              <FormPreview
                businessName={businessName}
                categories={categories}
                attributes={attributes}
                draftField={{ ...field, options: pendingOptions }}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
