import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';

/**
 * Dropdown of actions (row "…" menus, user menu). Rendered in a portal so tables don't clip it.
 *   <Menu label="Actions for Kaftan" items={[
 *     { label: 'Edit', icon: Pencil, onClick: edit },
 *     { label: 'View report', icon: FileText, to: '/stores/3/report' },
 *     { divider: true },
 *     { label: 'Delete', icon: Trash2, onClick: remove, tone: 'danger' },
 *   ]} />
 * Custom trigger: trigger={({ ref, ...props }) => <button ref={ref} {...props}>…</button>}
 * Items with `hidden: true` are skipped, so role-based options can be listed inline.
 */
export function Menu({ items, label = 'More actions', trigger, align = 'end', width = 'w-52', header, icon = MoreHorizontal, triggerVariant = 'ghost', triggerSize = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const visible = items.filter(i => !i.hidden);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const menuH = menuRef.current?.offsetHeight || 200;
    const below = window.innerHeight - r.bottom;
    const up = below < menuH + 12 && r.top > below;
    setPos({
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      left: align === 'start' ? r.left : undefined,
      right: align === 'end' ? window.innerWidth - r.right : undefined,
      up,
    });
  }, [align]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    requestAnimationFrame(() => menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus());
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const onMenuKey = (e) => {
    const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const i = nodes.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); nodes[(i + 1) % nodes.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); nodes[(i - 1 + nodes.length) % nodes.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); nodes[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); nodes[nodes.length - 1]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); triggerRef.current?.focus(); }
  };

  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (e) => { e.stopPropagation(); setOpen(o => !o); },
    onKeyDown: (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } },
  };

  if (visible.length === 0) return null;

  return (
    <>
      {trigger ? trigger(triggerProps) : (
        <IconButton icon={icon} label={label} variant={triggerVariant} size={triggerSize} tooltip={false} {...triggerProps} />
      )}
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          onClick={e => e.stopPropagation()}
          style={pos ? { top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right } : { visibility: 'hidden' }}
          className={cn(
            'fixed z-[70] bg-surface border border-line rounded-xl shadow-popover p-1 animate-scale-in',
            pos?.up ? (align === 'end' ? 'origin-bottom-right' : 'origin-bottom-left') : (align === 'end' ? 'origin-top-right' : 'origin-top-left'),
            width
          )}
        >
          {header && <div className="px-2.5 pt-1.5 pb-2 mb-1 border-b border-line-soft">{header}</div>}
          {visible.map((item, i) => {
            if (item.divider) return <div key={`d${i}`} role="separator" className="my-1 h-px bg-line-soft" />;
            const Icon = item.icon;
            const cls = cn(
              'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-left transition-colors duration-fast',
              'focus-visible:outline-none',
              item.tone === 'danger'
                ? 'text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft'
                : 'text-ink hover:bg-sunken focus-visible:bg-sunken',
              item.disabled && 'opacity-50 pointer-events-none'
            );
            const body = (
              <>
                {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', item.tone === 'danger' ? 'text-danger-fg' : 'text-ink-muted')} aria-hidden="true" />}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-caption text-ink-muted">{item.hint}</span>}
              </>
            );
            if (item.to) {
              return (
                <Link key={item.label} role="menuitem" to={item.to} className={cls} onClick={() => setOpen(false)}>{body}</Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cls}
                onClick={() => { setOpen(false); item.onClick?.(); }}
              >
                {body}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

export default Menu;
