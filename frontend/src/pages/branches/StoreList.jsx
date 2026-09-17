import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Store, Plus, Trash2, FileBarChart, X, Edit3, CheckCircle, AlertCircle, Calendar, MapPin, Phone, UserCheck } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';

export default function StoreList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [branch, setBranch] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', venue: '', start_date: '', end_date: '', person_in_charge: '', contact_phone: '', notes: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null, name: '', venue: '', start_date: '', end_date: '', person_in_charge: '', contact_phone: '', notes: '', status: 'upcoming'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [brRes, stRes] = await Promise.all([
        api.get(`/branches/${id}`),
        api.get(`/branches/${id}/stores`)
      ]);
      if (brRes.data.success) setBranch(brRes.data.branch || brRes.data.data);
      if (stRes.data.success) setStores(stRes.data.stores || stRes.data.data || []);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to fetch pop-up store events' });
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
      const res = await api.post('/stores', { ...addForm, branch_id: id });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowAddModal(false);
        setAddForm({ name: '', venue: '', start_date: '', end_date: '', person_in_charge: '', contact_phone: '', notes: '' });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to create store event' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to create store event' });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/stores/${editForm.id}`, editForm);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update store event' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update store event' });
    }
  };

  const handleClose = async (storeId, storeName) => {
    if (!window.confirm(`Are you sure you want to close and mark store event '${storeName}' as ended?`)) return;
    try {
      const res = await api.put(`/stores/${storeId}/close`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to close store event' });
    }
  };

  const handleDelete = async (s) => {
    if (s.status !== 'ended') {
      setMessage({
        type: 'danger',
        text: `Cannot delete store event '${s.name}': Only ended store events can be deleted. Please mark the event as ended first.`
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete store event '${s.name}'?`)) return;

    try {
      const res = await api.delete(`/stores/${s.id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to delete store event' });
    }
  };

  const openEditModal = (s) => {
    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
    setEditForm({
      id: s.id, name: s.name || '', venue: s.venue || '', start_date: formatDate(s.start_date),
      end_date: formatDate(s.end_date), person_in_charge: s.person_in_charge || '',
      contact_phone: s.contact_phone || '', notes: s.notes || s.description || '', status: s.status || 'upcoming'
    });
    setShowEditModal(true);
  };

  return (
    <Layout>
      <nav className="text-sm text-slate-400 mb-4 flex items-center gap-1.5">
        <Link to="/businesses" className="hover:text-slate-900 transition-colors">Businesses</Link>
        <span>/</span>
        <Link to={`/businesses/${branch?.business_id}/branches`} className="hover:text-slate-900 transition-colors">{branch?.business_name || 'Business'}</Link>
        <span>/</span>
        <Link to={`/branches/${id}`} className="hover:text-slate-900 transition-colors">{branch?.name || 'Branch'}</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Pop-Up Stores</span>
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pop-Up Stores — {branch ? branch.name : ''}</h1>
          <p className="text-sm text-slate-500 mt-1">A physical sales event (e.g. bazaar, pop-up booth) under this branch location.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mt-4 sm:mt-0">
          <Plus size={18} />
          Add Store Event
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading store events...</div>
      ) : stores.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center">
          <Store className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No store events yet</p>
          <p className="text-sm text-slate-500 mb-4">No store events created under {branch ? branch.name : 'this branch'} yet.</p>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Add Store Event
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">Store Sales Events ({stores.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Event Name & Venue</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Dates</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Person in Charge</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stores.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors bg-white">
                    <td className="px-4 py-3 text-sm border-b border-slate-100">
                      <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                      {s.venue && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1">
                          <MapPin size={14} className="text-indigo-500" /> {s.venue}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{s.start_date ? new Date(s.start_date).toLocaleDateString() : '—'} &rarr; {s.end_date ? new Date(s.end_date).toLocaleDateString() : '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <div>{s.person_in_charge || 'Unassigned'}</div>
                      {s.contact_phone && (
                        <div className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                          <Phone size={12} /> {s.contact_phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-slate-100">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        s.status === 'upcoming' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {s.status ? s.status.toUpperCase() : 'UPCOMING'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-slate-100 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEditModal(s)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors" title="Edit Event Details">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => navigate(`/stores/${s.id}/report`)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 transition-colors" title="View Report">
                          <FileBarChart size={14} />
                        </button>
                        {s.status === 'active' && (
                          <button onClick={() => handleClose(s.id, s.name)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-amber-600 border border-slate-200 hover:bg-amber-50 transition-colors" title="Close Event">
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(s)}
                          disabled={s.status !== 'ended'}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                            s.status === 'ended'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                              : 'bg-white text-slate-300 border border-slate-200 cursor-not-allowed'
                          }`}
                          title={s.status === 'ended' ? 'Delete Event' : 'Only ended events can be deleted'}
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add New Store Sales Event</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Store / Event Name *</label>
                <input type="text" required placeholder="e.g. Karnival Pop-Up Store 2026"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Venue / Location</label>
                <input type="text" placeholder="e.g. Mid Valley Exhibition Centre, Hall 3"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={addForm.venue} onChange={(e) => setAddForm({ ...addForm, venue: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Start Date *</label>
                  <input type="date" required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.start_date} onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">End Date *</label>
                  <input type="date" required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.end_date} onChange={(e) => setAddForm({ ...addForm, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Person-in-Charge</label>
                  <input type="text" placeholder="Event Lead Name"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.person_in_charge} onChange={(e) => setAddForm({ ...addForm, person_in_charge: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Phone</label>
                  <input type="text" placeholder="+60 12-987 6543"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={addForm.contact_phone} onChange={(e) => setAddForm({ ...addForm, contact_phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Expected Footfall / Notes</label>
                <textarea rows="2" placeholder="Booth details, expected visitor traffic, internal notes..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Save Store Event</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Store Event Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Store / Event Name *</label>
                <input type="text" required
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Venue</label>
                <input type="text"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Start Date</label>
                  <input type="date"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">End Date</label>
                  <input type="date"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Person-in-Charge</label>
                  <input type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.person_in_charge} onChange={(e) => setEditForm({ ...editForm, person_in_charge: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Contact Phone</label>
                  <input type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Event Status *</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="upcoming">UPCOMING</option>
                  <option value="active">ACTIVE</option>
                  <option value="ended">ENDED</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Notes</label>
                <textarea rows="2"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
