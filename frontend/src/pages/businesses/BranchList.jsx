import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building, Plus, Store, Edit3, Trash2, X, CheckCircle, AlertCircle, FileBarChart, ExternalLink } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';

export default function BranchList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
    contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null, name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
    contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: '', is_active: 1
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [busRes, brRes] = await Promise.all([
        api.get(`/businesses/${id}`),
        api.get(`/businesses/${id}/branches`)
      ]);
      if (busRes.data.success) setBusiness(busRes.data.business || busRes.data.data);
      if (brRes.data.success) setBranches(brRes.data.branches || brRes.data.data || []);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to fetch branch network' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/branches', { ...addForm, business_id: id });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowAddModal(false);
        setAddForm({
          name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
          contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: ''
        });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to add branch' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to add branch' });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/branches/${editForm.id}`, editForm);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update branch' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update branch' });
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Are you sure you want to delete branch '${b.name}'?`)) return;
    try {
      const res = await api.delete(`/branches/${b.id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to delete branch' });
    }
  };

  const openEditModal = (b) => {
    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
    setEditForm({
      id: b.id,
      name: b.name || '',
      branch_code: b.branch_code || '',
      address: b.address || '',
      city: b.city || '',
      state: b.state || '',
      postcode: b.postcode || '',
      contact_person: b.contact_person || '',
      contact_phone: b.contact_phone || '',
      contact_email: b.contact_email || '',
      operating_hours: b.operating_hours || '',
      opening_date: formatDate(b.opening_date),
      is_active: b.is_active !== undefined ? b.is_active : 1
    });
    setShowEditModal(true);
  };

  return (
    <Layout>
      <nav className="text-sm text-slate-400 flex items-center gap-1.5 mb-4">
        <Link to="/businesses" className="hover:text-slate-900 transition-colors">Businesses</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{business ? business.name : 'Loading...'}</span>
      </nav>

      {message && (
        <div className={`mb-6 flex items-center justify-between transition-all ${
          message.type === 'success' 
            ? 'p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm' 
            : 'p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{business ? business.name : 'Branches'}</h1>
          <p className="text-sm text-slate-500 mt-1">Operational branch locations under {business ? business.name : 'this business'}. Click any branch to enter its dashboard.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mt-4 sm:mt-0">
          <Plus size={18} />
          Add Branch
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading branch network...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center">
          <Building className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No branches yet</p>
          <p className="text-sm text-slate-500 mb-4">No branches registered under {business ? business.name : 'this business'} yet.</p>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Add Branch
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">Branch Network ({branches.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Branch Name & Code</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Location / Address</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Contact Person</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer bg-white"
                    onClick={(e) => {
                      if (e.target.closest('button') || e.target.closest('a')) return;
                      navigate(`/branches/${b.id}`);
                    }}
                  >
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-md">
                          <Building size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{b.name}</span>
                            <ExternalLink size={12} className="text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                          <span className="text-xs text-slate-500">Code: {b.branch_code || `BR-${b.id}`}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <div className="font-medium">{b.city ? `${b.city}${b.state ? `, ${b.state}` : ''}` : 'Location Set'}</div>
                      <div className="text-slate-500 text-xs truncate max-w-xs">{b.address || 'Standard Address'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <div>{b.contact_person || 'HQ Manager'}</div>
                      <div className="text-slate-500 text-xs">{b.contact_phone || b.contact_email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <span className={b.is_active === 1 
                        ? 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700' 
                        : 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600'}>
                        {b.is_active === 1 ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 text-right">
                      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditModal(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                          title="Edit Branch"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/reports?business_id=${b.business_id}&branch_id=${b.id}`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 transition-colors"
                          title="View Reports"
                        >
                          <FileBarChart size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/branches/${b.id}/stores`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-amber-600 border border-slate-200 hover:bg-amber-50 transition-colors"
                          title="View Stores"
                        >
                          <Store size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors"
                          title="Delete Branch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 px-6 pt-6">
              <h3 className="text-lg font-bold text-slate-900">Add New Branch Location</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 pb-6">
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Branch Name *</label>
                    <input type="text" required placeholder="e.g. Bangi Central Branch"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Branch Code</label>
                    <input type="text" placeholder="e.g. AST-KT or KAF-BG"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.branch_code} onChange={(e) => setAddForm({ ...addForm, branch_code: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Street Address</label>
                  <input type="text" placeholder="Lot number, building, street address"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">City</label>
                    <input type="text" placeholder="Bandar Baru Bangi"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.city} onChange={(e) => setAddForm({ ...addForm, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">State</label>
                    <input type="text" placeholder="Selangor"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.state} onChange={(e) => setAddForm({ ...addForm, state: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Postcode</label>
                    <input type="text" placeholder="43650"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.postcode} onChange={(e) => setAddForm({ ...addForm, postcode: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Branch Manager / Contact</label>
                    <input type="text" placeholder="Manager name"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.contact_person} onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Contact Phone</label>
                    <input type="text" placeholder="+60 3-8920 1122"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.contact_phone} onChange={(e) => setAddForm({ ...addForm, contact_phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Contact Email</label>
                    <input type="email" placeholder="branch@domain.com"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.contact_email} onChange={(e) => setAddForm({ ...addForm, contact_email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Operating Hours</label>
                    <input type="text" placeholder="e.g. Mon-Sun 10:00 AM - 10:00 PM"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.operating_hours} onChange={(e) => setAddForm({ ...addForm, operating_hours: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Opening Date</label>
                    <input type="date"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={addForm.opening_date} onChange={(e) => setAddForm({ ...addForm, opening_date: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                  <button type="button" onClick={() => setShowAddModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Save Branch</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 px-6 pt-6">
              <h3 className="text-lg font-bold text-slate-900">Edit Branch Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 pb-6">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Branch Name *</label>
                    <input type="text" required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Branch Code</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.branch_code} onChange={(e) => setEditForm({ ...editForm, branch_code: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Address</label>
                  <input type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">City</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">State</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Postcode</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.postcode} onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Contact Person</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.contact_person} onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Contact Phone</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Contact Email</label>
                    <input type="email"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Operating Hours</label>
                    <input type="text"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.operating_hours} onChange={(e) => setEditForm({ ...editForm, operating_hours: e.target.value })} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: parseInt(e.target.value) })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value={1}>ACTIVE</option>
                      <option value={0}>INACTIVE</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
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
