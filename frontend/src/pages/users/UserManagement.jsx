import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
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
      role: u.role,
      business_id: u.business_id || '',
      branch_id: u.branch_id || ''
    });
    setShowEditModal(true);
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Administer system users, pending registration approvals, and branch roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAddModal} className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add New User
          </button>
        </div>
      </div>

      {/* Alerts */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
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
        <div className="mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs text-indigo-900">
            <Filter size={15} className="text-indigo-600 flex-shrink-0" />
            <span>
              Filtered to Branch Personnel: 
              <strong className="text-indigo-950 font-semibold ml-1">
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
            <span className="text-[11px] text-indigo-700 font-semibold bg-white px-2 py-0.5 rounded-full border border-indigo-200">
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </span>
          </div>
          <button
            onClick={clearBranchFilter}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
          >
            <X size={13} />
            <span>Clear Branch Filter (Show All)</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Status Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                statusFilter === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Branches</option>
            {branchesForFilter.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Branch'})</option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search personnel..."
              className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {(filterBusiness || filterBranch || searchQuery) && (
            <button
              onClick={clearBranchFilter}
              className="h-9 px-2.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              title="Reset filters"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content 1: Active Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-900 text-sm">System Accounts ({users.length})</h3>
          </div>
          {filterBranch && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full font-medium border border-indigo-100">
              Filtered: {allBranches.find(b => String(b.id) === String(filterBranch))?.name}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">User Details</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Role</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Business</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Assigned Branch of Business</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Last Login</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Created At</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500 text-sm border-b border-slate-100">
                    No system users found matching the selected filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <button
                        onClick={() => setInspectUser(u)}
                        className="text-left group cursor-pointer"
                        title="Click to view full branch assignment profile"
                      >
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                          <span>{u.full_name}</span>
                          <Eye size={12} className="opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                        </div>
                        <div className="font-mono text-xs text-indigo-600">{u.email}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        u.role === 'super_admin' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {u.role === 'super_admin' ? 'Super Admin' : 'Branch Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 text-xs">
                      {u.role === 'super_admin' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-violet-700">All Businesses</span>
                          <div className="flex flex-wrap gap-1">
                            {businesses.map(b => (
                              <span key={b.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.id === 1 ? '#B4502E' : '#2563EB' }} />
                                {b.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-50 text-slate-800 border border-slate-200">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: u.business_id === 1 ? '#B4502E' : '#2563EB' }} />
                          {u.business_name || 'Unassigned'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                      {u.role === 'super_admin' ? (
                        <div className="flex flex-col gap-1.5 max-w-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                              <ShieldCheck size={12} className="text-violet-700" />
                              All Branches Scope (HQ)
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {allBranches.map(b => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                title={`${b.business_name} • ${b.name}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.business_id === 1 ? '#B4502E' : '#2563EB' }} />
                                <span>{b.name}</span>
                                {b.branch_code && <span className="text-slate-400 font-mono">({b.branch_code})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-indigo-600 flex-shrink-0" />
                            <span className="font-bold text-slate-900 text-xs">
                              {u.branch_name || 'Unassigned Branch'}
                            </span>
                            {u.branch_code && (
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {u.branch_code}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                      <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                          u.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                          u.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          u.status === 'suspended' ? 'bg-orange-50 text-orange-700' :
                          u.status === 'declined' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 border-b border-slate-100 text-xs">
                        {relativeTime(u.last_login)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 border-b border-slate-100 font-mono text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Branch Details Button */}
                          <button
                            onClick={() => setInspectUser(u)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                            title="View Branch Assignment Details"
                          >
                            <Eye size={14} />
                          </button>

                          {u.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(u.id, u.full_name)} className="inline-flex items-center gap-1 h-8 px-2 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleReject(u.id, u.full_name)} className="inline-flex items-center gap-1 h-8 px-2 bg-rose-50 text-rose-700 text-xs font-medium rounded-lg hover:bg-rose-100 transition-colors" title="Decline"><X className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          {u.status === 'active' && (
                            <button onClick={() => handleSuspend(u.id)} className="inline-flex items-center gap-1 h-8 px-3 text-amber-600 text-xs font-medium rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors">
                              Suspend
                            </button>
                          )}
                          {u.status === 'suspended' && (
                            <button onClick={() => handleActivate(u.id)} className="inline-flex items-center gap-1 h-8 px-3 text-emerald-700 text-xs font-medium rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors">
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            title="Edit User Assignment"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.full_name)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-rose-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Provision New User Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input type="text" required placeholder="e.g. Sarah Jenkins" value={addForm.full_name} onChange={e => setAddForm({...addForm, full_name: e.target.value})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                  <input type="email" required placeholder="user@domain.com" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <input type="password" required minLength={6} placeholder="Minimum 6 characters" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Role *</label>
                <select value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Branch Admin</option>
                </select>
              </div>

              {addForm.role === 'admin' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business *</label>
                    <select required value={addForm.business_id} onChange={e => setAddForm({...addForm, business_id: e.target.value, branch_id: ''})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">— Select a business —</option>
                      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
                    <select required value={addForm.branch_id} onChange={e => setAddForm({...addForm, branch_id: e.target.value})} disabled={!addForm.business_id || branches.length === 0} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-slate-900">
                      <option value="">{addForm.business_id ? '— Select a branch —' : '— Select a business first —'}</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Edit User Assignment</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Role *</label>
                <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Branch Admin</option>
                </select>
              </div>

              {editForm.role === 'admin' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business *</label>
                    <select required value={editForm.business_id} onChange={e => setEditForm({...editForm, business_id: e.target.value, branch_id: ''})} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">— Select a business —</option>
                      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
                    <select required value={editForm.branch_id} onChange={e => setEditForm({...editForm, branch_id: e.target.value})} disabled={!editForm.business_id || editBranches.length === 0} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                      <option value="">{editForm.business_id ? '— Select a branch —' : '— Select a business first —'}</option>
                      {editBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="inline-flex items-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inspect User Branch Access Modal ── */}
      {inspectUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base ${
                  inspectUser.role === 'super_admin' ? 'bg-violet-600' : 'bg-indigo-600'
                }`}>
                  {inspectUser.full_name ? inspectUser.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>{inspectUser.full_name}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      inspectUser.role === 'super_admin' ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {inspectUser.role === 'super_admin' ? 'Super Admin' : 'Branch Admin'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{inspectUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setInspectUser(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Status and Login Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">Account Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold mt-1 uppercase ${
                    inspectUser.status === 'active' ? 'text-emerald-700' :
                    inspectUser.status === 'suspended' ? 'text-amber-700' : 'text-slate-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${inspectUser.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {inspectUser.status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">Last Activity</span>
                  <span className="block font-bold text-slate-900 mt-1">
                    {relativeTime(inspectUser.last_login)}
                  </span>
                </div>
              </div>

              {/* Branch Assignment Scope */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-600" />
                  Assigned Branch Scope &amp; Locations
                </h4>

                {inspectUser.role === 'super_admin' ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-900 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 text-violet-950 mb-1">
                        <ShieldCheck size={15} className="text-violet-700" />
                        Universal Cross-Branch Authority (HQ Scope)
                      </div>
                      This user has global super-administrator privileges with unrestricted administrative access to manage all businesses and branches:
                    </div>

                    <div className="space-y-1.5">
                      {allBranches.map((br) => (
                        <div key={br.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                            <div>
                              <span className="font-bold text-slate-800">{br.name}</span>
                              <span className="text-slate-400 text-[11px] ml-1.5">({br.business_name || 'Branch'})</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded">
                            Full Admin Control
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Primary Assigned Branch */}
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-600" /> Primary Branch Assigned
                        </span>
                        {inspectUser.branch_code && (
                          <span className="font-mono font-bold text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            {inspectUser.branch_code}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-emerald-950 mb-0.5">
                        {inspectUser.branch_name || 'Unassigned Branch'}
                      </div>
                      <div className="text-emerald-800 text-[11px]">
                        Business: <strong className="text-emerald-950">{inspectUser.business_name || 'Unassigned'}</strong>
                      </div>
                      <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-900 leading-snug">
                        ✓ Authorized to manage stock adjustments, stock out, QR code scans, and live sales stores for this branch.
                      </div>
                    </div>

                    {/* Other Branches (Restricted) */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Other Branches in System (Access Restricted)
                      </div>
                      <div className="space-y-1.5">
                        {allBranches
                          .filter(br => String(br.id) !== String(inspectUser.branch_id))
                          .map((br) => (
                            <div key={br.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs opacity-75">
                              <div className="flex items-center gap-2">
                                <Lock size={13} className="text-slate-400 flex-shrink-0" />
                                <span className="font-medium text-slate-700">{br.name}</span>
                                <span className="text-slate-400 text-[11px]">({br.business_name})</span>
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
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
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => {
                  const targetUser = inspectUser;
                  setInspectUser(null);
                  openEditModal(targetUser);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Edit User Branch Assignment</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectUser(null)}
                className="inline-flex items-center gap-2 h-9 px-4 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
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

