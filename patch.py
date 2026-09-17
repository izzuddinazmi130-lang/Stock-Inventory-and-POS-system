import re
import os

filepath = 'frontend/src/pages/users/UserManagement.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# IMPORTS
code = code.replace("import api from '../../services/api';", "import api from '../../services/api';\nimport KpiCard from '../../components/KpiCard';")

# STATE
code = code.replace("const [users, setUsers] = useState([]);", """const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({ total: 0, superadmins: 0, admins: 0, byBusiness: [] });
  const STATUS_TABS = ['all', 'active', 'suspended', 'pending', 'declined'];
  const [statusFilter, setStatusFilter] = useState('all');""")

# FETCH
old_fetch = """    try {
      setLoading(true);
      const [resUsers, resPending] = await Promise.all([
        api.get('/users'),
        api.get('/users/pending')
      ]);

      if (resUsers.data.success) {
        setUsers(resUsers.data.users || []);
        setStats(resUsers.data.stats || { total: 0, active: 0, pending: 0 });
      }
      if (resPending.data.success) {
        setPendingUsers(resPending.data.pendingUsers || []);
      }
    } catch (err) {"""
new_fetch = """    try {
      setLoading(true);
      const [resUsers, resPending, resStats] = await Promise.all([
        api.get('/users', { params: { status: statusFilter === 'all' ? undefined : statusFilter } }),
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
    } catch (err) {"""
code = code.replace(old_fetch, new_fetch)

# USEEFFECT
old_effect = """  useEffect(() => {
    fetchUsers();
    api.get('/businesses').then(res => {
      if (res.data.success) setBusinesses(res.data.businesses || res.data.data || []);
    }).catch(() => {});
  }, []);"""
new_effect = """  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  useEffect(() => {
    api.get('/businesses').then(res => {
      if (res.data.success) setBusinesses(res.data.businesses || res.data.data || []);
    }).catch(() => {});
  }, []);"""
code = code.replace(old_effect, new_effect)

# RELATIVE TIME
relative_time = """const relativeTime = (dt) => {
  if (!dt) return 'Never';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function UserManagement() {"""
code = code.replace("export default function UserManagement() {", relative_time)

# HANDLERS
handlers = """  const handleSuspend = async (id) => {
    if (!window.confirm('Suspend this user?')) return;
    await api.patch(`/users/${id}/suspend`);
    fetchUsers();
  };
  const handleActivate = async (id) => {
    await api.patch(`/users/${id}/activate`);
    fetchUsers();
  };

  const handleApprove = """
code = code.replace("  const handleApprove = ", handlers)

# KPI & TABS (replace activeTab tabs)
import re
code = re.sub(r'\{\/\* Top Tabs \*\/\}[\s\S]*?\{\/\* Tab Content 1: Active Users Table \*\/\}', """{/* KPI Cards */}
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

      {/* Top Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg gap-1 mb-6 w-max">
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

      {/* Tab Content 1: Active Users Table */}""", code)

code = code.replace("{activeTab === 'users' && (", "")

# Table Headers
old_headers = """<th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Created At</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-right whitespace-nowrap">Actions</th>"""
new_headers = """<th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Last Login</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap">Created At</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-right whitespace-nowrap">Actions</th>"""
code = code.replace(old_headers, new_headers)

old_status_cell = """<td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                        {u.is_active === 1 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700"><ShieldCheck className="w-3 h-3" /> ACTIVE</span>
                        ) : u.is_active === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700"><Clock className="w-3 h-3" /> PENDING</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700"><UserX className="w-3 h-3" /> DECLINED</span>
                        )}
                      </td>"""
new_status_cell = """<td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
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
                      </td>"""
code = code.replace(old_status_cell, new_status_cell)

old_actions = """<div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-2 h-8 px-2.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            title="Edit User"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.full_name)}
                            className="inline-flex items-center gap-2 h-8 px-2.5 text-rose-500 text-xs font-medium rounded-lg hover:bg-rose-50 hover:text-rose-700 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>"""

new_actions = """<div className="flex items-center justify-end gap-1.5">
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
                            className="inline-flex items-center gap-2 h-8 px-2.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            title="Edit User"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.full_name)}
                            className="inline-flex items-center gap-2 h-8 px-2.5 text-rose-500 text-xs font-medium rounded-lg hover:bg-rose-50 hover:text-rose-700 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>"""
code = code.replace(old_actions, new_actions)

# Remove Tab 2 (Pending Queue)
code = re.sub(r'\{\/\* Tab Content 2: Pending Approvals Queue \*\/\}[\s\S]*?\{\/\* Add Modal \*\/\}', '{/* Add Modal */}', code)

# Remove the extra `)}` since we removed `{activeTab === 'users' && (`
code = re.sub(r'\n      <\/div>\n    \)\}', '\n      </div>', code)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched!")
