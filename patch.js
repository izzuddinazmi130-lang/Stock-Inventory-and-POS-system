const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/users/UserManagement.jsx', 'utf8');

// Imports
code = code.replace(
  /import api from '\.\.\/\.\.\/services\/api';/,
  "import api from '../../services/api';\nimport KpiCard from '../../components/KpiCard';"
);

// State
code = code.replace(
  /const \[users, setUsers\] = useState\(\[\]\);/,
  "const [users, setUsers] = useState([]);\n  const [userStats, setUserStats] = useState({ total: 0, superadmins: 0, admins: 0, byBusiness: [] });\n  const STATUS_TABS = ['all', 'active', 'suspended', 'pending', 'declined'];\n  const [statusFilter, setStatusFilter] = useState('all');"
);

// fetchUsers
code = code.replace(
  /const \[resUsers, resPending\] = await Promise\.all\(\[\s*api\.get\('\/users'\),\s*api\.get\('\/users\/pending'\)\s*\]\);/,
  "const [resUsers, resPending, resStats] = await Promise.all([\n        api.get('/users', { params: { status: statusFilter === 'all' ? undefined : statusFilter } }),\n        api.get('/users/pending'),\n        api.get('/users/stats')\n      ]);"
);

code = code.replace(
  /setStats\(resUsers\.data\.stats \|\| \{ total: 0, active: 0, pending: 0 \}\);/,
  "setStats(resUsers.data.stats || { total: 0, active: 0, pending: 0 });\n      if (resStats?.data?.success) setUserStats(resStats.data.stats);"
);

// Add useEffect dependency for statusFilter
code = code.replace(
  /useEffect\(\(\) => \{\s*fetchUsers\(\);\s*api\.get\('\/businesses'\)[\s\S]*?\}, \[\]\);/,
  "useEffect(() => {\n    fetchUsers();\n  }, [statusFilter]);\n\n  useEffect(() => {\n    api.get('/businesses').then(res => {\n      if (res.data.success) setBusinesses(res.data.businesses || res.data.data || []);\n    }).catch(() => {});\n  }, []);"
);

// Add handlers
code = code.replace(
  /const handleApprove = /,
  "const handleSuspend = async (id) => {\n    if (!window.confirm('Suspend this user?')) return;\n    await api.patch(`/users/${id}/suspend`);\n    fetchUsers();\n  };\n  const handleActivate = async (id) => {\n    await api.patch(`/users/${id}/activate`);\n    fetchUsers();\n  };\n\n  const handleApprove = "
);

// Add relativeTime
code = code.replace(
  /export default function UserManagement\(\) \{/,
  "const relativeTime = (dt) => {\n  if (!dt) return 'Never';\n  const diff = Date.now() - new Date(dt).getTime();\n  const mins = Math.floor(diff / 60000);\n  if (mins < 60) return `${mins}m ago`;\n  const hrs = Math.floor(mins / 60);\n  if (hrs < 24) return `${hrs}h ago`;\n  return `${Math.floor(hrs / 24)}d ago`;\n};\n\nexport default function UserManagement() {"
);

// KPI Cards & Tabs
const kpiCode = `
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Users" value={userStats.total} meta="Active accounts" icon={Users} color="indigo" />
        <KpiCard title="Superadmins" value={userStats.superadmins} meta="Full system access" icon={ShieldCheck} color="purple" />
        <KpiCard
          title="Admins"
          value={userStats.admins}
          meta={userStats.byBusiness.map(b => \`\${b.name} \${b.count}\`).join(' · ') || 'No admins yet'}
          icon={UserCheck}
          color="blue"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={\`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors \${
                  statusFilter === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }\`}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
`;

code = code.replace(
  /<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">[\s\S]*?<div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">[\s\S]*?<\/div>/,
  kpiCode
);

// Change Table headers to include Last Login
code = code.replace(
  /<th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Status<\/th>/,
  '<th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Status</th>\n                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Login</th>'
);
// And for Pending users tab if it's there? The user asked to replace 2-tabs with segmented control, so maybe the "Pending" tab is removed entirely and just filtered? The user instructions: "Replace or extend the existing 2-tab system with a 5-option segmented control... STATUS_TABS = ['all', 'active', 'suspended', 'pending', 'declined']".
// Wait, the current code maps over `users` or `pendingUsers` based on `activeTab`. If I remove `activeTab`, I should change how users are mapped.
// Let's replace the whole users/pending rendering.

fs.writeFileSync('patch.js', code);
