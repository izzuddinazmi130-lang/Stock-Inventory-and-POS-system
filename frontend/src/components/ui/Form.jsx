import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// Shared building blocks so every form in the app looks and reads the same way:
// a modal shell with a fixed header/footer, titled sections, and labelled fields with hints.

export const inputClass =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:bg-subtle disabled:text-ink-muted';

/** Date value → 'YYYY-MM-DD' in local time for <input type="date"> (toISOString() would shift it to UTC). */
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const errorRing = 'border-danger-line focus:ring-danger focus:border-danger';

const MODAL_SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' };

/**
 * Modal with a sticky header and footer and a scrolling body.
 * Pass `onSubmit` to turn the body + footer into a <form> (Enter submits, required fields validate).
 * Pass `error` to show a failure message inside the modal (instead of on the page behind it).
 */
export function Modal({ title, description, icon: Icon, onClose, onSubmit, footer, size = 'md', error, onDismissError, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Body = onSubmit ? 'form' : 'div';
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`bg-surface border border-line rounded-xl shadow-xl w-full ${MODAL_SIZES[size] || MODAL_SIZES.md} max-h-[90vh] flex flex-col`} role="dialog" aria-modal="true">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-line-soft flex-shrink-0">
          {Icon && <div className="p-2 rounded-lg bg-accent-soft text-accent flex-shrink-0"><Icon className="w-5 h-5" /></div>}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-ink">{title}</h3>
            {description && <div className="text-xs text-ink-muted mt-0.5">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="p-1 -m-1 text-ink-muted hover:text-ink-secondary rounded-lg" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <Body onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
            {error && <FormAlert onClose={onDismissError}>{error}</FormAlert>}
            {children}
          </div>
          {footer && <div className="px-6 py-4 border-t border-line-soft bg-subtle/60 rounded-b-xl flex items-center justify-end gap-2 flex-shrink-0">{footer}</div>}
        </Body>
      </div>
    </div>
  );
}

/** A titled group of fields inside a form. */
export function FormSection({ title, description, children, className = '' }) {
  return (
    <section className={className}>
      {(title || description) && (
        <div className="mb-3">
          {title && <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{title}</h4>}
          {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Label + control + optional hint / error. */
export function Field({ label, required, optional, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-ink-secondary mb-1">
          {label}
          {required && <span className="text-danger-fg ml-0.5">*</span>}
          {optional && <span className="text-ink-muted font-normal ml-1">(optional)</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="mt-1 text-xs text-danger-fg flex items-center gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0" />{error}</p>
        : hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Input({ error, className = '', ...props }) {
  return <input className={`${inputClass} ${error ? errorRing : ''} ${className}`} {...props} />;
}

export function Select({ error, className = '', children, ...props }) {
  return <select className={`${inputClass} ${error ? errorRing : ''} ${className}`} {...props}>{children}</select>;
}

export function Textarea({ className = '', rows = 3, ...props }) {
  return <textarea rows={rows} className={`${inputClass} h-auto py-2 ${className}`} {...props} />;
}

/** Number input with an "RM" prefix. Empty stays empty (placeholder 0.00) so users don't have to delete a 0 first. */
export function MoneyInput({ error, className = '', ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs font-semibold pointer-events-none">RM</span>
      <input type="number" min="0" step="0.01" placeholder="0.00" inputMode="decimal"
        className={`${inputClass} pl-10 font-mono ${error ? errorRing : ''} ${className}`} {...props} />
    </div>
  );
}

/** Button-style choice between a few options (replaces confusing <select>s for 2–4 choices). */
export function ChoiceCards({ value, onChange, options, columns = 2 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns] || 'sm:grid-cols-2';
  return (
    <div className={`grid grid-cols-1 ${cols} gap-2`}>
      {options.map(opt => {
        const active = String(value) === String(opt.value);
        const Icon = opt.icon;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`text-left p-3 rounded-lg border transition-colors ${active ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-line-strong'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              {Icon && <Icon className={`w-4 h-4 ${active ? (opt.activeColor || 'text-accent') : 'text-ink-muted'}`} />}
              {opt.label}
            </div>
            {opt.description && <div className="text-[11px] text-ink-muted mt-0.5">{opt.description}</div>}
          </button>
        );
      })}
    </div>
  );
}

export function FormAlert({ type = 'error', children, onClose }) {
  const styles = type === 'error'
    ? 'bg-danger-soft border-danger-line text-danger-fg'
    : type === 'warning' ? 'bg-warning-soft border-warning-line text-warning-fg'
    : 'bg-accent-soft border-accent-line text-accent-fg';
  return (
    <div className={`p-3 rounded-lg border text-sm flex items-start justify-between gap-2 ${styles}`}>
      <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{children}</div></div>
      {onClose && <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return <button type="submit" className={`inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`} {...props}>{children}</button>;
}

export function SecondaryButton({ children, className = '', ...props }) {
  return <button type="button" className={`inline-flex items-center justify-center gap-2 h-10 px-4 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}
