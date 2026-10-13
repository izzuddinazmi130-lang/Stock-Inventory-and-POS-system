import {
  LayoutDashboard, Package, PackageMinus, AlertTriangle, Receipt, BarChart3, Building2, Users, History, Store, ScanLine,
} from 'lucide-react';
import { t } from '../i18n';

// Sidebar items per role. Visibility matches what each role could reach before the redesign;
// the routes themselves are still guarded in App.jsx and by the API.
// `match` lists path prefixes that should highlight the item.
export function navigationFor(user) {
  if (!user) return [];
  if (user.role === 'super_admin') {
    return [
      { items: [{ to: '/dashboard', label: t('Overview'), icon: LayoutDashboard, exact: true }] },
      {
        label: t('Inventory'),
        items: [
          { to: '/products', label: t('Products'), icon: Package, match: ['/products', '/qr/generate'] },
          { to: '/low-stock', label: t('Low stock'), icon: PackageMinus },
          { to: '/damage', label: t('Damage records'), icon: AlertTriangle },
          { to: '/reports', label: t('Stock reports'), icon: BarChart3 },
        ],
      },
      {
        label: t('Sales'),
        items: [
          { to: '/sales', label: t('Sales history'), icon: Receipt },
          { to: '/stores', label: t('Pop-up stores'), icon: Store },
        ],
      },
      {
        label: t('Manage'),
        items: [
          { to: '/businesses', label: t('Businesses'), icon: Building2, match: ['/businesses', '/branches'] },
          { to: '/users', label: t('Users'), icon: Users },
          { to: '/audit', label: t('Activity log'), icon: History },
        ],
      },
    ];
  }
  return [
    { items: [{ to: '/dashboard', label: t('Dashboard'), icon: LayoutDashboard, exact: true }] },
    {
      label: t('Selling'),
      items: [
        { to: '/qr/scan', label: t('Point of sale'), icon: ScanLine, match: ['/qr'] },
        { to: '/sales', label: t('Sales history'), icon: Receipt },
        { to: `/branches/${user.branch_id}/stores`, label: t('Pop-up stores'), icon: Store, match: ['/branches', '/stores'] },
      ],
    },
    {
      label: t('Inventory'),
      items: [
        { to: '/products', label: t('Products'), icon: Package },
        { to: '/low-stock', label: t('Low stock'), icon: PackageMinus },
        { to: '/damage', label: t('Damage records'), icon: AlertTriangle },
        { to: '/reports', label: t('Stock reports'), icon: BarChart3 },
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
