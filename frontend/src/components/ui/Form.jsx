import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// Shared building blocks so every form in the app looks and reads the same way:
// a modal shell with a fixed header/footer, titled sections, and labelled fields with hints.

export const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500';

/** Date value → 'YYYY-MM-DD' in local time for <input type="date"> (toISOString() would shift it to UTC). */
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const errorRing = 'border-rose-300 focus:ring-rose-500 focus:border-rose-500';

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-xl w-full ${MODAL_SIZES[size] || MODAL_SIZES.md} max-h-[90vh] flex flex-col`} role="dialog" aria-modal="true">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
          {Icon && <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0"><Icon className="w-5 h-5" /></div>}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="p-1 -m-1 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <Body onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
            {error && <FormAlert onClose={onDismissError}>{error}</FormAlert>}
            {children}
          </div>
          {footer && <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl flex items-center justify-end gap-2 flex-shrink-0">{footer}</div>}
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
          {title && <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h4>}
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
          {optional && <span className="text-slate-400 font-normal ml-1">(optional)</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="mt-1 text-xs text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0" />{error}</p>
        : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold pointer-events-none">RM</span>
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
            className={`text-left p-3 rounded-lg border transition-colors ${active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {Icon && <Icon className={`w-4 h-4 ${active ? (opt.activeColor || 'text-indigo-600') : 'text-slate-400'}`} />}
              {opt.label}
            </div>
            {opt.description && <div className="text-[11px] text-slate-500 mt-0.5">{opt.description}</div>}
          </button>
        );
      })}
    </div>
  );
}

export function FormAlert({ type = 'error', children, onClose }) {
  const styles = type === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-800'
    : type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-indigo-50 border-indigo-200 text-indigo-800';
  return (
    <div className={`p-3 rounded-lg border text-sm flex items-start justify-between gap-2 ${styles}`}>
      <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{children}</div></div>
      {onClose && <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return <button type="submit" className={`inline-flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`} {...props}>{children}</button>;
}

export function SecondaryButton({ children, className = '', ...props }) {
  return <button type="button" className={`inline-flex items-center justify-center gap-2 h-10 px-4 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}
