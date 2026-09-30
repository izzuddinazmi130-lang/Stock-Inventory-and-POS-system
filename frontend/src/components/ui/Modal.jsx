import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn, focusRing } from './cn';
import { Alert } from './controls';

// ── Shared overlay behaviour ────────────────────────────────────────────────
const stack = [];          // open overlays, topmost last (Esc / focus trap only act on the top one)
let scrollLocks = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useOverlay(panelRef, { onClose, initialFocus = true }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const token = {};
    stack.push(token);
    const previouslyFocused = document.activeElement;

    // Lock page scroll without layout shift
    if (scrollLocks++ === 0) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    }

    // Move focus inside: [data-autofocus] first, then the first form control, then the panel
    if (initialFocus) {
      requestAnimationFrame(() => {
        const panel = panelRef.current;
        if (!panel || panel.contains(document.activeElement)) return;
        const target =
          panel.querySelector('[data-autofocus]') ||
          panel.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
          panel;
        target.focus({ preventScroll: true });
      });
    }

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
        if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(token), 1);
      if (--scrollLocks === 0) {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [panelRef, initialFocus]);
}

/** Keeps a closing overlay mounted long enough to play its exit animation. */
function usePresence(open, duration = 150) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => { setMounted(false); setClosing(false); }, duration);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return { mounted, closing };
}

const MODAL_SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * Dialog with a sticky header and footer and a scrolling body.
 * Render it conditionally ({show && <Modal …/>}) or keep it mounted and toggle `open` to get an exit animation.
 * `onSubmit` turns the body + footer into a <form>; `error` shows a failure message inside the dialog.
 *
 *   <Modal title="Edit product" onClose={close} onSubmit={save}
 *          footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit">Save</Button></>}>
 *     …fields…
 *   </Modal>
 */
export function Modal(props) {
  const { open = true } = props;
  const { mounted, closing } = usePresence(open);
  if (!mounted) return null;
  return createPortal(<ModalPanel {...props} closing={closing} />, document.body);
}

function ModalPanel({
  title, description, icon: Icon, iconTone = 'accent', onClose, onSubmit, footer, size = 'md', error, onDismissError,
  children, closing, closeOnBackdrop = true, bodyClassName, hideClose = false, className,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  useOverlay(panelRef, { onClose });

  const Body = onSubmit ? 'form' : 'div';
  const iconTones = {
    accent: 'bg-accent-soft text-accent',
    danger: 'bg-danger-soft text-danger-fg',
    warning: 'bg-warning-soft text-warning-fg',
    success: 'bg-success-soft text-success-fg',
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink/40 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in'
      )}
      onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'w-full bg-surface border border-line shadow-modal flex flex-col focus:outline-none',
          'max-h-[92vh] rounded-t-xl sm:rounded-xl',
          MODAL_SIZES[size] || MODAL_SIZES.md,
          closing ? 'animate-scale-out' : 'animate-scale-in',
          className
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-line-soft flex-shrink-0">
            {Icon && (
              <div className={cn('p-2 rounded-lg flex-shrink-0', iconTones[iconTone] || iconTones.accent)}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>}
              {description && <div id={descId} className="text-caption text-ink-muted mt-0.5">{description}</div>}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                className={cn('p-1.5 -m-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-sunken transition-colors', focusRing)}
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <Body onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className={cn('px-5 sm:px-6 py-5 overflow-y-auto space-y-6 flex-1', bodyClassName)}>
            {error && <Alert tone="danger" onClose={onDismissError}>{error}</Alert>}
            {children}
          </div>
          {footer && (
            <div className="px-5 sm:px-6 py-3.5 border-t border-line-soft bg-subtle/70 sm:rounded-b-xl flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
              {footer}
            </div>
          )}
        </Body>
      </div>
    </div>
  );
}

/**
 * Panel that slides in from the side (mobile navigation, detail views).
 *   <Drawer open={open} onClose={…} side="left" title="Menu">…</Drawer>
 */
export function Drawer({ open, ...props }) {
  const { mounted, closing } = usePresence(open, 200);
  if (!mounted) return null;
  return createPortal(<DrawerPanel {...props} closing={closing} />, document.body);
}

function DrawerPanel({ title, onClose, side = 'right', width = 'w-80', children, closing, footer, className }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlay(panelRef, { onClose, initialFocus: true });
  const fromLeft = side === 'left';
  return (
    <div
      className={cn('fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]', closing ? 'animate-fade-out' : 'animate-fade-in')}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={closing ? { transform: `translateX(${fromLeft ? '-100%' : '100%'})`, transition: 'transform 200ms cubic-bezier(0.2,0,0,1)' } : undefined}
        className={cn(
          'absolute top-0 bottom-0 max-w-[85vw] bg-surface shadow-modal flex flex-col focus:outline-none',
          width,
          fromLeft ? 'left-0 border-r border-line' : 'right-0 border-l border-line',
          !closing && (fromLeft ? 'animate-slide-in-left' : 'animate-slide-in-right'),
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-line-soft flex-shrink-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
            <button type="button" onClick={onClose} className={cn('p-1.5 -m-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-sunken', focusRing)} aria-label="Close">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line-soft p-4">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
