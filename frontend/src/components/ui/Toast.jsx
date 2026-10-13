import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn, focusRing } from './cn';
import { t as tr } from '../../i18n';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, iconCls: 'text-success', bar: 'bg-success' },
  error: { icon: XCircle, iconCls: 'text-danger', bar: 'bg-danger' },
  warning: { icon: AlertTriangle, iconCls: 'text-warning', bar: 'bg-warning' },
  info: { icon: Info, iconCls: 'text-info', bar: 'bg-info' },
};

let nextId = 1;

/**
 * Toasts (replaces window.alert). Bottom-right on desktop, bottom full-width on phones.
 *   const { addToast, toast } = useToast();
 *   addToast('Saved', 'success');          // older API, still supported
 *   toast.error('Could not save', { title: 'Upload failed', duration: 6000 });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const addToast = useCallback((message, type = 'success', options = {}) => {
    const id = nextId++;
    const tone = TONES[type] ? type : 'info';
    const duration = options.duration ?? (tone === 'error' ? 6000 : 4000);
    setToasts(prev => [...prev.slice(-4), { id, message, type: tone, title: options.title, duration }]);
    return id;
  }, []);

  const toast = useMemo(() => ({
    success: (m, o) => addToast(m, 'success', o),
    error: (m, o) => addToast(m, 'error', o),
    warning: (m, o) => addToast(m, 'warning', o),
    info: (m, o) => addToast(m, 'info', o),
    dismiss,
  }), [addToast, dismiss]);

  const value = useMemo(() => ({ addToast, toast, dismiss }), [addToast, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-[60] bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-[380px] flex flex-col gap-2 pointer-events-none">
        {/* polite region for normal toasts, assertive for errors */}
        <div aria-live="polite" className="flex flex-col gap-2">
          {toasts.filter(t => t.type !== 'error').map(t => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
        <div aria-live="assertive" className="flex flex-col gap-2">
          {toasts.filter(t => t.type === 'error').map(t => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const tone = TONES[toast.type];
  const Icon = tone.icon;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const t = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative overflow-hidden flex items-start gap-3 bg-surface border border-line rounded-xl shadow-popover pl-4 pr-3 py-3 animate-toast-in"
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-px', tone.iconCls)} aria-hidden="true" />
      <div className="flex-1 min-w-0 text-sm">
        {toast.title && <p className="font-semibold text-ink">{toast.title}</p>}
        <p className={toast.title ? 'text-ink-secondary mt-0.5' : 'text-ink'}>{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={cn('p-1 -m-1 rounded-md text-ink-muted hover:text-ink hover:bg-sunken transition-colors', focusRing)}
        aria-label={tr('Dismiss notification')}
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      {/* time-left hint */}
      <span
        aria-hidden="true"
        className={cn('absolute left-0 bottom-0 h-0.5 w-full origin-left opacity-60 animate-progress', tone.bar)}
        style={{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
      />
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  // No provider: keep callers working without crashing
  const noop = () => {};
  return { addToast: noop, dismiss: noop, toast: { success: noop, error: noop, warning: noop, info: noop, dismiss: noop } };
}

export default ToastProvider;
