import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn, focusRing, prefersReducedMotion } from './cn';
import { SkeletonKpi } from './Skeleton';

/** Animate a number from 0 to `target` once (skipped when the user prefers reduced motion). */
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const done = useRef(false);
  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) return;
    if (done.current || prefersReducedMotion()) { setValue(target); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      // A 0 while data is still loading doesn't count as the first real value
      else { done.current = target !== 0; setValue(target); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const TONES = {
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
  violet: 'bg-violet-soft text-violet-fg',
  neutral: 'bg-sunken text-ink-secondary',
};
const META_TONES = {
  neutral: 'text-ink-muted', success: 'text-success-fg', warning: 'text-warning-fg', danger: 'text-danger-fg',
  accent: 'text-accent', info: 'text-info-fg', violet: 'text-violet-fg',
};

/**
 * Headline number.
 *   <KpiCard label="Revenue" value={1404.7} format={v => `RM ${v.toFixed(2)}`} icon={TrendingUp} tone="success"
 *            meta="Last 30 days" delta={12.5} />
 * Numeric `value` counts up once on first load; strings render as-is. `to` makes the card a link.
 */
export default function KpiCard({ label, value, format, icon: Icon, tone = 'accent', meta, metaTone = 'neutral', delta, loading, to, onClick, className }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const animated = useCountUp(numeric ? value : 0);
  if (loading) return <SkeletonKpi className={className} />;

  const shown = numeric
    ? (format ? format(animated) : Math.round(animated).toLocaleString('en-MY'))
    : (value ?? '—');

  const Tag = to ? Link : onClick ? 'button' : 'div';
  return (
    <Tag
      to={to}
      onClick={onClick}
      type={Tag === 'button' ? 'button' : undefined}
      className={cn(
        'block text-left w-full bg-surface border border-line rounded-xl p-5 shadow-card',
        (to || onClick) && cn('transition-[border-color,box-shadow,transform] duration-base ease-out hover:border-line-strong hover:shadow-popover hover:-translate-y-px', focusRing),
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-caption font-medium text-ink-muted">{label}</span>
        {Icon && (
          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', TONES[tone] || TONES.accent)}>
            <Icon className="w-4 h-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink tabular-nums truncate">{shown}</div>
      {(meta || typeof delta === 'number') && (
        <div className="mt-1 flex items-center gap-2 text-caption">
          {typeof delta === 'number' && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', delta >= 0 ? 'text-success-fg' : 'text-danger-fg')}>
              {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> : <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {meta && <span className={cn('truncate', META_TONES[metaTone] || META_TONES.neutral)}>{meta}</span>}
        </div>
      )}
    </Tag>
  );
}
export { KpiCard };
