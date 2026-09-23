import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, ArrowRight, Edit3, Trash2, X, CheckCircle, AlertCircle, Phone, Mail, FileText, SlidersHorizontal } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';

export default function BusinessList() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

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
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
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
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mt-4 sm:mt-0">
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
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h3 className="text-lg font-bold text-slate-900">Add New Business Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Trading Name *</label>
                    <input type="text" required placeholder="e.g. Kaftanasia"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Legal / Registered Name</label>
                    <input type="text" placeholder="e.g. Kaftanasia Sdn. Bhd."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.legal_name} onChange={(e) => setAddForm({ ...addForm, legal_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Business Registration No.</label>
                    <input type="text" placeholder="e.g. 202601099882 (123456-X)"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.registration_number} onChange={(e) => setAddForm({ ...addForm, registration_number: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Industry / Category</label>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.industry} onChange={(e) => setAddForm({ ...addForm, industry: e.target.value })}>
                      <option value="">-- Select --</option>
                      <option value="fashion">Fashion &amp; Apparel</option>
                      <option value="technology">Technology &amp; Electronics</option>
                      <option value="general">General / Other</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Determines the Add Product form shown to this business's branches.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Person</label>
                    <input type="text" placeholder="Primary contact name"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.contact_person} onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Email</label>
                    <input type="email" placeholder="contact@business.com"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.contact_email} onChange={(e) => setAddForm({ ...addForm, contact_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Phone</label>
                    <input type="text" placeholder="+60 12-345 6789"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.contact_phone} onChange={(e) => setAddForm({ ...addForm, contact_phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Head Office Address</label>
                  <input type="text" placeholder="Street address, building, city, state"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Corporate Notes / Summary</label>
                  <textarea rows="2" placeholder="Internal notes or description..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                  <button type="button" onClick={() => setShowAddModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Save Business Profile</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h3 className="text-lg font-bold text-slate-900">Edit Business Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Trading Name *</label>
                    <input type="text" required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Legal Name</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.legal_name} onChange={(e) => setEditForm({ ...editForm, legal_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Registration Number</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.registration_number} onChange={(e) => setEditForm({ ...editForm, registration_number: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Industry</label>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}>
                      <option value="">-- Select --</option>
                      <option value="fashion">Fashion &amp; Apparel</option>
                      <option value="technology">Technology &amp; Electronics</option>
                      <option value="general">General / Other</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Determines the Add Product form shown to this business's branches.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Person</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.contact_person} onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Email</label>
                    <input type="email"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Phone</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Address</label>
                  <input type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Notes</label>
                  <textarea rows="2"
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                  <button type="button" onClick={() => setShowEditModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}