import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, X, Tag, ListChecks, Type, List, Eye, Info, Lock, Layers, Pencil, ArrowUp, ArrowDown, Check, AlertTriangle,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  Alert, Badge, Button, ButtonBase, Card, ChoiceCards, Field, IconButton, Input, Modal, PageHeader, Select, Skeleton,
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

/** A removable chip (category or dropdown option). `onEdit` makes the label clickable (e.g. rename). */
function Chip({ children, onRemove, removeLabel, onEdit, editLabel, tone = 'neutral' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 pl-3 pr-1 h-8 rounded-full text-sm animate-fade-in',
      tone === 'accent' ? 'bg-accent-soft text-accent-fg' : 'bg-sunken text-ink'
    )}>
      {onEdit ? (
        <ButtonBase onClick={onEdit} aria-label={editLabel} title={editLabel} className="group inline-flex items-center gap-1.5 rounded-full hover:text-accent">
          {children}
          <Pencil className="w-3 h-3 text-ink-subtle group-hover:text-accent" aria-hidden="true" />
        </ButtonBase>
      ) : children}
      <ButtonBase
        onClick={onRemove}
        aria-label={removeLabel}
        // The ::after pad makes the tap area ~40px without changing the chip's look
        className="relative w-6 h-6 rounded-full flex items-center justify-center text-ink-muted hover:bg-danger-muted hover:text-danger-fg after:absolute after:-inset-2 after:content-['']"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </ButtonBase>
    </span>
  );
}

// ── Live preview of the "Add product" form, built from the current settings ──
function FormPreview({ businessName, categories, fields }) {
  const regular = fields.filter(f => !isSizeField(f));
  const size = fields.find(isSizeField);

  const draftRing = (f) => (f.isDraft ? 'rounded-lg outline-dashed outline-2 outline-warning outline-offset-2' : '');
  const DraftTag = ({ f }) => (f.isDraft ? <Badge tone="warning" size="sm" className="ml-2">{f.id ? 'Editing' : 'Not saved yet'}</Badge> : null);
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
              <div key={f.id || 'draft'} className={draftRing(f)}>
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

/**
 * Form for one extra-detail field: adds a new field, or (mode="edit") edits an existing one inline.
 * Reports its current state through onDraftChange so the live preview can show it before saving.
 */
function FieldEditor({ mode = 'add', original, otherFields, saving, onSubmit, onCancel, onDraftChange }) {
  const editing = mode === 'edit';
  const [field, setField] = useState(() => (
    editing ? { label: original.label, input_type: original.input_type, options: parseOptions(original.options) } : emptyField
  ));
  const [optionDraft, setOptionDraft] = useState('');

  const addOption = () => {
    const values = optionDraft.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return;
    setField(f => ({ ...f, options: [...new Set([...f.options, ...values])] }));
    setOptionDraft('');
  };
  const removeOption = (opt) => setField(f => ({ ...f, options: f.options.filter(o => o !== opt) }));

  // A new field gets its key from the name. An existing field keeps its key, so answers saved on products stay attached.
  const fieldKey = editing ? original.attribute_key : toFieldKey(field.label);
  const label = field.label.trim();
  const fieldError = !label
    ? null
    : !fieldKey
      ? 'Use letters or numbers in the field name.'
      : otherFields.some(a => a.label.toLowerCase() === label.toLowerCase() || (!editing && a.attribute_key === fieldKey))
        ? 'A field with this name already exists.'
        : null;
  const pendingOptions = field.input_type === 'select' && optionDraft.trim()
    ? [...new Set([...field.options, ...optionDraft.split(',').map(v => v.trim()).filter(Boolean)])]
    : field.options;

  const originalOptions = editing ? parseOptions(original.options) : [];
  const removedOptions = editing && field.input_type === 'select' && original.input_type === 'select'
    ? originalOptions.filter(o => !pendingOptions.includes(o))
    : [];
  const changed = !editing || label !== original.label || field.input_type !== original.input_type
    || (field.input_type === 'select' && JSON.stringify(pendingOptions) !== JSON.stringify(originalOptions));
  const canSave = Boolean(label) && !fieldError && changed && (field.input_type === 'text' || pendingOptions.length > 0);
  const sizeLosesSkus = editing && isSizeField(original) && field.input_type !== 'select';

  useEffect(() => {
    onDraftChange?.(label ? { ...field, label, attribute_key: fieldKey, options: pendingOptions } : null);
  }, [field, optionDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    const ok = await onSubmit({
      attribute_key: fieldKey,
      label,
      input_type: field.input_type,
      options: field.input_type === 'select' ? pendingOptions : [],
    });
    if (ok && !editing) { setField(emptyField); setOptionDraft(''); }
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={e => { if (editing && e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
      className={cn('rounded-xl border p-4 space-y-4', editing ? 'border-accent-line bg-surface shadow-card' : 'border-dashed border-line-strong')}
    >
      <div className="text-sm font-semibold text-ink">{editing ? `Edit “${original.label}”` : 'Add a new field'}</div>

      <Field label="Field name" hint={!fieldError ? 'What staff will see on the form.' : undefined} error={fieldError}>
        <Input value={field.label} onChange={event => setField({ ...field, label: event.target.value })} placeholder="e.g. Material" maxLength={100} autoFocus={editing} />
      </Field>

      <Field label="How should staff answer?">
        <ChoiceCards
          name={editing ? `Answer type for ${original.label}` : 'Answer type'}
          value={field.input_type}
          onChange={v => setField({ ...field, input_type: v })}
          options={[
            { value: 'text', icon: Type, label: 'Free text', description: 'Staff type anything. Good for Colour or Model number.' },
            { value: 'select', icon: List, label: 'Dropdown list', description: 'Staff pick from options you set. Good for Material or Size.' },
          ]}
        />
      </Field>

      {field.input_type === 'select' && (
        <Field label="Dropdown options" hint={pendingOptions.length === 0 ? 'Add at least one option.' : 'Press Enter or type a comma after each option.'}>
          <div className="flex gap-2">
            <Input
              value={optionDraft}
              onChange={e => setOptionDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addOption(); } }}
              placeholder="Type an option, then press Enter"
              wrapperClassName="flex-1"
              aria-label="New dropdown option"
            />
            <Button variant="secondary" onClick={addOption} disabled={!optionDraft.trim()}>Add option</Button>
          </div>
          {field.options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {field.options.map(o => <Chip key={o} tone="accent" onRemove={() => removeOption(o)} removeLabel={`Remove option ${o}`}>{o}</Chip>)}
            </div>
          )}
          {fieldKey === 'size' && !editing && (
            <Alert tone="accent" icon={Info} className="mt-2">
              A dropdown called “Size” is special: staff can tick several sizes at once, and each size becomes its own product (SKU) with its own stock and prices.
            </Alert>
          )}
        </Field>
      )}

      {editing && (
        sizeLosesSkus ? (
          <Alert tone="warning" icon={AlertTriangle}>
            Size will stop being a dropdown, so new products won’t be split into one SKU per size any more. Existing products don’t change.
          </Alert>
        ) : removedOptions.length > 0 ? (
          <Alert tone="warning" icon={AlertTriangle}>
            Removing {removedOptions.map(o => `“${o}”`).join(', ')}. Products that already use {removedOptions.length === 1 ? 'it' : 'them'} keep the value, but staff can’t pick {removedOptions.length === 1 ? 'it' : 'them'} for new products.
          </Alert>
        ) : (
          <p className="flex items-start gap-1.5 text-caption text-ink-muted">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
            Products already saved keep their answers. Renaming only changes what staff see on the form.
          </p>
        )
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-caption text-ink-muted">
          {editing ? 'Press Esc to cancel.' : label ? 'Shown in the preview with a dashed outline until you save.' : 'Start typing to see it in the preview.'}
        </p>
        <div className="flex gap-2 ml-auto">
          {editing && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" icon={editing ? Check : Plus} loading={saving} disabled={!canSave}>
            {editing ? 'Save changes' : 'Save field'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function BusinessFormManager() {
  const { id: routeBusinessId } = useParams();
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(routeBusinessId || '');
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [category, setCategory] = useState('');
  const [addDraft, setAddDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [addFormKey, setAddFormKey] = useState(0);
  const [renaming, setRenaming] = useState(null); // { id, name, value }
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

  // Reloads without the skeleton (after a save), so the editor and scroll position stay put
  const refresh = async () => {
    try {
      const [categoriesRes, fieldsRes] = await Promise.all([
        api.get(`/businesses/${businessId}/categories`),
        api.get(`/businesses/${businessId}/variant-attributes`)
      ]);
      setCategories(categoriesRes.data.categories || []);
      setAttributes(fieldsRes.data.attributes || []);
    } catch { await loadConfig(); }
  };

  useEffect(() => { loadBusinesses().catch(() => toast.error('Could not load businesses.')); }, [routeBusinessId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadConfig();
    setCategory(''); setEditingId(null); setEditDraft(null); setAddDraft(null); setAddFormKey(k => k + 1);
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setCategory(''); toast.success(`Category “${name}” added.`); await refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add category'); }
    finally { setSaving(false); }
  };

  const renameCategory = async (event) => {
    event?.preventDefault();
    const name = renaming.value.trim();
    if (!name || name === renaming.name) { setRenaming(null); return; }
    if (categories.some(c => c.id !== renaming.id && c.name.toLowerCase() === name.toLowerCase())) {
      toast.warning(`“${name}” is already a category.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/businesses/${businessId}/categories/${renaming.id}`, { name });
      const n = res.data.products_renamed || 0;
      toast.success(`Renamed to “${name}”${n ? `. ${n} product${n === 1 ? '' : 's'} moved with it` : ''}.`);
      setRenaming(null);
      await refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to rename category'); }
    finally { setSaving(false); }
  };

  const addField = async (payload) => {
    setSaving(true);
    try {
      await api.post(`/businesses/${businessId}/variant-attributes`, { ...payload, sort_order: (attributes.length + 1) * 10 });
      toast.success(`Field “${payload.label}” added to the product form.`);
      setAddDraft(null);
      await refresh();
      return true;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add field'); return false; }
    finally { setSaving(false); }
  };

  const updateField = async (item, payload) => {
    setSaving(true);
    try {
      const res = await api.put(`/businesses/${businessId}/variant-attributes/${item.id}`, payload);
      toast.success(`Field “${payload.label}” updated.`);
      (res.data.removed_options_in_use || []).forEach(u => {
        toast.warning(`“${u.value}” is still the ${payload.label} of ${u.products} product${u.products === 1 ? '' : 's'}. They keep it.`);
      });
      setEditingId(null); setEditDraft(null);
      await refresh();
      return true;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update field'); return false; }
    finally { setSaving(false); }
  };

  const startEdit = (item) => { setEditingId(item.id); setEditDraft(null); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  // Move a field up or down the form; saved straight away
  const moveField = async (index, delta) => {
    const next = [...attributes];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setAttributes(next);
    try {
      await api.put(`/businesses/${businessId}/variant-attributes/order`, { ids: next.map(f => f.id) });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the new order.');
      await refresh();
    }
  };

  const remove = async (path, label, note) => {
    const ok = await confirm({ title: `Remove ${label}?`, message: note, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    try { await api.delete(path); toast.success(`Removed ${label}.`); await refresh(); }
    catch (err) { toast.error(err.response?.data?.message || `Failed to remove ${label}`); }
  };

  // The live preview shows saved fields, the field being edited (with its unsaved changes) and the new one
  const previewFields = useMemo(() => {
    const list = attributes.map(a => (a.id === editingId && editDraft ? { ...a, ...editDraft, isDraft: true } : a));
    return addDraft ? [...list, { ...addDraft, isDraft: true }] : list;
  }, [attributes, editingId, editDraft, addDraft]);

  return (
    <Layout>
      <PageHeader
        breadcrumbs={[
          { label: 'Businesses', to: '/businesses' },
          { label: businessName || 'Business', to: businessId ? `/businesses/${businessId}/branches` : undefined },
          { label: 'Product form setup' },
        ]}
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
                <>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(item => (
                      <Chip
                        key={item.id}
                        onEdit={() => setRenaming({ id: item.id, name: item.name, value: item.name })}
                        editLabel={`Rename ${item.name}`}
                        removeLabel={`Remove ${item.name}`}
                        onRemove={() => remove(`/businesses/${businessId}/categories/${item.id}`, `category “${item.name}”`, 'Existing products keep their category; it just stops appearing in the dropdown.')}
                      >
                        {item.name}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-3 text-caption text-ink-muted">Click a category to rename it.</p>
                </>
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
                  {attributes.map((item, index) => {
                    if (item.id === editingId) {
                      return (
                        <li key={item.id} className="animate-fade-in">
                          <FieldEditor
                            mode="edit"
                            original={item}
                            otherFields={attributes.filter(a => a.id !== item.id)}
                            saving={saving}
                            onSubmit={payload => updateField(item, payload)}
                            onCancel={cancelEdit}
                            onDraftChange={setEditDraft}
                          />
                        </li>
                      );
                    }
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
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <IconButton icon={ArrowUp} label={`Move ${item.label} up`} size="sm" disabled={index === 0} onClick={() => moveField(index, -1)} />
                          <IconButton icon={ArrowDown} label={`Move ${item.label} down`} size="sm" disabled={index === attributes.length - 1} onClick={() => moveField(index, 1)} />
                          <IconButton icon={Pencil} label={`Edit ${item.label}`} size="sm" onClick={() => startEdit(item)} />
                          <IconButton
                            icon={Trash2}
                            label={`Remove ${item.label}`}
                            size="sm"
                            className="hover:bg-danger-muted hover:text-danger-fg"
                            onClick={() => remove(`/businesses/${businessId}/variant-attributes/${item.id}`, `field “${item.label}”`, 'Products already saved keep their values; the field just stops appearing on the form.')}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <FieldEditor
                key={addFormKey}
                otherFields={attributes}
                saving={saving && !editingId}
                onSubmit={addField}
                onDraftChange={setAddDraft}
              />
            </Card>
          </div>

          {/* ── Live preview ── */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-20">
              <FormPreview businessName={businessName} categories={categories} fields={previewFields} />
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename category"
        icon={Pencil}
        onSubmit={renameCategory}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!renaming?.value.trim() || renaming?.value.trim() === renaming?.name}>Rename</Button>
          </>
        )}
      >
        {renaming && (
          <div className="space-y-3">
            <Field label="Category name">
              <Input value={renaming.value} onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))} maxLength={100} autoFocus />
            </Field>
            <p className="flex items-start gap-1.5 text-caption text-ink-muted">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              Products in “{renaming.name}” move to the new name too, so filters and reports keep them together.
            </p>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
