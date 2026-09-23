import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Store, Plus, Trash2, FileBarChart, X, Edit3, CheckCircle,
  AlertCircle, Calendar, MapPin, Phone, Clock, Radio,
  ArrowRight, ShieldAlert, CheckCircle2, ChevronRight, Eye
} from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Helper: format full datetime string nicely (e.g. "18 Sep 2026, 10:00 AM")
function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Helper: extract 'YYYY-MM-DD' for date input
function toDateInputValue(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: extract 'HH:mm' for time input
function toTimeInputValue(val, defaultTime = '09:00') {
  if (!val) return defaultTime;
  const d = new Date(val);
  if (isNaN(d.getTime())) return defaultTime;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper: determine real-time phase (before, during, after)
function getStorePhase(store) {
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (store.status === 'ended' || (eTime > 0 && now > eTime)) {
    return 'after'; // Ended / Concluded
  }
  if (sTime > 0 && now < sTime) {
    return 'before'; // Upcoming
  }
  if (sTime > 0 && eTime > 0 && now >= sTime && now <= eTime) {
    return 'during'; // Active / Happening Now
  }
  return store.status === 'active' ? 'during' : 'before';
}

// Helper: countdown or relative timing text
function getTimingStatusText(store, phase) {
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (phase === 'before') {
    const diffMs = sTime - now;
    if (diffMs <= 0) return 'Starts shortly';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return `Starts in ${days} day${days > 1 ? 's' : ''}${remHours > 0 ? `, ${remHours}h` : ''}`;
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return `Starts in ${hours}h ${mins % 60}m`;
    return `Starts in ${Math.max(1, mins)} min${mins !== 1 ? 's' : ''}`;
  }

  if (phase === 'during') {
    const diffMs = eTime - now;
    if (diffMs <= 0) return 'Ending now';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return `Live Now • Closes in ${days}d ${remHours}h`;
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return `Live Now • Ends in ${hours}h ${mins % 60}m`;
    return `Live Now • Ends in ${Math.max(1, mins)} mins`;
  }

  // Phase is 'after'
  if (store.ended_at || eTime > 0) {
    const closedTime = store.ended_at ? new Date(store.ended_at).getTime() : eTime;
    const diffMs = now - closedTime;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0) return `Concluded ${days} day${days > 1 ? 's' : ''} ago`;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return `Concluded ${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Recently concluded';
  }

  return 'Concluded';
}

export default function StoreList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [branch, setBranch] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Redirect branch admin if attempting to access another branch's store list
  useEffect(() => {
    if (user && !isSuperAdmin && user.branch_id && String(id) !== String(user.branch_id)) {
      navigate(`/branches/${user.branch_id}/stores`, { replace: true });
    }
  }, [user, isSuperAdmin, id, navigate]);

  // Filter tab: 'all' | 'during' (live) | 'before' (upcoming) | 'after' (concluded)
  const [filterTab, setFilterTab] = useState('all');

  // Detail Inspect Modal
  const [selectedStore, setSelectedStore] = useState(null);

  // Add Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    venue: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '22:00',
    person_in_charge: '',
    contact_phone: '',
    notes: ''
  });

  // Edit Form
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    name: '',
    venue: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '22:00',
    person_in_charge: '',
    contact_phone: '',
    notes: '',
    status: 'auto'
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
      setMessage({ type: 'danger', text: 'Failed to fetch store events' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Compute counts for filter tabs
  const phaseCounts = useMemo(() => {
    let before = 0, during = 0, after = 0;
    stores.forEach(s => {
      const p = getStorePhase(s);
      if (p === 'before') before++;
      else if (p === 'during') during++;
      else if (p === 'after') after++;
    });
    return { before, during, after, all: stores.length };
  }, [stores]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (filterTab === 'all') return stores;
    return stores.filter(s => getStorePhase(s) === filterTab);
  }, [stores, filterTab]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const startDateTime = `${addForm.start_date} ${addForm.start_time}:00`;
      const endDateTime = `${addForm.end_date} ${addForm.end_time}:00`;

      if (new Date(endDateTime) < new Date(startDateTime)) {
        setMessage({ type: 'danger', text: 'End date and time cannot be earlier than start date and time.' });
        return;
      }

      const res = await api.post('/stores', {
        branch_id: id,
        name: addForm.name,
        venue: addForm.venue,
        start_date: startDateTime,
        end_date: endDateTime,
        person_in_charge: addForm.person_in_charge,
        contact_phone: addForm.contact_phone,
        notes: addForm.notes
      });

      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowAddModal(false);
        setAddForm({
          name: '', venue: '', start_date: '', start_time: '09:00',
          end_date: '', end_time: '22:00', person_in_charge: '', contact_phone: '', notes: ''
        });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to create store event' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const startDateTime = `${editForm.start_date} ${editForm.start_time}:00`;
      const endDateTime = `${editForm.end_date} ${editForm.end_time}:00`;

      if (new Date(endDateTime) < new Date(startDateTime)) {
        setMessage({ type: 'danger', text: 'End date and time cannot be earlier than start date and time.' });
        return;
      }

      const res = await api.put(`/stores/${editForm.id}`, {
        name: editForm.name,
        venue: editForm.venue,
        start_date: startDateTime,
        end_date: endDateTime,
        person_in_charge: editForm.person_in_charge,
        contact_phone: editForm.contact_phone,
        notes: editForm.notes,
        status: editForm.status
      });

      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update store event' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleClose = async (storeId, storeName) => {
    if (!window.confirm(`Are you sure you want to conclude store event '${storeName}' early?`)) return;
    try {
      const res = await api.put(`/stores/${storeId}/close`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleDelete = async (s) => {
    const phase = getStorePhase(s);
    if (phase === 'during') {
      setMessage({
        type: 'danger',
        text: `Cannot delete store event '${s.name}': It is currently active in progress. Please wait for it to end or close the event first.`
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete store event '${s.name}'?`)) return;

    try {
      const res = await api.delete(`/stores/${s.id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const openEditModal = (s) => {
    setEditForm({
      id: s.id,
      name: s.name || '',
      venue: s.venue || '',
      start_date: toDateInputValue(s.start_date),
      start_time: toTimeInputValue(s.start_date, '09:00'),
      end_date: toDateInputValue(s.end_date),
      end_time: toTimeInputValue(s.end_date, '22:00'),
      person_in_charge: s.person_in_charge || '',
      contact_phone: s.contact_phone || '',
      notes: s.notes || s.description || '',
      status: s.status || 'auto'
    });
    setShowEditModal(true);
  };

  return (
    <Layout>
      {/* Breadcrumb Navigation */}
      <nav className="text-sm text-slate-400 mb-4 flex items-center gap-1.5">
        {isSuperAdmin ? (
          <>
            <Link to="/businesses" className="hover:text-slate-900 transition-colors">Businesses</Link>
            <span>/</span>
            <Link to={`/businesses/${branch?.business_id}/branches`} className="hover:text-slate-900 transition-colors">{branch?.business_name || 'Business'}</Link>
            <span>/</span>
            <Link to={`/branches/${id}`} className="hover:text-slate-900 transition-colors">{branch?.name || 'Branch'}</Link>
            <span>/</span>
          </>
        ) : (
          <>
            <Link to="/dashboard" className="hover:text-slate-900 transition-colors">{branch?.name || user?.branch_name || 'My Branch'}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-900 font-semibold">Store Events</span>
      </nav>

      {/* Notifications */}
      {message && (
        <div className={`mb-6 flex items-center justify-between transition-all ${
          message.type === 'success' 
            ? 'p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm' 
            : 'p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Store Events &mdash; {branch ? branch.name : 'Branch'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track temporary physical sales events, dates, operating hours, and live checkout status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/branches/${id}/floor-report`}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileBarChart size={16} className="text-indigo-600" />
            <span>Branch Floor Sales</span>
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Add Store Event</span>
          </button>
        </div>
      </div>

      {/* Status Phase Tabs: All | Live Now | Upcoming | Concluded */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Events ({phaseCounts.all})
        </button>

        <button
          onClick={() => setFilterTab('during')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'during'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Now ({phaseCounts.during})</span>
        </button>

        <button
          onClick={() => setFilterTab('before')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'before'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Upcoming ({phaseCounts.before})</span>
        </button>

        <button
          onClick={() => setFilterTab('after')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'after'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Concluded ({phaseCounts.after})</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm font-mono">
          Loading store sales events...
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center p-6">
          <Store className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-800 font-bold text-base">No store events found</p>
          <p className="text-xs text-slate-500 mb-4 max-w-sm">
            Create your first booth, bazaar, or temporary sales event under this branch.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Add Store Event
          </button>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-600 font-medium text-sm">No events in this category.</p>
          <button onClick={() => setFilterTab('all')} className="text-indigo-600 text-xs font-semibold mt-2 hover:underline">
            View all events
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">
              Sales Events Schedule ({filteredStores.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              System Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">
                    Event &amp; Venue
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">
                    Exact Date &amp; Time
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">
                    Event Status &amp; Timing
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">
                    Status Context
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-left">
                    Person In Charge
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStores.map((s) => {
                  const phase = getStorePhase(s);
                  const timingText = getTimingStatusText(s, phase);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        phase === 'during' ? 'bg-emerald-50/20' : 'bg-white'
                      }`}
                    >
                      {/* Event Name & Venue */}
                      <td className="px-4 py-3.5 text-sm border-b border-slate-100">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>{s.name}</span>
                          {phase === 'during' && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          )}
                        </div>
                        {s.venue ? (
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                            <MapPin size={13} className="text-indigo-500 flex-shrink-0" />
                            <span className="truncate max-w-xs">{s.venue}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic mt-0.5">No venue specified</div>
                        )}
                      </td>

                      {/* Exact Date & Time */}
                      <td className="px-4 py-3.5 text-xs text-slate-700 border-b border-slate-100">
                        <div className="space-y-1 font-mono">
                          <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                            <span className="text-[10px] uppercase font-sans text-slate-400 w-10">Start</span>
                            <span>{formatDateTime(s.start_date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span className="text-[10px] uppercase font-sans text-slate-400 w-10">End</span>
                            <span>{formatDateTime(s.end_date)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Event Status Badge & Dynamic Timing */}
                      <td className="px-4 py-3.5 text-sm border-b border-slate-100">
                        <div>
                          {phase === 'during' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              LIVE NOW
                            </span>
                          )}
                          {phase === 'before' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              UPCOMING
                            </span>
                          )}
                          {phase === 'after' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              CONCLUDED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-1 font-medium">
                          {timingText}
                        </div>
                      </td>

                      {/* Phase Context (Differentiated info for before/during/after) */}
                      <td className="px-4 py-3.5 text-xs border-b border-slate-100">
                        {phase === 'before' && (
                          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 text-amber-900 max-w-xs">
                            <div className="font-semibold flex items-center gap-1 text-[11px]">
                              <span>Scheduled Event</span>
                            </div>
                          </div>
                        )}

                        {phase === 'during' && (
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-emerald-900 max-w-xs">
                            <div className="font-bold flex items-center gap-1 text-[11px] text-emerald-800">
                              <span>Active Checkout</span>
                            </div>
                          </div>
                        )}

                        {phase === 'after' && (
                          <div className="p-2 rounded-lg bg-slate-100/80 border border-slate-200 text-slate-800 max-w-xs">
                            <div className="font-semibold flex items-center gap-1 text-[11px] text-slate-700">
                              <span>Event Concluded</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Person In Charge */}
                      <td className="px-4 py-3.5 text-xs text-slate-900 border-b border-slate-100">
                        <div className="font-medium text-slate-900">{s.person_in_charge || 'HQ Staff'}</div>
                        {s.contact_phone ? (
                          <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5 font-mono">
                            <Phone size={11} className="text-slate-400" />
                            <span>{s.contact_phone}</span>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px]">—</div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3.5 text-sm border-b border-slate-100 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* View Report */}
                          <button
                            onClick={() => navigate(`/stores/${s.id}/report`)}
                            className={`inline-flex items-center justify-center h-8 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                              phase === 'during'
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                                : 'bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50'
                            }`}
                            title={phase === 'during' ? 'View Live Sales Report' : 'View Store Report'}
                          >
                            <FileBarChart size={13} className="mr-1" />
                            <span>{phase === 'during' ? 'Live Report' : 'Report'}</span>
                          </button>

                          {/* Close Early button (for live events) */}
                          {phase === 'during' && (
                            <button
                              onClick={() => handleClose(s.id, s.name)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-amber-600 border border-slate-200 hover:bg-amber-50 transition-colors"
                              title="Close Event Early"
                            >
                              <CheckCircle size={14} />
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(s)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                            title="Edit Event & Timing Details"
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Delete Button (blocked if live) */}
                          <button
                            onClick={() => handleDelete(s)}
                            disabled={phase === 'during'}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                              phase === 'during'
                                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50'
                                : 'bg-white text-rose-600 border border-slate-200 hover:bg-rose-50'
                            }`}
                            title={
                              phase === 'during'
                                ? 'Cannot delete an active ongoing event'
                                : 'Delete Store Event Record'
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Store Event Modal (with Date + Time fields) ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Store Sales Event</h3>
                <p className="text-xs text-slate-500 mt-0.5">Specify venue, dates, and exact operational start/end times</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Store / Event Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mega Ramadan Bazaar 2026"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Venue / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Mid Valley Southkey, Ground Floor Booth 12"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={addForm.venue}
                  onChange={(e) => setAddForm({ ...addForm, venue: e.target.value })}
                />
              </div>

              {/* Start Date & Start Time */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Start Date &amp; Time *
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
                    <input
                      type="date"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={addForm.start_date}
                      onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Time</label>
                    <input
                      type="time"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={addForm.start_time}
                      onChange={(e) => setAddForm({ ...addForm, start_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* End Date & End Time */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> End Date &amp; Time *
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
                    <input
                      type="date"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={addForm.end_date}
                      onChange={(e) => setAddForm({ ...addForm, end_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Time</label>
                    <input
                      type="time"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={addForm.end_time}
                      onChange={(e) => setAddForm({ ...addForm, end_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Person in Charge & Contact Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Person-in-Charge</label>
                  <input
                    type="text"
                    placeholder="Event Lead / Manager"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={addForm.person_in_charge}
                    onChange={(e) => setAddForm({ ...addForm, person_in_charge: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+60 12-345 6789"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    value={addForm.contact_phone}
                    onChange={(e) => setAddForm({ ...addForm, contact_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows="2"
                  placeholder="Booth specifications, footfall expectation, special instructions..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save Store Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Store Event Modal (with Date + Time fields) ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Store Event Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modify date, operational hours, or event details</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Store / Event Name *</label>
                <input
                  type="text"
                  required
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Venue</label>
                <input
                  type="text"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.venue}
                  onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                />
              </div>

              {/* Start Date & Time */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Start Date &amp; Time *
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
                    <input
                      type="date"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Time</label>
                    <input
                      type="time"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={editForm.start_time}
                      onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* End Date & Time */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> End Date &amp; Time *
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
                    <input
                      type="date"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={editForm.end_date}
                      onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-slate-500">Time</label>
                    <input
                      type="time"
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={editForm.end_time}
                      onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Status Override */}
              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Status Setting</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="auto">Auto-Calculate (Follows Current Date &amp; Time)</option>
                  <option value="upcoming">Force UPCOMING</option>
                  <option value="active">Force ACTIVE (Happening Now)</option>
                  <option value="ended">Force ENDED (Concluded)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Person-in-Charge</label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editForm.person_in_charge}
                    onChange={(e) => setEditForm({ ...editForm, person_in_charge: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Contact Phone</label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    value={editForm.contact_phone}
                    onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  rows="2"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
