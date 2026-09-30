import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { Modal, FormSection, Field, Input, Select, ChoiceCards, PrimaryButton, SecondaryButton } from '../../components/ui/Form';
import { 
  Users, Plus, ShieldCheck, UserX, Trash2, CheckCircle, 
  AlertCircle, X, Clock, Edit3, UserCheck, Check, Search, Filter, Building2, Store,
  Eye, CheckCircle2, Lock
} from 'lucide-react';

const relativeTime = (dt) => {
  if (!dt) return 'Never';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function UserManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'pending' ? 'pending' : 'users';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({ total: 0, superadmins: 0, admins: 0, byBusiness: [] });
  const STATUS_TABS = ['all', 'active', 'suspended', 'pending', 'declined'];
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Scope & Search Filters
  const [filterBusiness, setFilterBusiness] = useState(searchParams.get('business_id') || '');
  const [filterBranch, setFilterBranch] = useState(searchParams.get('branch_id') || '');
  const [searchQuery, setSearchQuery] = useState('');

  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allBranches, setAllBranches] = useState([]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'admin',
    business_id: '',
    branch_id: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    role: 'admin',
    business_id: '',
    branch_id: ''
  });

  // User Branch Assignment Inspection Modal
  const [inspectUser, setInspectUser] = useState(null);

  // Sync state when URL params change (e.g. from deep links)
  useEffect(() => {
    const bId = searchParams.get('business_id');
    const brId = searchParams.get('branch_id');
    if (bId !== null) setFilterBusiness(bId);
    if (brId !== null) setFilterBranch(brId);
  }, [searchParams]);

  // Load businesses & all branches on mount
  useEffect(() => {
    api.get('/businesses').then(res => {
      if (res.data.success) setBusinesses(res.data.businesses || res.data.data || []);
    }).catch(() => {});

    api.get('/branches').then(res => {
      if (res.data.success) setAllBranches(res.data.branches || res.data.data || []);
    }).catch(() => {});
  }, []);

  // Filtered branches for dropdown based on selected business
  const branchesForFilter = useMemo(() => {
    if (!filterBusiness) return allBranches;
    return allBranches.filter(b => String(b.business_id) === String(filterBusiness));
  }, [allBranches, filterBusiness]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (filterBusiness) params.business_id = filterBusiness;
      if (filterBranch) params.branch_id = filterBranch;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [resUsers, resPending, resStats] = await Promise.all([
        api.get('/users', { params }),
        api.get('/users/pending'),
        api.get('/users/stats')
      ]);

      if (resUsers.data.success) {
        setUsers(resUsers.data.users || []);
        setStats(resUsers.data.stats || { total: 0, active: 0, pending: 0 });
      }
      if (resPending.data.success) {
        setPendingUsers(resPending.data.pendingUsers || []);
      }
      if (resStats?.data?.success) {
        setUserStats(resStats.data.stats);
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [statusFilter, filterBusiness, filterBranch, searchQuery]);

  const clearBranchFilter = () => {
    setFilterBusiness('');
    setFilterBranch('');
    setSearchQuery('');
    setSearchParams(activeTab === 'pending' ? { tab: 'pending' } : {});
  };

  const openAddModal = () => {
    setAddForm({
      full_name: '',
      email: '',
      password: '',
      role: 'admin',
      business_id: filterBusiness || '',
      branch_id: filterBranch || ''
    });
    setMessage(null);
    setShowAddModal(true);
  };

  // Sync tab change to search params
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const newParams = {};
    if (tab === 'pending') newParams.tab = 'pending';
    if (filterBusiness) newParams.business_id = filterBusiness;
    if (filterBranch) newParams.branch_id = filterBranch;
    setSearchParams(newParams);
  };

  // For Add Form Branches
  useEffect(() => {
    if (addForm.business_id) {
      api.get(`/businesses/${addForm.business_id}/branches`)
        .then(res => { if (res.data.success) setBranches(res.data.branches || res.data.data || []); })
        .catch(() => {});
    } else {
      setBranches([]);
    }
  }, [addForm.business_id]);

  // For Edit Form Branches
  const [editBranches, setEditBranches] = useState([]);
  useEffect(() => {
    if (editForm.business_id) {
      api.get(`/businesses/${editForm.business_id}/branches`)
        .then(res => { if (res.data.success) setEditBranches(res.data.branches || res.data.data || []); })
        .catch(() => {});
    } else {
      setEditBranches([]);
    }
  }, [editForm.business_id]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', {
        ...addForm,
        business_id: addForm.role === 'admin' ? parseInt(addForm.business_id) : null,
        branch_id: addForm.role === 'admin' ? parseInt(addForm.branch_id) : null
      });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowAddModal(false);
        setAddForm({ full_name: '', email: '', password: '', role: 'admin', business_id: '', branch_id: '' });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/users/${editForm.id}`, {
        role: editForm.role,
        business_id: editForm.role === 'admin' ? parseInt(editForm.business_id) : null,
        branch_id: editForm.role === 'admin' ? parseInt(editForm.branch_id) : null
      });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account '${name}'?`)) return;
    try {
      const res = await api.delete(`/users/${id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleSuspend = async (id) => {
    if (!window.confirm('Suspend this user?')) return;
    await api.patch(`/users/${id}/suspend`);
    fetchUsers();
  };
  const handleActivate = async (id) => {
    await api.patch(`/users/${id}/activate`);
    fetchUsers();
  };

  const handleApprove = async (id, name) => {
    if (!window.confirm(`Approve user registration for '${name}'? They will be granted immediate access.`)) return;
    try {
      const res = await api.post(`/users/${id}/approve`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleReject = async (id, name) => {
    if (!window.confirm(`Decline registration request for '${name}'?`)) return;
    try {
      const res = await api.post(`/users/${id}/reject`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const openEditModal = (u) => {
    setEditForm({
      id: u.id,
      full_name: u.full_name || '',
      email: u.email || '',
      role: u.role,
      business_id: u.business_id || '',
      branch_id: u.branch_id || ''
    });
    setMessage(null);
    setShowEditModal(true);
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">User Management</h1>
          <p className="text-sm text-ink-muted mt-0.5">Administer system users, pending registration approvals, and branch roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAddModal} className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add New User
          </button>
        </div>
      </div>

      {/* Alerts */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
          message.type === 'success' ? 'bg-success-soft border-success-line text-success-fg' : 'bg-danger-soft border-danger-line text-danger-fg'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="hover:opacity-75 transition-opacity"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Users" value={userStats.total} meta="Active accounts" icon={Users} color="indigo" />
        <KpiCard title="Superadmins" value={userStats.superadmins} meta="Full system access" icon={ShieldCheck} color="purple" />
        <KpiCard
          title="Admins"
          value={userStats.admins}
          meta={userStats.byBusiness.map(b => `${b.name} ${b.count}`).join(' · ') || 'No admins yet'}
          icon={UserCheck}
          color="blue"
        />
      </div>

      {/* Active Scope Filter Banner */}
      {(filterBusiness || filterBranch || searchQuery) && (
        <div className="mb-4 p-3 bg-accent-soft/70 border border-accent-line rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs text-accent-fg">
            <Filter size={15} className="text-accent flex-shrink-0" />
            <span>
              Filtered to Branch Personnel: 
              <strong className="text-accent-fg font-semibold ml-1">
                {allBranches.find(b => String(b.id) === String(filterBranch))?.name 
                  ? `${allBranches.find(b => String(b.id) === String(filterBranch))?.name}` 
                  : ''}
                {businesses.find(b => String(b.id) === String(filterBusiness))?.name 
                  ? ` (${businesses.find(b => String(b.id) === String(filterBusiness))?.name})` 
                  : ''}
                {!filterBranch && filterBusiness 
                  ? `All branches in ${businesses.find(b => String(b.id) === String(filterBusiness))?.name}` 
                  : ''}
              </strong>
            </span>
            <span className="text-[11px] text-accent-fg font-semibold bg-surface px-2 py-0.5 rounded-full border border-accent-line">
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </span>
          </div>
          <button
            onClick={clearBranchFilter}
            className="text-xs font-semibold text-accent hover:text-accent-fg underline flex items-center gap-1 cursor-pointer"
          >
            <X size={13} />
            <span>Clear Branch Filter (Show All)</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Status Tabs */}
        <div className="flex bg-sunken p-1 rounded-lg gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === tab ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Business, Branch and Search filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Business Selector */}
          <select
            value={filterBusiness}
            onChange={e => {
              setFilterBusiness(e.target.value);
              setFilterBranch('');
              const params = {};
              if (activeTab === 'pending') params.tab = 'pending';
              if (e.target.value) params.business_id = e.target.value;
              setSearchParams(params);
            }}
            className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All Businesses</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Branch Selector */}
          <select
            value={filterBranch}
            onChange={e => {
              setFilterBranch(e.target.value);
              const params = {};
              if (activeTab === 'pending') params.tab = 'pending';
              if (filterBusiness) params.business_id = filterBusiness;
              if (e.target.value) params.branch_id = e.target.value;
              setSearchParams(params);
            }}
            className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All Branches</option>
            {branchesForFilter.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Branch'})</option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search personnel..."
              className="h-9 w-44 rounded-lg border border-line bg-surface pl-8 pr-2.5 text-xs text-ink-secondary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {(filterBusiness || filterBranch || searchQuery) && (
            <button
              onClick={clearBranchFilter}
              className="h-9 px-2.5 inline-flex items-center gap-1 text-xs font-semibold text-danger-fg hover:bg-danger-soft rounded-lg border border-danger-line transition-colors cursor-pointer"
              title="Reset filters"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content 1: Active Users Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-ink text-sm">System Accounts ({users.length})</h3>
          </div>
          {filterBranch && (
            <span className="text-xs text-accent bg-accent-soft px-2.5 py-0.5 rounded-full font-medium border border-accent-muted">
              Filtered: {allBranches.find(b => String(b.id) === String(filterBranch))?.name}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">User Details</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Role</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Business</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Assigned Branch of Business</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Last Login</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left whitespace-nowrap">Created At</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-ink-muted text-sm border-b border-line-soft">
                    No system users found matching the selected filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-subtle transition-colors">
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <button
                        onClick={() => setInspectUser(u)}
                        className="text-left group cursor-pointer"
                        title="Click to view full branch assignment profile"
                      >
                        <div className="font-bold text-ink group-hover:text-accent transition-colors flex items-center gap-1.5">
                          <span>{u.full_name}</span>
                          <Eye size={12} className="opacity-0 group-hover:opacity-100 text-accent transition-opacity" />
                        </div>
                        <div className="font-mono text-xs text-accent">{u.email}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        u.role === 'super_admin' ? 'bg-violet-soft text-violet-fg' : 'bg-warning-soft text-warning-fg'
                      }`}>
                        {u.role === 'super_admin' ? 'Super Admin' : 'Branch Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft text-xs">
                      {u.role === 'super_admin' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-violet-fg">All Businesses</span>
                          <div className="flex flex-wrap gap-1">
                            {businesses.map(b => (
                              <span key={b.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-sunken text-ink-secondary border border-line">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.id === 1 ? '#B4502E' : '#2563EB' }} />
                                {b.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-subtle text-ink border border-line">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: u.business_id === 1 ? '#B4502E' : '#2563EB' }} />
                          {u.business_name || 'Unassigned'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      {u.role === 'super_admin' ? (
                        <div className="flex flex-col gap-1.5 max-w-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-violet-muted text-violet-fg border border-violet-line">
                              <ShieldCheck size={12} className="text-violet-fg" />
                              All Branches Scope (HQ)
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {allBranches.map(b => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-sunken text-ink-secondary border border-line"
                                title={`${b.business_name} • ${b.name}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.business_id === 1 ? '#B4502E' : '#2563EB' }} />
                                <span>{b.name}</span>
                                {b.branch_code && <span className="text-ink-muted font-mono">({b.branch_code})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-accent flex-shrink-0" />
                            <span className="font-bold text-ink text-xs">
                              {u.branch_name || 'Unassigned Branch'}
                            </span>
                            {u.branch_code && (
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-lg bg-sunken text-ink-secondary border border-line">
                                {u.branch_code}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                      <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                          u.status === 'active' ? 'bg-success-soft text-success-fg' :
                          u.status === 'pending' ? 'bg-warning-soft text-warning-fg' :
                          u.status === 'suspended' ? 'bg-warning-soft text-warning-fg' :
                          u.status === 'declined' ? 'bg-danger-soft text-danger-fg' : 'bg-sunken text-ink-secondary'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted border-b border-line-soft text-xs">
                        {relativeTime(u.last_login)}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted border-b border-line-soft font-mono text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink border-b border-line-soft text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Branch Details Button */}
                          <button
                            onClick={() => setInspectUser(u)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-ink-secondary border border-line hover:bg-subtle hover:text-accent transition-colors"
                            title="View Branch Assignment Details"
                          >
                            <Eye size={14} />
                          </button>

                          {u.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(u.id, u.full_name)} className="inline-flex items-center gap-1 h-8 px-2 bg-success-soft text-success-fg text-xs font-medium rounded-lg hover:bg-success-muted transition-colors" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleReject(u.id, u.full_name)} className="inline-flex items-center gap-1 h-8 px-2 bg-danger-soft text-danger-fg text-xs font-medium rounded-lg hover:bg-danger-muted transition-colors" title="Decline"><X className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          {u.status === 'active' && (
                            <button onClick={() => handleSuspend(u.id)} className="inline-flex items-center gap-1 h-8 px-3 text-warning-fg text-xs font-medium rounded-lg bg-warning-soft hover:bg-warning-muted border border-warning-line transition-colors">
                              Suspend
                            </button>
                          )}
                          {u.status === 'suspended' && (
                            <button onClick={() => handleActivate(u.id)} className="inline-flex items-center gap-1 h-8 px-3 text-success-fg text-xs font-medium rounded-lg bg-success-soft hover:bg-success-muted border border-success-line transition-colors">
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-ink-secondary border border-line hover:bg-subtle hover:text-ink transition-colors"
                            title="Edit User Assignment"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.full_name)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-danger-fg border border-line hover:bg-danger-soft hover:text-danger-fg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Add Modal */}
      {showAddModal && (
        <Modal
          icon={Users}
          title="Add a user"
          description="The account can sign in straight away with the password you set."
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton>Create user</PrimaryButton>
          </>}
        >
          <FormSection title="Account">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <Input required placeholder="e.g. Sarah Jenkins" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} />
              </Field>
              <Field label="Email" required hint="Used to sign in.">
                <Input type="email" required placeholder="name@company.com" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
              </Field>
            </div>
            <Field label="Password" required hint="At least 6 characters. Share it with the user privately.">
              <Input type="password" required minLength={6} autoComplete="new-password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} />
            </Field>
          </FormSection>
          <UserAccessFields form={addForm} setForm={setAddForm} businesses={businesses} branches={branches} />
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <Modal
          icon={Edit3}
          title="Change user access"
          description={editForm.full_name ? `${editForm.full_name}${editForm.email ? ` · ${editForm.email}` : ''}` : undefined}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton>Save changes</PrimaryButton>
          </>}
        >
          <UserAccessFields form={editForm} setForm={setEditForm} businesses={businesses} branches={editBranches} />
        </Modal>
      )}

      {/* ── Inspect User Branch Access Modal ── */}
      {inspectUser && (
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base ${
                  inspectUser.role === 'super_admin' ? 'bg-violet' : 'bg-accent'
                }`}>
                  {inspectUser.full_name ? inspectUser.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-ink text-base flex items-center gap-2">
                    <span>{inspectUser.full_name}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      inspectUser.role === 'super_admin' ? 'bg-violet-soft text-violet-fg' : 'bg-accent-soft text-accent-fg'
                    }`}>
                      {inspectUser.role === 'super_admin' ? 'Super Admin' : 'Branch Admin'}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-muted font-mono mt-0.5">{inspectUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setInspectUser(null)} 
                className="text-ink-muted hover:text-ink-secondary p-1 rounded-lg hover:bg-sunken transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Status and Login Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-subtle border border-line-soft rounded-lg">
                  <span className="block text-[10px] font-semibold uppercase text-ink-muted">Account Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold mt-1 uppercase ${
                    inspectUser.status === 'active' ? 'text-success-fg' :
                    inspectUser.status === 'suspended' ? 'text-warning-fg' : 'text-ink-secondary'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${inspectUser.status === 'active' ? 'bg-success' : 'bg-warning'}`} />
                    {inspectUser.status}
                  </span>
                </div>

                <div className="p-3 bg-subtle border border-line-soft rounded-lg">
                  <span className="block text-[10px] font-semibold uppercase text-ink-muted">Last Activity</span>
                  <span className="block font-bold text-ink mt-1">
                    {relativeTime(inspectUser.last_login)}
                  </span>
                </div>
              </div>

              {/* Branch Assignment Scope */}
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Building2 size={14} className="text-accent" />
                  Assigned Branch Scope &amp; Locations
                </h4>

                {inspectUser.role === 'super_admin' ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-violet-soft border border-violet-line rounded-xl text-xs text-violet-fg leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 text-violet-fg mb-1">
                        <ShieldCheck size={15} className="text-violet-fg" />
                        Universal Cross-Branch Authority (HQ Scope)
                      </div>
                      This user has global super-administrator privileges with unrestricted administrative access to manage all businesses and branches:
                    </div>

                    <div className="space-y-1.5">
                      {allBranches.map((br) => (
                        <div key={br.id} className="p-2.5 bg-subtle border border-line rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-success-fg flex-shrink-0" />
                            <div>
                              <span className="font-bold text-ink">{br.name}</span>
                              <span className="text-ink-muted text-[11px] ml-1.5">({br.business_name || 'Branch'})</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-violet-fg bg-violet-muted/70 px-2 py-0.5 rounded-lg">
                            Full Admin Control
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Primary Assigned Branch */}
                    <div className="p-3.5 bg-success-soft border border-success-line rounded-xl text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-success-fg flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-success-fg" /> Primary Branch Assigned
                        </span>
                        {inspectUser.branch_code && (
                          <span className="font-mono font-bold text-[10px] bg-success-muted text-success-fg px-1.5 py-0.5 rounded-lg">
                            {inspectUser.branch_code}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-success-fg mb-0.5">
                        {inspectUser.branch_name || 'Unassigned Branch'}
                      </div>
                      <div className="text-success-fg text-[11px]">
                        Business: <strong className="text-success-fg">{inspectUser.business_name || 'Unassigned'}</strong>
                      </div>
                      <div className="mt-2 pt-2 border-t border-success-line/60 text-[11px] text-success-fg leading-snug">
                        ✓ Authorized to manage stock adjustments, stock out, QR code scans, and live sales stores for this branch.
                      </div>
                    </div>

                    {/* Other Branches (Restricted) */}
                    <div>
                      <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                        Other Branches in System (Access Restricted)
                      </div>
                      <div className="space-y-1.5">
                        {allBranches
                          .filter(br => String(br.id) !== String(inspectUser.branch_id))
                          .map((br) => (
                            <div key={br.id} className="p-2.5 bg-subtle border border-line rounded-lg flex items-center justify-between text-xs opacity-75">
                              <div className="flex items-center gap-2">
                                <Lock size={13} className="text-ink-muted flex-shrink-0" />
                                <span className="font-medium text-ink-secondary">{br.name}</span>
                                <span className="text-ink-muted text-[11px]">({br.business_name})</span>
                              </div>
                              <span className="text-[10px] font-medium text-ink-muted bg-sunken px-2 py-0.5 rounded-lg">
                                No Access
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-line-soft mt-2">
              <button
                type="button"
                onClick={() => {
                  const targetUser = inspectUser;
                  setInspectUser(null);
                  openEditModal(targetUser);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-fg hover:underline cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Edit User Branch Assignment</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectUser(null)}
                className="inline-flex items-center gap-2 h-9 px-4 bg-ink text-white text-xs font-medium rounded-lg hover:bg-ink-hover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// Role + business/branch assignment, shared by the Add and Edit user forms
function UserAccessFields({ form, setForm, businesses, branches }) {
  return (
    <FormSection title="Access" description="Decide what this person can see and do.">
      <ChoiceCards
        value={form.role}
        onChange={role => setForm({ ...form, role })}
        options={[
          { value: 'admin', icon: Store, label: 'Branch Admin', description: 'Runs one branch: products, POS, stores, damage and reports for that branch.' },
          { value: 'super_admin', icon: ShieldCheck, label: 'Super Admin', description: 'HQ access to every business, branch, user and setting.' }
        ]}
      />
      {form.role === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business" required>
            <Select required value={form.business_id} onChange={e => setForm({ ...form, business_id: e.target.value, branch_id: '' })}>
              <option value="">Choose a business…</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Branch" required hint={form.business_id && branches.length === 0 ? 'This business has no branches yet.' : undefined}>
            <Select required value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })} disabled={!form.business_id || branches.length === 0}>
              <option value="">{form.business_id ? 'Choose a branch…' : 'Choose a business first'}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </FormSection>
  );
}
