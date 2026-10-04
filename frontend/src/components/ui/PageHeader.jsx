import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn, focusRing } from './cn';
import { useAuth } from '../../context/AuthContext';
import { sectionFor } from '../navigation';

/**
 * Breadcrumb trail: "Sidebar section › Page › Sub-page". The section (the sidebar heading the page sits under,
 * e.g. "Inventory") is added automatically and is plain text; every step before the current page is a link.
 *   <Breadcrumbs items={[{ label: 'Products', to: '/products' }, { label: 'Add product' }]} />
 * With no items it shows the section and the sidebar item for this page ("Inventory › Products").
 * `section` overrides the automatic section (for pages reached from another part of the app).
 */
export function Breadcrumbs({ items, section, className }) {
  const { user } = useAuth() || {};
  const { pathname } = useLocation();
  const auto = sectionFor(user, pathname);
  const trail = items?.length ? items : (auto.item ? [{ label: auto.item.label }] : []);
  const group = section ?? auto.group;
  if (!trail.length) return null;
  const crumbs = group ? [{ label: group, section: true }, ...trail] : trail;
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-2', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-caption text-ink-muted">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1 min-w-0 max-w-full">
              {crumb.to && !last ? (
                <Link to={crumb.to} className={cn('rounded truncate font-medium text-ink-secondary hover:text-accent-fg hover:underline underline-offset-2 transition-colors', focusRing)}>{crumb.label}</Link>
              ) : (
                <span className={cn('truncate', last && 'text-ink', crumb.section && 'text-ink-muted')} aria-current={last ? 'page' : undefined}>{crumb.label}</span>
              )}
              {!last && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-ink-subtle" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Top of every page: breadcrumb trail, title, one-line description, actions on the right.
 *   <PageHeader title="Add product" description="…" breadcrumbs={[{ label: 'Products', to: '/products' }, { label: 'Add product' }]}
 *               actions={<Button icon={Plus}>Add product</Button>} />
 * Without `breadcrumbs` the trail is "Section › Page" from the sidebar; pass `breadcrumbs={false}` to hide it.
 */
export default function PageHeader({ title, description, breadcrumbs, section, back, actions, meta, className }) {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs !== false && <Breadcrumbs items={breadcrumbs || undefined} section={section} />}
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
