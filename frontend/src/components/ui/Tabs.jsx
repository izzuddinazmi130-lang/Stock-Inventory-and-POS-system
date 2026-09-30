import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn, focusRing } from './cn';

/**
 * Tabs with a sliding indicator.
 *   <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All', count: 12, icon: List }]} />
 * variant: "underline" (page sections) or "segmented" (compact switches inside toolbars/forms).
 */
export function Tabs({ tabs, value, onChange, variant = 'underline', size = 'md', fullWidth = false, className, label }) {
  // A tab can carry `tone: 'accent' | 'success'` to fill the segmented indicator with that colour when active
  const activeTab = tabs.find(t => t.value === value);
  const toneIndicator = { accent: 'bg-accent ring-accent', success: 'bg-success ring-success' }[activeTab?.tone];
  const listRef = useRef(null);
  const [indicator, setIndicator] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current?.querySelector('[aria-selected="true"]');
      if (!el) { setIndicator(null); return; }
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth, top: el.offsetTop, height: el.offsetHeight });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && listRef.current) ro.observe(listRef.current);
    return () => ro?.disconnect();
  }, [value, tabs.length]);

  const onKeyDown = (e) => {
    const i = tabs.findIndex(t => t.value === value);
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      onChange(next.value);
      requestAnimationFrame(() => listRef.current?.querySelector('[aria-selected="true"]')?.focus());
    }
  };

  const segmented = variant === 'segmented';
  const heights = segmented ? { sm: 'h-7 px-2.5 text-caption', md: 'h-8 px-3 text-sm', lg: 'h-11 px-4 text-sm' } : { sm: 'h-9 text-caption', md: 'h-10 text-sm', lg: 'h-11 text-sm' };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex items-center',
        segmented ? 'p-1 bg-sunken rounded-lg gap-1' : 'gap-5 border-b border-line overflow-x-auto',
        fullWidth ? 'w-full' : segmented && 'w-fit',
        className
      )}
    >
      {indicator && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute transition-[left,width,background-color] duration-base ease-out',
            segmented ? cn('rounded-md shadow-xs ring-1', toneIndicator || 'bg-surface ring-line/60') : 'bottom-0 h-0.5 rounded-full bg-accent'
          )}
          style={segmented
            ? { left: indicator.left, width: indicator.width, top: indicator.top, height: indicator.height }
            : { left: indicator.left, width: indicator.width }}
        />
      )}
      {tabs.map(tab => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative z-[1] inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-fast rounded-md',
              focusRing,
              heights[size] || heights.md,
              fullWidth && 'flex-1',
              active ? (segmented ? (tab.tone ? 'text-white' : 'text-ink') : 'text-accent') : 'text-ink-muted hover:text-ink',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span className={cn('ml-0.5 rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-accent-soft text-accent-fg' : 'bg-sunken text-ink-muted', segmented && 'bg-transparent px-0')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact pill switch (same component, segmented look). */
export function SegmentedControl(props) {
  return <Tabs variant="segmented" {...props} />;
}

export default Tabs;
