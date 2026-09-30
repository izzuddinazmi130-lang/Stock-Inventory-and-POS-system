import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  LayoutDashboard, Package, Camera, Users,
  FileBarChart, History, Building2, AlertTriangle, Store,
  ShieldCheck, ArrowLeftRight, Receipt, PackageX
} from 'lucide-react';

const SECTION_LABEL = 'px-4 mb-1 mt-5 text-[10px] font-semibold tracking-widest uppercase text-ink-muted';

function NavItem({ to, icon: Icon, label, count }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mx-2 transition-colors ${
          isActive
            ? 'bg-[#DCE8FB] text-ink font-semibold'
            : 'text-ink-muted hover:text-ink hover:bg-subtle'
        }`
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count !== null && (
        <span className="text-[10px] font-semibold bg-sunken text-ink-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{count}</span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();
  if (!user) return null;

  const isSuperAdmin = user.role === 'super_admin';
  const scopeLabel = selectedBusiness ? selectedBusiness.name.toUpperCase() : 'ALL BUSINESSES';

  return (
    <aside className="w-56 bg-surface border-r border-line flex-shrink-0 min-h-[calc(100vh-64px)] flex flex-col py-3">
      <div className="flex-1">
        {isSuperAdmin ? (
          <>
            {/* Section 1 — Business scoped */}
            <div className={SECTION_LABEL}>{scopeLabel} · SCOPE</div>
            <nav className="space-y-0.5">
              <NavItem to="/dashboard" icon={LayoutDashboard} label="Overview" />
              <NavItem to="/businesses" icon={Building2} label="Businesses" />
              <NavItem to="/products" icon={Package} label="Products" />
              <NavItem to="/low-stock" icon={PackageX} label="Low Stock" />
              <NavItem to="/sales" icon={Receipt} label="Sales History" />
            </nav>

            {/* Section 2 — HQ Controls */}
            <div className={SECTION_LABEL}>HQ CONTROLS</div>
            <nav className="space-y-0.5">
              <NavItem to="/users" icon={Users} label="Users & Roles" />
              <NavItem to="/damage" icon={AlertTriangle} label="Damage Records" />
              <NavItem to="/reports" icon={FileBarChart} label="Reports" />
              <NavItem to="/audit" icon={History} label="Audit Log" />
            </nav>
          </>
        ) : (
          <>
            <div className={SECTION_LABEL}>MY BRANCH</div>
            <nav className="space-y-0.5">
              <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/products" icon={Package} label="Products" />
              <NavItem to="/low-stock" icon={PackageX} label="Low Stock" />
              <NavItem to={`/branches/${user?.branch_id}/stores`} icon={Store} label="Stores" />
              <NavItem to="/qr/scan" icon={Camera} label="QR & POS" />
              <NavItem to="/sales" icon={Receipt} label="Sales History" />
              <NavItem to="/damage" icon={AlertTriangle} label="Damage Records" />
              <NavItem to="/reports" icon={FileBarChart} label="Reports" />
            </nav>
          </>
        )}
      </div>

      {/* Footer health card */}
      <div className="mx-3 mb-3 p-3 bg-subtle border border-line-soft rounded-xl">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success-fg flex-shrink-0" />
          <div>
            <div className="text-[12px] font-semibold text-ink">System healthy</div>
            <div className="text-[10px] text-ink-muted uppercase tracking-wide">LAST SYNC · just now</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
