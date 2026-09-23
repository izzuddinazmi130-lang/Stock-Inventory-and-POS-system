import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Plus, Trash2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';

const emptyField = { attribute_key: '', label: '', input_type: 'text', options: '' };

export default function BusinessFormManager() {
  const { id: routeBusinessId } = useParams();
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(routeBusinessId || '');
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [category, setCategory] = useState('');
  const [field, setField] = useState(emptyField);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

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
  useEffect(() => { loadConfig(); }, [businessId]);

  const addCategory = async (event) => {
    event.preventDefault();
    if (!category.trim()) return;
    setSaving(true);
    try {
      await api.post(`/businesses/${businessId}/categories`, { name: category.trim(), sort_order: categories.length * 10 });
      setCategory(''); setMessage({ type: 'success', text: 'Category added' }); await loadConfig();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add category' }); }
    finally { setSaving(false); }
  };

  const addField = async (event) => {
    event.preventDefault();
    const options = field.options.split(',').map(option => option.trim()).filter(Boolean);
    setSaving(true);
    try {
      await api.post(`/businesses/${businessId}/variant-attributes`, { ...field, options, sort_order: attributes.length * 10 });
      setField(emptyField); setMessage({ type: 'success', text: 'Extra field added' }); await loadConfig();
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add extra field' }); }
    finally { setSaving(false); }
  };

  const remove = async (path, label) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    try { await api.delete(path); setMessage({ type: 'success', text: `${label} removed` }); await loadConfig(); }
    catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || `Failed to remove ${label}` }); }
  };

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/businesses" className="p-2 text-slate-500 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /></Link>
        <div><h1 className="text-2xl font-extrabold text-slate-900">Manage Product Form</h1><p className="text-sm text-slate-500 mt-1">Configure categories and extra product fields per business.</p></div>
      </div>
      {message && <div className={`mb-5 p-3 rounded-xl text-sm flex justify-between ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}><span className="flex gap-2 items-center">{message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : null}{message.text}</span><button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button></div>}
      <div className="max-w-4xl mx-auto">
        <label className="block text-sm font-medium text-slate-700 mb-2">Business</label>
        <select value={businessId} onChange={event => setBusinessId(event.target.value)} className="h-10 w-full mb-6 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          {businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
        </select>
        {loading ? <div className="text-center py-10 text-slate-400">Loading form configuration...</div> : <div className="grid gap-5 lg:grid-cols-2">
          <section className="bg-white border border-slate-200 rounded-xl p-5"><h2 className="font-bold text-slate-900 mb-4">Categories</h2><form onSubmit={addCategory} className="flex gap-2 mb-4"><input value={category} onChange={event => setCategory(event.target.value)} placeholder="Category name" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" /><button disabled={saving} className="h-10 px-3 rounded-lg bg-indigo-600 text-white"><Plus className="w-4 h-4" /></button></form><div className="space-y-2">{categories.map(item => <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm"><span>{item.name}</span><button onClick={() => remove(`/businesses/${businessId}/categories/${item.id}`, 'Category')} className="text-rose-500"><Trash2 className="w-4 h-4" /></button></div>)}</div>{categories.length === 0 && <p className="text-xs text-slate-500">No categories configured. Add categories to populate the product dropdown.</p>}</section>
          <section className="bg-white border border-slate-200 rounded-xl p-5"><h2 className="font-bold text-slate-900 mb-4">Extra Fields</h2><form onSubmit={addField} className="space-y-2 mb-4"><input required value={field.attribute_key} onChange={event => setField({ ...field, attribute_key: event.target.value })} placeholder="Key, e.g. material" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /><input required value={field.label} onChange={event => setField({ ...field, label: event.target.value })} placeholder="Label, e.g. Material" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /><select value={field.input_type} onChange={event => setField({ ...field, input_type: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="text">Text</option><option value="select">Dropdown</option></select>{field.input_type === 'select' && <input required value={field.options} onChange={event => setField({ ...field, options: event.target.value })} placeholder="Options separated by commas" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />}<button disabled={saving} className="h-10 px-3 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Add Field</button></form><div className="space-y-2">{attributes.map(item => <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm"><span><strong>{item.label}</strong><span className="text-xs text-slate-500 ml-2">{item.input_type}</span></span><button onClick={() => remove(`/businesses/${businessId}/variant-attributes/${item.id}`, 'Field')} className="text-rose-500"><Trash2 className="w-4 h-4" /></button></div>)}</div>{attributes.length === 0 && <p className="text-xs text-slate-500">No extra fields configured. The product form will show the base fields only.</p>}</section>
        </div>}
      </div>
    </Layout>
  );
}
