import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn, focusRing } from './cn';

/**
 * Top of every page: optional breadcrumb or back link, title, one-line description, actions on the right.
 *   <PageHeader title="Products" description="…" breadcrumbs={[{ label: 'Inventory', to: '/products' }, { label: 'Add' }]}
 *               actions={<Button icon={Plus}>Add product</Button>} />
 */
export default function PageHeader({ title, description, breadcrumbs, back, actions, meta, className }) {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs?.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-caption text-ink-muted">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1 min-w-0">
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className={cn('rounded hover:text-ink transition-colors truncate', focusRing)}>{crumb.label}</Link>
                  ) : (
                    <span className={cn('truncate', last && 'text-ink-secondary')} aria-current={last ? 'page' : undefined}>{crumb.label}</span>
                  )}
                  {!last && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-ink-subtle" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {back && (
            <Link
              to={back.to || back}
              className={cn('mt-0.5 p-2 -ml-2 rounded-lg text-ink-muted hover:text-ink hover:bg-sunken transition-colors flex-shrink-0', focusRing)}
              aria-label={back.label || 'Back'}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {description && <p className="text-sm text-ink-muted mt-1 max-w-2xl">{description}</p>}
            {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
export { PageHeader };
