import React, { createContext, forwardRef, useContext, useId } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Search, X, XCircle } from 'lucide-react';
import { cn, focusRing } from './cn';

// ── Shared input styling ────────────────────────────────────────────────────
export const inputClass = cn(
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-xs',
  'placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-out',
  'hover:border-line-strong focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30',
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted disabled:hover:border-line'
);
const errorClass = 'border-danger hover:border-danger focus:border-danger focus:ring-danger/25';
const CONTROL_SIZES = { sm: 'h-8 text-caption', md: 'h-10', lg: 'h-12 text-base' };

/** Date value → 'YYYY-MM-DD' in local time for <input type="date"> (toISOString() would shift it to UTC). */
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A Field hands its generated id / hint id / error state to the control inside it
const FieldContext = createContext(null);
function useFieldProps(props) {
  const field = useContext(FieldContext);
  if (!field) return props;
  return {
    id: props.id ?? field.id,
    'aria-describedby': props['aria-describedby'] ?? field.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field.error ? true : undefined),
    // aria only: browser validation stays exactly as each form had it
    'aria-required': props['aria-required'] ?? (field.required || undefined),
    ...props,
    error: props.error ?? field.error,
  };
}

/**
 * Label + control + hint or error. The control gets the label's id automatically.
 *   <Field label="Product name" required error={errors.name}><Input value=… /></Field>
 */
export function Field({ label, required, optional, hint, error, children, className, labelAction }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const message = error || hint;
  return (
    <FieldContext.Provider value={{ id, describedBy: message ? hintId : undefined, error: Boolean(error), required }}>
      <div className={className}>
        {label && (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor={id} className="block text-sm font-medium text-ink">
              {label}
              {required && <span className="text-danger-fg ml-0.5" aria-hidden="true">*</span>}
              {optional && <span className="text-ink-muted font-normal ml-1">(optional)</span>}
            </label>
            {labelAction}
          </div>
        )}
        {children}
        {error ? (
          <p id={hintId} className="mt-1.5 text-caption text-danger-fg flex items-center gap-1 animate-fade-in">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-caption text-ink-muted">{hint}</p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export const Input = forwardRef(function Input(rawProps, ref) {
  const { error, size = 'md', className, ...props } = useFieldProps(rawProps);
  return <input ref={ref} className={cn(inputClass, CONTROL_SIZES[size], error && errorClass, className)} {...props} />;
});

/** Native <select> (keeps mobile pickers and keyboard behaviour) with the app's styling. */
export const Select = forwardRef(function Select(rawProps, ref) {
  const { error, size = 'md', className, wrapperClassName, children, ...props } = useFieldProps(rawProps);
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(inputClass, CONTROL_SIZES[size], 'appearance-none pr-9 cursor-pointer', error && errorClass, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(rawProps, ref) {
  const { error, className, rows = 3, ...props } = useFieldProps(rawProps);
  return <textarea ref={ref} rows={rows} className={cn(inputClass, 'h-auto py-2 leading-relaxed', error && errorClass, className)} {...props} />;
});

/** Number input with an "RM" prefix. Empty stays empty (placeholder 0.00) so users don't have to delete a 0 first. */
export const MoneyInput = forwardRef(function MoneyInput(rawProps, ref) {
  const { error, className, size = 'md', ...props } = useFieldProps(rawProps);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-caption font-semibold pointer-events-none">RM</span>
      <input
        ref={ref}
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        inputMode="decimal"
        className={cn(inputClass, CONTROL_SIZES[size], 'pl-10 font-mono tabular-nums', error && errorClass, className)}
        {...props}
      />
    </div>
  );
});

/**
 * Search box with a leading icon and a clear button.
 *   <SearchInput value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" />
 */
export const SearchInput = forwardRef(function SearchInput({ value, onChange, onClear, className, wrapperClassName, size = 'md', ...props }, ref) {
  const clear = () => {
    if (onClear) onClear();
    else onChange?.({ target: { value: '' } });
  };
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={onChange}
        className={cn(inputClass, CONTROL_SIZES[size], 'pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden', className)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          className={cn('absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-muted hover:text-ink hover:bg-sunken transition-colors', focusRing)}
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
});

/** Checkbox with an optional label and description. */
export const Checkbox = forwardRef(function Checkbox({ label, description, className, ...props }, ref) {
  const id = useId();
  const input = (
    <input
      ref={ref}
      id={props.id || id}
      type="checkbox"
      className={cn(
        'h-4 w-4 flex-shrink-0 rounded border-line-strong accent-accent cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2',
        !label && className
      )}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label htmlFor={props.id || id} className={cn('flex items-start gap-2.5 cursor-pointer select-none', className)}>
      <span className="mt-0.5">{input}</span>
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-caption text-ink-muted mt-0.5">{description}</span>}
      </span>
    </label>
  );
});

/** A titled group of fields inside a form. */
export function FormSection({ title, description, children, className, actions }) {
  return (
    <section className={className}>
      {(title || description) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h4 className="text-sm font-semibold text-ink">{title}</h4>}
            {description && <p className="text-caption text-ink-muted mt-0.5">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Button-style choice between a few options (replaces confusing <select>s for 2–4 choices). */
export function ChoiceCards({ value, onChange, options, columns = 2, name }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns] || 'sm:grid-cols-2';
  return (
    <div className={cn('grid grid-cols-1 gap-2', cols)} role="radiogroup" aria-label={name}>
      {options.map(opt => {
        const active = String(value) === String(opt.value);
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'text-left p-3 rounded-lg border transition-[background-color,border-color,box-shadow] duration-fast ease-out',
              focusRing,
              active ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-line-strong hover:bg-subtle'
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              {Icon && <Icon className={cn('w-4 h-4', active ? opt.activeColor || 'text-accent' : 'text-ink-muted')} aria-hidden="true" />}
              {opt.label}
            </span>
            {opt.description && <span className="block text-caption text-ink-muted mt-0.5">{opt.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

const ALERT_TONES = {
  danger: { cls: 'bg-danger-soft border-danger-line text-danger-fg', icon: XCircle },
  warning: { cls: 'bg-warning-soft border-warning-line text-warning-fg', icon: AlertTriangle },
  success: { cls: 'bg-success-soft border-success-line text-success-fg', icon: CheckCircle2 },
  info: { cls: 'bg-info-soft border-info-line text-info-fg', icon: Info },
  accent: { cls: 'bg-accent-soft border-accent-line text-accent-fg', icon: Info },
};

/**
 * Inline message box.
 *   <Alert tone="warning" title="Heads up">Some items have no price.</Alert>
 */
export function Alert({ tone = 'info', title, children, onClose, icon, className, action }) {
  const t = ALERT_TONES[tone] || ALERT_TONES.info;
  const Icon = icon || t.icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('p-3 rounded-lg border text-sm flex items-start gap-2.5 animate-fade-in', t.cls, className)}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-95')}>{children}</div>}
      </div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} className={cn('p-0.5 -m-0.5 rounded-md opacity-70 hover:opacity-100 transition-opacity', focusRing)} aria-label="Dismiss">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Older name for Alert (type="error" | "warning" | "info"). */
export function FormAlert({ type = 'error', ...props }) {
  const tone = type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'accent';
  return <Alert tone={tone} {...props} />;
}
