import React from 'react';
import {
  PackageCheck, PackageMinus, PackageX, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, SlidersHorizontal,
  CheckCircle2, Clock, XCircle, PauseCircle, Radio, CalendarClock, CircleSlash, Banknote, QrCode, CreditCard, Tag,
} from 'lucide-react';
import { cn } from './cn';

// Full class strings (Tailwind can't see interpolated names)
const TONES = {
  neutral: 'bg-sunken text-ink-secondary ring-line',
  accent: 'bg-accent-soft text-accent-fg ring-accent-line',
  success: 'bg-success-soft text-success-fg ring-success-line',
  warning: 'bg-warning-soft text-warning-fg ring-warning-line',
  danger: 'bg-danger-soft text-danger-fg ring-danger-line',
  info: 'bg-info-soft text-info-fg ring-info-line',
  violet: 'bg-violet-soft text-violet-fg ring-violet-line',
  solid: 'bg-ink text-white ring-ink',
};
const DOTS = {
  neutral: 'bg-ink-subtle', accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning',
  danger: 'bg-danger', info: 'bg-info', violet: 'bg-violet', solid: 'bg-white',
};
const SIZES = { sm: 'h-5 px-1.5 text-[11px] gap-1', md: 'h-6 px-2 text-caption gap-1.5' };

/**
 * Small status/label chip.
 *   <Badge tone="success" dot>Active</Badge>   <Badge icon={Tag}>Kaftan</Badge>
 */
export function Badge({ tone = 'neutral', size = 'md', dot = false, dotClassName, icon: Icon, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone] || TONES.neutral,
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotClassName || DOTS[tone])} aria-hidden="true" />}
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;

// ── Status pills: one mapping per domain so the same status always looks the same ──
const STATUS = {
  stock: {
    ok: { tone: 'success', label: 'In stock', icon: PackageCheck },
    low: { tone: 'warning', label: 'Low stock', icon: PackageMinus },
    out: { tone: 'danger', label: 'Out of stock', icon: PackageX },
  },
  movement: {
    in: { tone: 'success', label: 'Stock in', icon: ArrowDownToLine },
    out: { tone: 'info', label: 'Stock out', icon: ArrowUpFromLine },
    adjust: { tone: 'violet', label: 'Adjusted', icon: SlidersHorizontal },
    damage: { tone: 'danger', label: 'Damage', icon: AlertTriangle },
  },
  user: {
    active: { tone: 'success', label: 'Active', icon: CheckCircle2 },
    pending: { tone: 'warning', label: 'Pending', icon: Clock },
    declined: { tone: 'danger', label: 'Declined', icon: XCircle },
    suspended: { tone: 'neutral', label: 'Suspended', icon: PauseCircle },
  },
  store: {
    active: { tone: 'success', label: 'Live', icon: Radio },
    upcoming: { tone: 'info', label: 'Upcoming', icon: CalendarClock },
    ended: { tone: 'neutral', label: 'Ended', icon: CircleSlash },
  },
  product: {
    available: { tone: 'success', label: 'For sale', icon: Tag },
    discontinued: { tone: 'neutral', label: 'Hidden', icon: CircleSlash },
  },
  payment: {
    cash: { tone: 'neutral', label: 'Cash', icon: Banknote },
    qr: { tone: 'neutral', label: 'QR / e-Wallet', icon: QrCode },
    online_banking: { tone: 'neutral', label: 'Card / Online', icon: CreditCard },
  },
};

/**
 * Consistent pill for a known status.
 *   <StatusPill kind="stock" value="low" />   <StatusPill kind="movement" value="in" />
 * kinds: stock, movement, user, store, product, payment. `label` overrides the text.
 */
export function StatusPill({ kind, value, label, size = 'md', showIcon = true, className }) {
  const entry = STATUS[kind]?.[value] || { tone: 'neutral', label: value || '—' };
  return (
    <Badge tone={entry.tone} size={size} icon={showIcon ? entry.icon : undefined} className={className}>
      {label ?? entry.label}
    </Badge>
  );
}

export const STATUS_META = STATUS;

// ── Business identity ────────────────────────────────────────────────────────
const OTHER_BUSINESS_DOTS = ['bg-accent', 'bg-success', 'bg-violet', 'bg-info', 'bg-warning', 'bg-danger'];

/** Tailwind class for a business's identity colour (known brands, then a stable colour per id). */
export function businessDotClass(business) {
  if (!business) return 'bg-ink-subtle';
  const b = typeof business === 'object' ? business : { name: String(business) };
  const text = `${b.name || ''} ${b.business_name || ''} ${b.industry || ''}`.toLowerCase();
  if (text.includes('kaftan') || text.includes('fashion')) return 'bg-brand-kaftanasia';
  if (text.includes('as tech') || text.includes('astech') || text.includes('technology')) return 'bg-brand-astech';
  const id = parseInt(b.id ?? b.business_id, 10);
  return Number.isFinite(id) ? OTHER_BUSINESS_DOTS[id % OTHER_BUSINESS_DOTS.length] : 'bg-ink-subtle';
}

/** Small coloured dot shown next to a business name. */
export function BusinessDot({ business, size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block rounded-full flex-shrink-0', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2', businessDotClass(business), className)}
    />
  );
}
