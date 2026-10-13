import React from 'react';
import { AlertOctagon, Inbox, RefreshCw } from 'lucide-react';
import { cn } from './cn';
import Button from './Button';
import { t } from '../../i18n';

/**
 * Friendly "nothing here" block.
 *   <EmptyState icon={PackageSearch} title="No products yet" description="Add your first product to start selling."
 *               action={<Button icon={Plus} to="/products/add">Add product</Button>} />
 * `message` / `action` + `actionLabel` (older API) still work.
 */
export default function EmptyState({ icon: Icon = Inbox, title, description, message, action, actionLabel, compact = false, className }) {
  const heading = title || message || t('Nothing here yet');
  let actionNode = action;
  if (typeof action === 'function') {
    actionNode = actionLabel ? <Button variant="secondary" size="sm" onClick={action}>{actionLabel}</Button> : null;
  }
  return (
    <div className={cn('flex flex-col items-center justify-center text-center animate-fade-in', compact ? 'py-8 px-4' : 'py-14 px-6', className)}>
      <div className={cn('rounded-full bg-sunken flex items-center justify-center mb-3 ring-8 ring-subtle', compact ? 'w-10 h-10' : 'w-12 h-12')}>
        <Icon className={cn('text-ink-muted', compact ? 'w-5 h-5' : 'w-6 h-6')} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-ink">{heading}</p>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-sm">{description}</p>}
      {actionNode && <div className="mt-4">{actionNode}</div>}
    </div>
  );
}
export { EmptyState };

/** Loading failed: explain and offer a retry. */
export function ErrorState({ title = t('Something went wrong'), description, onRetry, compact = false, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center animate-fade-in', compact ? 'py-8 px-4' : 'py-14 px-6', className)}>
      <div className="w-12 h-12 rounded-full bg-danger-soft flex items-center justify-center mb-3 ring-8 ring-danger-soft/50">
        <AlertOctagon className="w-6 h-6 text-danger-fg" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-sm">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4">
          {t('Try again')}
        </Button>
      )}
    </div>
  );
}
