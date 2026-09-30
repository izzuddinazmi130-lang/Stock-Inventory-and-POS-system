import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navigationFor, isItemActive } from './navigation';
import BrandMark from './BrandMark';
import { cn } from './ui/cn';
import { ButtonBase } from './ui/Button';
import { Tooltip } from './ui/Tooltip';

/**
 * Navigation list. Used in the desktop sidebar (optionally collapsed to icons) and in the mobile drawer.
 * A slim accent bar slides to the active item.
 */
export function NavList({ collapsed = false, onNavigate }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const listRef = useRef(null);
  const [bar, setBar] = useState(null);
  const groups = navigationFor(user);

  useLayoutEffect(() => {
    const measure = () => {
      const nav = listRef.current;
      const el = nav?.querySelector('[aria-current="page"]');
      if (!el) { setBar(null); return; }
      // Measure against the nav itself (tooltip wrappers are positioned, so offsetTop would be wrong)
      const top = el.getBoundingClientRect().top - nav.getBoundingClientRect().top;
      setBar({ top: top + el.offsetHeight / 2 - 10 });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && listRef.current) ro.observe(listRef.current);
    return () => ro?.disconnect();
  }, [pathname, collapsed, groups.length]);

  return (
    <nav ref={listRef} aria-label="Main" className="relative px-3 py-2">
      {bar && (
        <span
          aria-hidden="true"
          className="absolute left-0 w-[3px] h-5 rounded-r-full bg-accent transition-[top] duration-base ease-out"
          style={{ top: bar.top }}
        />
      )}
      {groups.map((group, gi) => (
        <div key={group.label || gi} className={cn(gi > 0 && 'mt-5')}>
          {group.label && (
            collapsed
              ? <div className="mx-auto mb-2 w-5 h-px bg-line" aria-hidden="true" />
              : <div className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">{group.label}</div>
          )}
          <ul className="space-y-0.5">
            {group.items.map(item => {
              const active = isItemActive(item, pathname);
              const Icon = item.icon;
              const link = (
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 h-9 rounded-lg text-sm transition-colors duration-fast ease-out',
                            collapsed ? 'justify-center w-10 mx-auto' : 'px-3',
                    active ? 'bg-sunken text-ink font-medium' : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                  )}
                >
                  <Icon className={cn('w-[18px] h-[18px] flex-shrink-0 transition-colors', active ? 'text-accent' : 'text-ink-muted group-hover:text-ink-secondary')} aria-hidden="true" />
                  <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
                </Link>
              );
              return (
                <li key={item.to}>
                  {collapsed ? <Tooltip content={item.label} side="right" className="flex">{link}</Tooltip> : link}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Desktop sidebar (hidden below md; the header opens the same list in a drawer). */
export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col sticky top-0 h-screen flex-shrink-0 bg-surface border-r border-line',
        'transition-[width] duration-slow ease-out',
        collapsed ? 'w-[4.5rem]' : 'w-60'
      )}
    >
      <div className={cn('h-16 flex items-center border-b border-line-soft flex-shrink-0', collapsed ? 'justify-center' : 'px-5')}>
        <Link to="/dashboard" className={cn('rounded-lg')} aria-label="HQ Inventory home">
          <BrandMark withName={!collapsed} />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <NavList collapsed={collapsed} />
      </div>
      <div className={cn('p-3 border-t border-line-soft', collapsed && 'flex justify-center')}>
        <ButtonBase
          onClick={onToggle}
          className={cn(
            'flex items-center gap-3 h-9 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-subtle transition-colors',
            collapsed ? 'w-10 justify-center' : 'w-full px-3'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" aria-hidden="true" /> : <PanelLeftClose className="w-[18px] h-[18px]" aria-hidden="true" />}
          {!collapsed && <span>Collapse</span>}
        </ButtonBase>
      </div>
    </aside>
  );
}
