import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, ArrowRight, Edit3, Trash2, X, CheckCircle, AlertCircle, Phone, Mail, FileText, SlidersHorizontal } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Modal, FormSection, Field, Input, Select, Textarea, PrimaryButton, SecondaryButton } from '../../components/ui/Form';

export default function BusinessList() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', legal_name: '', registration_number: '', industry: '',
    contact_person: '', contact_email: '', contact_phone: '', address: '', notes: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null, name: '', legal_name: '', registration_number: '', industry: '',
    contact_person: '', contact_email: '', contact_phone: '', address: '', notes: ''
  });

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/businesses');
      if (res.data.success) {
        setBusinesses(res.data.businesses || res.data.data || []);
      }
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to fetch business directory' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/businesses', addForm);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowAddModal(false);
        setAddForm({
          name: '', legal_name: '', registration_number: '', industry: '',
          contact_person: '', contact_email: '', contact_phone: '', address: '', notes: ''
        });
        fetchBusinesses();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to create business' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to create business' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/businesses/${editForm.id}`, editForm);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        fetchBusinesses();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update business' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update business' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    const branchCount = Number(b.active_branch_count || b.total_branch_count || 0);
    if (branchCount > 0) {
      setMessage({
        type: 'danger',
        text: `Cannot delete business '${b.name}': It currently has ${branchCount} branch(es) assigned. Superadmin must delete or reassign all branches first.`
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete business '${b.name}'?`)) return;

    try {
      const res = await api.delete(`/businesses/${b.id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchBusinesses();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to delete business' });
    }
  };

  const openEditModal = (b) => {
    setEditForm({
      id: b.id,
      name: b.name || '',
      legal_name: b.legal_name || '',
      registration_number: b.registration_number || '',
      industry: b.industry || '',
      contact_person: b.contact_person || '',
      contact_email: b.contact_email || '',
      contact_phone: b.contact_phone || '',
      address: b.address || '',
      notes: b.notes || b.description || ''
    });
    setMessage(null);
    setShowEditModal(true);
  };

  const getBusinessColor = (name, industry) => {
    const text = `${name} ${industry}`.toLowerCase();
    if (text.includes('kaftanasia') || text.includes('fashion')) return '#B4502E';
    if (text.includes('as tech') || text.includes('technology')) return '#2563EB';
    return '#6366f1'; // default indigo
  };

  return (
    <Layout>
      {message && (
        <div className={`mb-6 flex items-center justify-between transition-all ${
          message.type === 'success' 
            ? 'p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm'
            : 'p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">View Business</h1>
          <p className="text-sm text-slate-500 mt-1">Corporate entity registry, business profiles, and operational branch hierarchy.</p>
        </div>
        <button onClick={() => { setMessage(null); setShowAddModal(true); }} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mt-4 sm:mt-0">
          <Plus size={18} />
          Add Business
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading corporate directory...</div>
      ) : businesses.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center">
          <Building2 className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No businesses yet</p>
          <p className="text-sm text-slate-500 mb-4">Add your first business entity to get started.</p>
          <button onClick={() => { setMessage(null); setShowAddModal(true); }} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Add Business
          </button>
        </div>
      ) : (
        <>
          <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-500 mb-4">Corporate Entities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {businesses.map((b) => {
              const activeBranches = Number(b.active_branch_count || 0);
              const bColor = getBusinessColor(b.name, b.industry);
              return (
                <div key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow" style={{ borderBottom: `2px solid ${bColor}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg text-white flex-shrink-0" style={{ backgroundColor: bColor }}>
                          <Building2 size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{b.name}</h3>
                          {b.registration_number && (
                            <span className="text-xs text-slate-500 block">Reg: {b.registration_number}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEditModal(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                          title="Edit Corporate Details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors"
                          title="Delete Business"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {b.legal_name && (
                      <p className="text-sm text-slate-700 mb-3 font-medium">Legal Name: {b.legal_name}</p>
                    )}

                    <div className="space-y-2 mb-4 text-sm text-slate-600">
                      {b.industry && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">Industry:</span>
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700">{b.industry}</span>
                        </div>
                      )}
                      {b.contact_person && <p><span className="text-slate-400 font-medium">Contact:</span> {b.contact_person}</p>}
                      {b.contact_email && (
                        <p className="flex items-center gap-1.5 text-slate-700">
                          <Mail size={14} className="text-slate-400" /> {b.contact_email}
                        </p>
                      )}
                      {b.contact_phone && (
                        <p className="flex items-center gap-1.5 text-slate-700">
                          <Phone size={14} className="text-slate-400" /> {b.contact_phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      <strong className="text-slate-900 font-bold">{activeBranches}</strong> active branches
                    </span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => navigate(`/businesses/${b.id}/forms`)} className="inline-flex items-center gap-1.5 text-indigo-600 text-sm font-semibold hover:text-indigo-800 transition-colors" title="Manage Product Form">
                        <SlidersHorizontal size={14} /> Manage Form
                      </button>
                      <button onClick={() => navigate(`/businesses/${b.id}/branches`)} className="inline-flex items-center gap-1.5 text-indigo-600 text-sm font-semibold hover:text-indigo-800 transition-colors">
                        Branches <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showAddModal && (
        <Modal
          size="lg"
          icon={Building2}
          title="Add a new business"
          description="Only the trading name is required. You can fill in the rest later."
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={saving}>{saving ? 'Saving…' : 'Create business'}</PrimaryButton>
          </>}
        >
          <BusinessFields form={addForm} setForm={setAddForm} />
        </Modal>
      )}

      {showEditModal && (
        <Modal
          size="lg"
          icon={Edit3}
          title={`Edit ${editForm.name || 'business'}`}
          description="Changes apply to this business and all of its branches."
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</PrimaryButton>
          </>}
        >
          <BusinessFields form={editForm} setForm={setEditForm} />
        </Modal>
      )}
    </Layout>
  );
}

// Fields shared by the Add and Edit business forms
function BusinessFields({ form, setForm }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <>
      <FormSection title="Business identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Trading name" required hint="The name staff and customers know.">
            <Input required placeholder="e.g. Kaftanasia" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Registered company name" optional>
            <Input placeholder="e.g. Kaftanasia Sdn. Bhd." value={form.legal_name} onChange={set('legal_name')} />
          </Field>
          <Field label="Registration number" optional>
            <Input placeholder="e.g. 202601099882 (123456-X)" value={form.registration_number} onChange={set('registration_number')} />
          </Field>
          <Field label="Industry" optional hint="Used to group businesses. Product form fields are set under “Product form”.">
            <Select value={form.industry} onChange={set('industry')}>
              <option value="">Choose an industry…</option>
              <option value="fashion">Fashion &amp; Apparel</option>
              <option value="technology">Technology &amp; Electronics</option>
              <option value="general">General / Other</option>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Main contact" description="Who HQ should reach about this business.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Contact person" optional>
            <Input placeholder="Full name" value={form.contact_person} onChange={set('contact_person')} />
          </Field>
          <Field label="Email" optional>
            <Input type="email" placeholder="contact@business.com" value={form.contact_email} onChange={set('contact_email')} />
          </Field>
          <Field label="Phone" optional>
            <Input type="tel" placeholder="+60 12-345 6789" value={form.contact_phone} onChange={set('contact_phone')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Other details">
        <Field label="Head office address" optional>
          <Input placeholder="Street, building, city, state" value={form.address} onChange={set('address')} />
        </Field>
        <Field label="Internal notes" optional hint="Only visible to HQ.">
          <Textarea rows={2} placeholder="Anything worth remembering about this business…" value={form.notes} onChange={set('notes')} />
        </Field>
      </FormSection>
    </>
  );
}