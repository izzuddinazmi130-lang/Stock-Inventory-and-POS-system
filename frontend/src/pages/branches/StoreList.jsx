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
import { Modal, FormSection, Field, Input, Select, Textarea, PrimaryButton, SecondaryButton } from '../../components/ui/Form';

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
      status: 'auto'
    });
    setMessage(null);
    setShowEditModal(true);
  };

  return (
    <Layout>
      {/* Breadcrumb Navigation */}
      <nav className="text-sm text-ink-muted mb-4 flex items-center gap-1.5">
        {isSuperAdmin ? (
          <>
            <Link to="/businesses" className="hover:text-ink transition-colors">Businesses</Link>
            <span>/</span>
            <Link to={`/businesses/${branch?.business_id}/branches`} className="hover:text-ink transition-colors">{branch?.business_name || 'Business'}</Link>
            <span>/</span>
            <Link to={`/branches/${id}`} className="hover:text-ink transition-colors">{branch?.name || 'Branch'}</Link>
            <span>/</span>
          </>
        ) : (
          <>
            <Link to="/dashboard" className="hover:text-ink transition-colors">{branch?.name || user?.branch_name || 'My Branch'}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-ink font-semibold">Store Events</span>
      </nav>

      {/* Notifications */}
      {message && (
        <div className={`mb-6 flex items-center justify-between transition-all ${
          message.type === 'success' 
            ? 'p-3.5 bg-success-soft border border-success-line rounded-xl text-success-fg text-sm' 
            : 'p-3.5 bg-danger-soft border border-danger-line rounded-xl text-danger-fg text-sm'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-success-fg flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-danger-fg flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-ink-muted hover:text-ink-secondary"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">
            Store Events &mdash; {branch ? branch.name : 'Branch'}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Track temporary physical sales events, dates, operating hours, and live checkout status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/branches/${id}/floor-report`}
            className="inline-flex items-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors shadow-sm"
          >
            <FileBarChart size={16} className="text-accent" />
            <span>Branch Floor Sales</span>
          </Link>
          <button
            onClick={() => { setMessage(null); setShowAddModal(true); }}
            className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-sm"
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
              ? 'bg-ink text-white shadow-xs'
              : 'bg-surface text-ink-secondary border border-line hover:bg-subtle'
          }`}
        >
          All Events ({phaseCounts.all})
        </button>

        <button
          onClick={() => setFilterTab('during')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'during'
              ? 'bg-success text-white shadow-xs'
              : 'bg-success-soft text-success-fg border border-success-line hover:bg-success-muted'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>Live Now ({phaseCounts.during})</span>
        </button>

        <button
          onClick={() => setFilterTab('before')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'before'
              ? 'bg-warning text-white shadow-xs'
              : 'bg-warning-soft text-warning-fg border border-warning-line hover:bg-warning-muted'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Upcoming ({phaseCounts.before})</span>
        </button>

        <button
          onClick={() => setFilterTab('after')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'after'
              ? 'bg-ink-hover text-white shadow-xs'
              : 'bg-sunken text-ink-secondary border border-line hover:bg-line'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Concluded ({phaseCounts.after})</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-16 text-ink-muted text-sm font-mono">
          Loading store sales events...
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-line rounded-xl flex flex-col items-center justify-center p-6">
          <Store className="w-12 h-12 text-ink-subtle mb-3" />
          <p className="text-ink font-bold text-base">No store events found</p>
          <p className="text-xs text-ink-muted mb-4 max-w-sm">
            Create your first booth, bazaar, or temporary sales event under this branch.
          </p>
          <button
            onClick={() => { setMessage(null); setShowAddModal(true); }}
            className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            <Plus size={16} /> Add Store Event
          </button>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="text-center py-12 bg-surface border border-line rounded-xl p-6">
          <p className="text-ink-secondary font-medium text-sm">No events in this category.</p>
          <button onClick={() => setFilterTab('all')} className="text-accent text-xs font-semibold mt-2 hover:underline">
            View all events
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
            <h3 className="font-semibold text-ink text-sm">
              Sales Events Schedule ({filteredStores.length})
            </h3>
            <span className="text-[11px] font-mono text-ink-muted">
              System Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-subtle">
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-left">
                    Event &amp; Venue
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-left">
                    Exact Date &amp; Time
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-left">
                    Event Status &amp; Timing
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-left">
                    Status Context
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-left">
                    Person In Charge
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted border-b border-line text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filteredStores.map((s) => {
                  const phase = getStorePhase(s);
                  const timingText = getTimingStatusText(s, phase);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-subtle transition-colors ${
                        phase === 'during' ? 'bg-success-soft/20' : 'bg-surface'
                      }`}
                    >
                      {/* Event Name & Venue */}
                      <td className="px-4 py-3.5 text-sm border-b border-line-soft">
                        <div className="font-bold text-ink text-sm flex items-center gap-2">
                          <span>{s.name}</span>
                          {phase === 'during' && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                          )}
                        </div>
                        {s.venue ? (
                          <div className="flex items-center gap-1.5 text-ink-muted text-xs mt-0.5">
                            <MapPin size={13} className="text-accent flex-shrink-0" />
                            <span className="truncate max-w-xs">{s.venue}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-ink-muted italic mt-0.5">No venue specified</div>
                        )}
                      </td>

                      {/* Exact Date & Time */}
                      <td className="px-4 py-3.5 text-xs text-ink-secondary border-b border-line-soft">
                        <div className="space-y-1 font-mono">
                          <div className="flex items-center gap-1.5 text-ink font-semibold">
                            <span className="text-[10px] uppercase font-sans text-ink-muted w-10">Start</span>
                            <span>{formatDateTime(s.start_date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-ink-secondary">
                            <span className="text-[10px] uppercase font-sans text-ink-muted w-10">End</span>
                            <span>{formatDateTime(s.end_date)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Event Status Badge & Dynamic Timing */}
                      <td className="px-4 py-3.5 text-sm border-b border-line-soft">
                        <div>
                          {phase === 'during' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-success-soft text-success-fg border border-success-line shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                              LIVE NOW
                            </span>
                          )}
                          {phase === 'before' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg border border-warning-line">
                              <Clock className="w-3 h-3 text-warning-fg" />
                              UPCOMING
                            </span>
                          )}
                          {phase === 'after' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-sunken text-ink-secondary border border-line">
                              <CheckCircle2 className="w-3 h-3 text-ink-muted" />
                              CONCLUDED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-ink-muted mt-1 font-medium">
                          {timingText}
                        </div>
                      </td>

                      {/* Phase Context (Differentiated info for before/during/after) */}
                      <td className="px-4 py-3.5 text-xs border-b border-line-soft">
                        {phase === 'before' && (
                          <div className="p-2 rounded-lg bg-warning-soft/70 border border-warning-muted text-warning-fg max-w-xs">
                            <div className="font-semibold flex items-center gap-1 text-[11px]">
                              <span>Scheduled Event</span>
                            </div>
                          </div>
                        )}

                        {phase === 'during' && (
                          <div className="p-2 rounded-lg bg-success-soft/70 border border-success-muted text-success-fg max-w-xs">
                            <div className="font-bold flex items-center gap-1 text-[11px] text-success-fg">
                              <span>Active Checkout</span>
                            </div>
                          </div>
                        )}

                        {phase === 'after' && (
                          <div className="p-2 rounded-lg bg-sunken/80 border border-line text-ink max-w-xs">
                            <div className="font-semibold flex items-center gap-1 text-[11px] text-ink-secondary">
                              <span>Event Concluded</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Person In Charge */}
                      <td className="px-4 py-3.5 text-xs text-ink border-b border-line-soft">
                        <div className="font-medium text-ink">{s.person_in_charge || 'HQ Staff'}</div>
                        {s.contact_phone ? (
                          <div className="text-ink-muted text-[11px] flex items-center gap-1 mt-0.5 font-mono">
                            <Phone size={11} className="text-ink-muted" />
                            <span>{s.contact_phone}</span>
                          </div>
                        ) : (
                          <div className="text-ink-muted text-[11px]">—</div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3.5 text-sm border-b border-line-soft text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* View Report */}
                          <button
                            onClick={() => navigate(`/stores/${s.id}/report`)}
                            className={`inline-flex items-center justify-center h-8 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                              phase === 'during'
                                ? 'bg-accent text-white hover:bg-accent-hover shadow-xs'
                                : 'bg-surface text-accent border border-line hover:bg-accent-soft'
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
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-warning-fg border border-line hover:bg-warning-soft transition-colors"
                              title="Close Event Early"
                            >
                              <CheckCircle size={14} />
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(s)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-ink-secondary border border-line hover:bg-subtle transition-colors"
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
                                ? 'bg-sunken text-ink-subtle border border-line cursor-not-allowed opacity-50'
                                : 'bg-surface text-danger-fg border border-line hover:bg-danger-soft'
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

      {/* ── Add Store Event Modal ── */}
      {showAddModal && (
        <Modal
          icon={Store}
          title="Add a store event"
          description={`A pop-up, bazaar or booth run by ${branch?.name || 'this branch'}. Sales made during it are reported separately.`}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton>Create event</PrimaryButton>
          </>}
        >
          <StoreFields form={addForm} setForm={setAddForm} />
        </Modal>
      )}

      {/* ── Edit Store Event Modal ── */}
      {showEditModal && (
        <Modal
          icon={Edit3}
          title={`Edit ${editForm.name || 'store event'}`}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton>Save changes</PrimaryButton>
          </>}
        >
          <StoreFields form={editForm} setForm={setEditForm} showStatus />
        </Modal>
      )}
    </Layout>
  );
}

// "18 Sep, 9:00 AM" for the schedule summary
function formatScheduleEnd(date, time) {
  const d = new Date(`${date}T${time || '00:00'}`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

// Fields shared by the Add and Edit store-event forms
function StoreFields({ form, setForm, showStatus = false }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const start = form.start_date ? new Date(`${form.start_date}T${form.start_time || '00:00'}`) : null;
  const end = form.end_date ? new Date(`${form.end_date}T${form.end_time || '00:00'}`) : null;
  const endBeforeStart = start && end && end < start;
  const days = start && end && !endBeforeStart
    ? Math.round((new Date(form.end_date) - new Date(form.start_date)) / 86400000) + 1
    : null;

  return (
    <>
      <FormSection title="Event">
        <Field label="Event name" required>
          <Input required placeholder="e.g. Ramadan Bazaar 2026" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Venue" optional>
          <Input placeholder="e.g. Mid Valley Southkey, Ground Floor, Booth 12" value={form.venue} onChange={set('venue')} />
        </Field>
      </FormSection>

      <FormSection title="Schedule" description="The event goes live and ends automatically at these times.">
        <div className="grid grid-cols-[4rem_1fr_7.5rem] gap-2 items-center">
          <span className="text-sm font-medium text-ink-secondary">Starts<span className="text-danger-fg">*</span></span>
          <Input type="date" required value={form.start_date}
            onChange={e => setForm({ ...form, start_date: e.target.value, end_date: form.end_date || e.target.value })} />
          <Input type="time" required value={form.start_time} onChange={set('start_time')} />

          <span className="text-sm font-medium text-ink-secondary">Ends<span className="text-danger-fg">*</span></span>
          <Input type="date" required min={form.start_date || undefined} value={form.end_date} onChange={set('end_date')} error={endBeforeStart} />
          <Input type="time" required value={form.end_time} onChange={set('end_time')} error={endBeforeStart} />
        </div>
        {endBeforeStart ? (
          <p className="text-xs text-danger-fg">The end is before the start. Check the dates and times.</p>
        ) : days ? (
          <p className="text-xs text-ink-muted">
            Runs {days === 1 ? '1 day' : `${days} days`}: {formatScheduleEnd(form.start_date, form.start_time)} → {formatScheduleEnd(form.end_date, form.end_time)}
          </p>
        ) : null}

        {showStatus && (
          <Field label="Status" hint="Leave on Automatic unless you need to open or close the event early.">
            <Select value={form.status} onChange={set('status')}>
              <option value="auto">Automatic (follows the schedule above)</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Live now</option>
              <option value="ended">Ended</option>
            </Select>
          </Field>
        )}
      </FormSection>

      <FormSection title="Person in charge">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" optional>
            <Input placeholder="Event lead" value={form.person_in_charge} onChange={set('person_in_charge')} />
          </Field>
          <Field label="Phone" optional>
            <Input type="tel" placeholder="+60 12-345 6789" value={form.contact_phone} onChange={set('contact_phone')} />
          </Field>
        </div>
        <Field label="Notes" optional>
          <Textarea rows={2} placeholder="Booth size, expected crowd, special instructions…" value={form.notes} onChange={set('notes')} />
        </Field>
      </FormSection>
    </>
  );
}
