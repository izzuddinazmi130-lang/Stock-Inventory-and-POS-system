import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CheckCircle, Plus, Trash2, X, Tag, ListChecks, Type, List,
  Eye, Info, Lock, Layers, AlertTriangle
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';

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

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';

function StepBadge({ n }) {
  return <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>;
}

// ── Live preview of the "Add New Product" form, built from the current settings ──
function FormPreview({ businessName, categories, attributes, draftField }) {
  const draftKey = toFieldKey(draftField.label);
  const draft = draftField.label.trim()
    ? { ...draftField, attribute_key: draftKey, options: draftField.options, isDraft: true }
    : null;
  const all = draft ? [...attributes, draft] : attributes;
  const regular = all.filter(f => !isSizeField(f));
  const size = all.find(isSizeField);

  const draftRing = (f) => (f.isDraft ? 'rounded-lg outline-dashed outline-2 outline-amber-400 outline-offset-2' : '');
  const DraftTag = ({ f }) => (f.isDraft ? <span className="ml-2 text-[10px] font-bold uppercase text-amber-600">not saved yet</span> : null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <Eye className="w-4 h-4 text-indigo-600" />
        <div>
          <div className="text-sm font-bold text-slate-900">Live preview</div>
          <div className="text-[11px] text-slate-500">What staff see on “Add New Product” for {businessName || 'this business'}</div>
        </div>
      </div>

      <div className="p-4 space-y-3 pointer-events-none select-none" aria-hidden="true">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Product Name *</label>
          <input className={inputClass} placeholder="e.g. Product name" readOnly />
        </div>

        <div className="rounded-lg ring-2 ring-indigo-200 ring-offset-2 p-1 -m-1">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Category * <span className="ml-1 text-[10px] font-semibold text-indigo-600">← from Step 1</span>
          </label>
          <select className={inputClass} defaultValue="">
            <option value="">-- Select --</option>
          </select>
          {categories.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {categories.map(c => <span key={c.id} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{c.name}</span>)}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-amber-600">Empty — add categories in Step 1, or staff can’t pick one.</p>
          )}
        </div>

        {(regular.length > 0 || size) && (
          <div className="rounded-lg ring-2 ring-indigo-200 ring-offset-2 p-1 -m-1 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Layers className="w-3.5 h-3.5 text-indigo-600" /> Additional Custom Attributes
              <span className="text-[10px] font-semibold text-indigo-600">← from Step 2</span>
            </div>
            {regular.map(f => (
              <div key={f.attribute_key || 'draft'} className={draftRing(f)}>
                <label className="block text-xs font-medium text-slate-700 mb-1">{f.label}<DraftTag f={f} /></label>
                {f.input_type === 'select' ? (
                  <>
                    <select className={inputClass} defaultValue=""><option value="">Select {f.label}</option></select>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {parseOptions(f.options).length > 0
                        ? parseOptions(f.options).map(o => <span key={o} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{o}</span>)
                        : <span className="text-[11px] text-amber-600">No options yet</span>}
                    </div>
                  </>
                ) : (
                  <input className={inputClass} placeholder={f.label} readOnly />
                )}
              </div>
            ))}
            {size && (
              <div className={`border-t border-slate-100 pt-3 ${draftRing(size)}`}>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">{size.label}s<DraftTag f={size} /></label>
                <div className="flex flex-wrap gap-1.5">
                  {parseOptions(size.options).map((o, i) => (
                    <span key={o} className={`min-w-10 h-8 px-2.5 inline-flex items-center justify-center rounded-lg border text-xs font-semibold ${i === 0 ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600'}`}>{o}</span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">Each size picked becomes its own SKU with its own stock and prices.</p>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-dashed border-slate-200">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <Lock className="w-3 h-3" /> Always included (not configurable)
          </div>
          <div className="grid grid-cols-2 gap-2 opacity-60">
            {['Initial Stock *', 'Low Stock Threshold', 'Customer Price', 'Dealer Price', 'Staff Price', 'Cost / Purchase Price'].map(l => (
              <div key={l}>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">{l}</label>
                <div className="h-8 rounded-lg border border-slate-200 bg-slate-50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
  const [message, setMessage] = useState(null);

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
    try {
      const [categoriesRes, fieldsRes] = await Promise.all([
        api.get(`/businesses/${businessId}/categories`),
        api.get(`/businesses/${businessId}/variant-attributes`)
      ]);
      setCategories(categoriesRes.data.categories || []);
      setAttributes(fieldsRes.data.attributes || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load form configuration' });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBusinesses().catch(() => setMessage({ type: 'error', text: 'Failed to load businesses' })); }, [routeBusinessId]);
  useEffect(() => { loadConfig(); setField(emptyField); setOptionDraft(''); setCategory(''); }, [businessId]);

  const addCategory = async (event) => {
    event.preventDefault();
    const name = category.trim();
    if (!name) return;
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setMessage({ type: 'error', text: `“${name}” is already a category.` });
      return;
    }
    setSaving(true);
    try {
      await api.post(`/businesses/${businessId}/categories`, { name, sort_order: categories.length * 10 });
      setCategory(''); setMessage({ type: 'success', text: `Category “${name}” added` }); await loadConfig();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add category' }); }
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
      setMessage({ type: 'success', text: `Field “${field.label.trim()}” added to the product form` });
      setField(emptyField); setOptionDraft('');
      await loadConfig();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add field' }); }
    finally { setSaving(false); }
  };

  const remove = async (path, label, note) => {
    if (!window.confirm(`Remove ${label}?\n\n${note}`)) return;
    try { await api.delete(path); setMessage({ type: 'success', text: `${label} removed` }); await loadConfig(); }
    catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || `Failed to remove ${label}` }); }
  };

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/businesses" className="p-2 text-slate-500 hover:text-slate-900" title="Back to businesses"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Product Form Setup</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose what staff fill in when they add a new product{businessName ? <> for <strong className="text-slate-700">{businessName}</strong></> : ''}. Changes apply right away.
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-5 p-3 rounded-xl text-sm flex justify-between ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          <span className="flex gap-2 items-center">{message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{message.text}</span>
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-slate-700 mb-1">Business you are setting up</label>
        <select value={businessId} onChange={event => setBusinessId(event.target.value)} className={inputClass}>
          {businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center py-10 text-slate-400">Loading form configuration...</div> : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* ── Editor ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Step 1: Categories */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <StepBadge n={1} />
                <div>
                  <h2 className="font-bold text-slate-900 flex items-center gap-2"><Tag className="w-4 h-4 text-indigo-600" /> Product categories</h2>
                  <p className="text-xs text-slate-500 mt-0.5">The choices in the <strong>Category</strong> dropdown. Every product must belong to one. Examples: Kaftan, Blouse, Scarf.</p>
                </div>
              </div>
              <form onSubmit={addCategory} className="flex gap-2 mb-3">
                <input value={category} onChange={event => setCategory(event.target.value)} placeholder="Type a category name, e.g. Kaftan" className={inputClass + ' flex-1'} maxLength={100} />
                <button disabled={saving || !category.trim()} className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>
              {categories.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">No categories yet. Add at least one — staff can’t save a product without a category.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map(item => (
                    <span key={item.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 h-8 rounded-full bg-slate-100 text-sm text-slate-800">
                      {item.name}
                      <button
                        onClick={() => remove(`/businesses/${businessId}/categories/${item.id}`, `category “${item.name}”`, 'Existing products keep their category; it just stops appearing in the dropdown.')}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                        title={`Remove ${item.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Step 2: Extra fields */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <StepBadge n={2} />
                <div>
                  <h2 className="font-bold text-slate-900 flex items-center gap-2"><ListChecks className="w-4 h-4 text-indigo-600" /> Extra details (optional)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Extra questions staff answer for each product, such as Colour, Material or Model. Leave empty if name, category and prices are enough.</p>
                </div>
              </div>

              {attributes.length > 0 && (
                <div className="space-y-2 mb-5">
                  {attributes.map(item => {
                    const opts = parseOptions(item.options);
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm text-slate-900">{item.label}</strong>
                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                              {item.input_type === 'select' ? <><List className="w-3 h-3" /> Dropdown</> : <><Type className="w-3 h-3" /> Free text</>}
                            </span>
                            {isSizeField(item) && <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">one SKU per size</span>}
                          </div>
                          {opts.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {opts.map(o => <span key={o} className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">{o}</span>)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => remove(`/businesses/${businessId}/variant-attributes/${item.id}`, `field “${item.label}”`, 'Products already saved keep their values; the field just stops appearing on the form.')}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600 flex-shrink-0"
                          title={`Remove ${item.label}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={addField} className="rounded-xl border border-dashed border-slate-300 p-4 space-y-4">
                <div className="text-sm font-semibold text-slate-800">Add a new field</div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Field name <span className="text-slate-400 font-normal">— what staff will see</span></label>
                  <input value={field.label} onChange={event => setField({ ...field, label: event.target.value })} placeholder="e.g. Material" className={inputClass} maxLength={100} />
                  {fieldError && <p className="mt-1 text-xs text-rose-600">{fieldError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">How should staff answer?</label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      { value: 'text', icon: Type, title: 'Free text', desc: 'Staff type anything. Good for Colour or Model number.' },
                      { value: 'select', icon: List, title: 'Dropdown list', desc: 'Staff pick from options you set. Good for Material or Size.' }
                    ].map(opt => {
                      const active = field.input_type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setField({ ...field, input_type: opt.value })}
                          className={`text-left p-3 rounded-lg border transition-colors ${active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><opt.icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} /> {opt.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {field.input_type === 'select' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Dropdown options</label>
                    <div className="flex gap-2">
                      <input
                        value={optionDraft}
                        onChange={e => setOptionDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addOption(); } }}
                        placeholder="Type an option, then press Enter"
                        className={inputClass + ' flex-1'}
                      />
                      <button type="button" onClick={addOption} disabled={!optionDraft.trim()} className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Add option</button>
                    </div>
                    {field.options.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {field.options.map(o => (
                          <span key={o} className="inline-flex items-center gap-1 pl-2.5 pr-1 h-7 rounded-full bg-indigo-50 text-indigo-800 text-xs font-medium">
                            {o}
                            <button type="button" onClick={() => removeOption(o)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-indigo-100" title={`Remove ${o}`}><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">Add at least one option.</p>
                    )}
                    {fieldKey === 'size' && (
                      <p className="mt-2 flex gap-1.5 text-[11px] text-indigo-700 bg-indigo-50 rounded-lg p-2">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                        A dropdown called “Size” is special: staff can tick several sizes at once, and each size becomes its own product (SKU) with its own stock and prices.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-slate-500">{field.label.trim() ? 'Shown in the preview with a dashed outline until you save.' : 'Start typing to see it in the preview.'}</p>
                  <button disabled={saving || !canSaveField} className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0">
                    <Plus className="w-4 h-4" /> Save field
                  </button>
                </div>
              </form>
            </section>
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
