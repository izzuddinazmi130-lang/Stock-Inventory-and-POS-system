import React from 'react';
import { cn } from './cn';

/**
 * White panel with a soft border.
 *   <Card><CardHeader title="Branches" actions={<Button …/>} /><CardBody>…</CardBody></Card>
 * `interactive` adds a hover lift for clickable cards; `as={Link} to="…"` makes the whole card a link.
 */
export default function Card({ as: Tag = 'div', interactive = false, className, children, ...props }) {
  return (
    <Tag
      className={cn(
        'bg-surface border border-line rounded-xl shadow-card',
        interactive && 'transition-[border-color,box-shadow,transform] duration-base ease-out hover:border-line-strong hover:shadow-popover hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
export { Card };

export function CardHeader({ title, description, icon: Icon, actions, children, className }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-soft', className)}>
      {children || (
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-sunken text-ink-secondary flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>}
            {description && <p className="text-caption text-ink-muted mt-0.5">{description}</p>}
          </div>
        </div>
      )}
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return <div className={cn('px-5 py-3.5 border-t border-line-soft bg-subtle/60 rounded-b-xl flex items-center justify-end gap-2', className)}>{children}</div>;
}
