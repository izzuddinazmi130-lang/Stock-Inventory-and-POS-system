import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Users, Plus, ShieldCheck, Trash2, Pencil, UserCheck, Check, X, Eye, PauseCircle, PlayCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ResetPasswordModal from './components/ResetPasswordModal';
import {
  Modal, FormSection, Field, Input, Select, Button, ButtonBase, Card, CardHeader, FilterBar, KpiCard, Menu, PageHeader, SearchInput,
  SegmentedControl, StatusPill, BusinessDot, Table, THead, TBody, TH, TR, TD, TableState, useConfirm, useToast,
} from '../../components/ui';
import { RoleBadge, UserAccessFields, UserAccessModal, relativeTime } from './components/UserModals';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'declined', label: 'Declined' },
];

export default function UserManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'pending' ? 'pending' : 'users';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({ total: 0, superadmins: 0, admins: 0, byBusiness: [] });
  // /users?tab=pending (e.g. "Review requests" on the dashboard) opens straight on pending accounts
  const [statusFilter, setStatusFilter] = useState(initialTab === 'pending' ? 'pending' : 'all');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // `message` only carries errors shown inside the add/edit form; page messages are toasts
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

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
  const [resetUser, setResetUser] = useState(null);
  const { user: currentUser } = useAuth();

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
      setLoadError('');
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
      setLoadError(err.response?.data?.message || err.message);
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
      setSaving(true);
      const res = await api.post('/users', {
        ...addForm,
        business_id: addForm.role === 'admin' ? parseInt(addForm.business_id) : null,
        branch_id: addForm.role === 'admin' ? parseInt(addForm.branch_id) : null
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowAddModal(false);
        setAddForm({ full_name: '', email: '', password: '', role: 'admin', business_id: '', branch_id: '' });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put(`/users/${editForm.id}`, {
        role: editForm.role,
        business_id: editForm.role === 'admin' ? parseInt(editForm.business_id) : null,
        branch_id: editForm.role === 'admin' ? parseInt(editForm.branch_id) : null
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({ title: `Delete ${name}'s account?`, message: 'They lose access immediately. This cannot be undone.', confirmLabel: 'Delete account', tone: 'danger' });
    if (!ok) return;
    try {
      const res = await api.delete(`/users/${id}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const handleSuspend = async (id, name = 'this user') => {
    const ok = await confirm({ title: `Suspend ${name}?`, message: 'They cannot sign in until you activate the account again.', confirmLabel: 'Suspend' });
    if (!ok) return;
    try {
      await api.patch(`/users/${id}/suspend`);
      toast.success(`${name} is suspended.`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
    fetchUsers();
  };
  const handleActivate = async (id, name = 'The user') => {
    try {
      await api.patch(`/users/${id}/activate`);
      toast.success(`${name} can sign in again.`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
    fetchUsers();
  };

  const handleApprove = async (id, name) => {
    const ok = await confirm({ title: `Approve ${name}?`, message: 'They get access straight away.', confirmLabel: 'Approve' });
    if (!ok) return;
    try {
      const res = await api.post(`/users/${id}/approve`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const handleReject = async (id, name) => {
    const ok = await confirm({ title: `Decline ${name}'s request?`, confirmLabel: 'Decline', tone: 'danger' });
    if (!ok) return;
    try {
      const res = await api.post(`/users/${id}/reject`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
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

  const hasFilters = Boolean(filterBusiness || filterBranch || searchQuery || statusFilter !== 'all');
  const resetAll = () => { clearBranchFilter(); setStatusFilter('all'); };
  const firstLoad = loading && users.length === 0;
  const updateScopeParams = (business, branch) => {
    const params = {};
    if (activeTab === 'pending') params.tab = 'pending';
    if (business) params.business_id = business;
    if (branch) params.branch_id = branch;
    setSearchParams(params);
  };

  return (
    <Layout>
      <PageHeader
        title="Users & roles"
        description="Who can sign in, what they can reach, and pending account requests."
        actions={<Button icon={Plus} onClick={openAddModal}>Add user</Button>}
      />

      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard loading={firstLoad} label="Users" value={Number(userStats.total) || 0} icon={Users} tone="accent" meta="All accounts" />
        <KpiCard loading={firstLoad} label="Super admins" value={Number(userStats.superadmins) || 0} icon={ShieldCheck} tone="violet" meta="Full HQ access" />
        <KpiCard
          loading={firstLoad}
          label="Branch admins"
          value={Number(userStats.admins) || 0}
          icon={UserCheck}
          tone="info"
          meta={userStats.byBusiness?.map(b => `${b.name} ${b.count}`).join(' · ') || 'None yet'}
        />
      </div>

      <FilterBar onReset={resetAll} resetVisible={hasFilters}>
        <SearchInput wrapperClassName="md:w-60" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name or email…" aria-label="Search users" />
        <Select wrapperClassName="md:w-44" aria-label="Business" value={filterBusiness} onChange={e => { setFilterBusiness(e.target.value); setFilterBranch(''); updateScopeParams(e.target.value, ''); }}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select wrapperClassName="md:w-52" aria-label="Branch" value={filterBranch} onChange={e => { setFilterBranch(e.target.value); updateScopeParams(filterBusiness, e.target.value); }}>
          <option value="">All branches</option>
          {branchesForFilter.map(b => <option key={b.id} value={b.id}>{b.name} ({b.business_name || 'Branch'})</option>)}
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader
          title="Accounts"
          description={firstLoad ? 'Loading…' : `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`}
          actions={<SegmentedControl size="sm" label="Account status" value={statusFilter} onChange={setStatusFilter} tabs={STATUS_TABS} className="max-w-full overflow-x-auto" />}
        />
        <Table minWidth="62rem">
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Role</TH>
              <TH>Business &amp; branch</TH>
              <TH>Status</TH>
              <TH>Last sign-in</TH>
              <TH>Created</TH>
              <TH className="w-px"><span className="sr-only">Actions</span></TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={7}
              loading={firstLoad}
              error={!loading && loadError && users.length === 0 ? loadError : null}
              onRetry={fetchUsers}
              empty={!loading && !loadError && users.length === 0}
              emptyIcon={Users}
              emptyTitle={statusFilter === 'pending' ? 'No pending requests' : 'No users match these filters'}
              emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={resetAll}>Clear filters</Button> : null}
            />
            {users.map((u, i) => (
              <TR key={u.id} index={i}>
                <TD>
                  <ButtonBase onClick={() => setInspectUser(u)} className="text-left group rounded">
                    <div className="font-medium text-ink group-hover:text-accent transition-colors">{u.full_name}</div>
                    <div className="text-caption text-ink-muted">{u.email}</div>
                  </ButtonBase>
                </TD>
                <TD><RoleBadge role={u.role} /></TD>
                <TD>
                  {u.role === 'super_admin' ? (
                    <span className="text-sm text-ink-secondary">All businesses &amp; branches</span>
                  ) : (
                    <>
                      <div className="text-sm text-ink flex items-center gap-1.5">
                        <BusinessDot business={{ id: u.business_id, name: u.business_name }} size="sm" />
                        {u.business_name || 'No business'}
                      </div>
                      <div className="text-caption text-ink-muted">
                        {u.branch_name || 'No branch'}{u.branch_code && <span className="font-mono"> · {u.branch_code}</span>}
                      </div>
                    </>
                  )}
                </TD>
                <TD><StatusPill kind="user" value={u.status} size="sm" /></TD>
                <TD className="text-caption text-ink-muted whitespace-nowrap">{relativeTime(u.last_login)}</TD>
                <TD className="text-caption text-ink-muted whitespace-nowrap tabular-nums">{new Date(u.created_at).toLocaleDateString('en-MY', { dateStyle: 'medium' })}</TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    {u.status === 'pending' && (
                      <>
                        <Button variant="success" size="sm" icon={Check} onClick={() => handleApprove(u.id, u.full_name)}>Approve</Button>
                        <Button variant="ghost" size="sm" icon={X} onClick={() => handleReject(u.id, u.full_name)}>Decline</Button>
                      </>
                    )}
                    <Menu
                      label={`Actions for ${u.full_name}`}
                      items={[
                        { label: 'View access', icon: Eye, onClick: () => setInspectUser(u) },
                        { label: 'Change access', icon: Pencil, onClick: () => openEditModal(u) },
                        { label: 'Reset password', icon: KeyRound, onClick: () => setResetUser(u), hidden: u.id === currentUser?.id || u.status === 'pending' || u.status === 'declined' },
                        { label: 'Suspend', icon: PauseCircle, onClick: () => handleSuspend(u.id, u.full_name), hidden: u.status !== 'active' },
                        { label: 'Activate', icon: PlayCircle, onClick: () => handleActivate(u.id, u.full_name), hidden: u.status !== 'suspended' },
                        { divider: true },
                        { label: 'Delete account', icon: Trash2, tone: 'danger', onClick: () => handleDelete(u.id, u.full_name) },
                      ]}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

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
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create user</Button>
          </>}
        >
          <FormSection title="Account">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <Input required placeholder="e.g. Ali bin Abu" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} />
              </Field>
              <Field label="Email" required hint="Used to sign in.">
                <Input type="email" required placeholder="you@gmail.com" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
              </Field>
            </div>
            <Field label="Password" required hint="At least 6 characters. Share it with the user privately.">
              <Input type="password" required minLength={6} autoComplete="new-password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} />
            </Field>
          </FormSection>
          <UserAccessFields form={addForm} setForm={setAddForm} businesses={businesses} branches={branches} />
        </Modal>
      )}

      {showEditModal && (
        <Modal
          icon={Pencil}
          title="Change user access"
          description={editForm.full_name ? `${editForm.full_name}${editForm.email ? ` · ${editForm.email}` : ''}` : undefined}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save changes</Button>
          </>}
        >
          <UserAccessFields form={editForm} setForm={setEditForm} businesses={businesses} branches={editBranches} />
        </Modal>
      )}

      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />

      {inspectUser && (
        <UserAccessModal
          user={inspectUser}
          allBranches={allBranches}
          onClose={() => setInspectUser(null)}
          onEdit={() => { const target = inspectUser; setInspectUser(null); openEditModal(target); }}
        />
      )}
    </Layout>
  );
}
