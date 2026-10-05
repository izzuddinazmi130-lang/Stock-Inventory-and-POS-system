import {
  LayoutDashboard, Package, PackageMinus, AlertTriangle, Receipt, BarChart3, Building2, Users, History, Store, ScanLine,
} from 'lucide-react';

// Sidebar items per role. Visibility matches what each role could reach before the redesign;
// the routes themselves are still guarded in App.jsx and by the API.
// `match` lists path prefixes that should highlight the item.
export function navigationFor(user) {
  if (!user) return [];
  if (user.role === 'super_admin') {
    return [
      { items: [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true }] },
      {
        label: 'Inventory',
        items: [
          { to: '/products', label: 'Products', icon: Package, match: ['/products', '/qr/generate'] },
          { to: '/low-stock', label: 'Low stock', icon: PackageMinus },
          { to: '/damage', label: 'Damage records', icon: AlertTriangle },
          { to: '/reports', label: 'Stock reports', icon: BarChart3 },
        ],
      },
      {
        label: 'Sales',
        items: [
          { to: '/sales', label: 'Sales history', icon: Receipt },
          { to: '/stores', label: 'Pop-up stores', icon: Store },
        ],
      },
      {
        label: 'Manage',
        items: [
          { to: '/businesses', label: 'Businesses', icon: Building2, match: ['/businesses', '/branches'] },
          { to: '/users', label: 'Users', icon: Users },
          { to: '/audit', label: 'Activity log', icon: History },
        ],
      },
    ];
  }
  return [
    { items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true }] },
    {
      label: 'Selling',
      items: [
        { to: '/qr/scan', label: 'Point of sale', icon: ScanLine, match: ['/qr'] },
        { to: '/sales', label: 'Sales history', icon: Receipt },
        { to: `/branches/${user.branch_id}/stores`, label: 'Pop-up stores', icon: Store, match: ['/branches', '/stores'] },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { to: '/products', label: 'Products', icon: Package },
        { to: '/low-stock', label: 'Low stock', icon: PackageMinus },
        { to: '/damage', label: 'Damage records', icon: AlertTriangle },
        { to: '/reports', label: 'Stock reports', icon: BarChart3 },
      ],
    },
  ];
}

export function isItemActive(item, pathname) {
  if (item.exact) return pathname === item.to;
  const prefixes = item.match || [item.to];
  return prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

/** The sidebar group and item the current page sits under, e.g. { group: 'Inventory', item: { label: 'Products', … } }. */
export function sectionFor(user, pathname) {
  for (const group of navigationFor(user)) {
    for (const item of group.items) if (isItemActive(item, pathname)) return { group: group.label || '', item };
  }
  return { group: '', item: null };
}

/** Label of the nav item for the current page (shown in the header). */
export function currentSectionLabel(user, pathname) {
  for (const group of navigationFor(user)) {
    for (const item of group.items) if (isItemActive(item, pathname)) return item.label;
  }
  return '';
}
