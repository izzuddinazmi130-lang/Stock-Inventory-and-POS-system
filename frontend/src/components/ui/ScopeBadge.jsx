import React from 'react';
import { Globe2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from './cn';
import { businessDotClass } from './Badge';

/**
 * Where the signed-in user is working: "Business · Branch" for branch admins, "HQ · All businesses" for super admins.
 * Purely informational: the server enforces the scope.
 */
export default function ScopeBadge({ className, compact = false }) {
  const { user } = useAuth();
  if (!user) return null;
  const isSuper = user.role === 'super_admin';
  const business = user.business_name || 'Your business';
  const branch = user.branch_name || 'Your branch';
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-sunken text-caption font-medium text-ink-secondary max-w-full', className)}
      title={isSuper ? 'Head office: all businesses and branches' : `${business} · ${branch}`}
    >
      {isSuper ? (
        <Globe2 className="w-3.5 h-3.5 text-accent flex-shrink-0" aria-hidden="true" />
      ) : (
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', businessDotClass({ name: business, id: user.business_id }))} aria-hidden="true" />
      )}
      <span className="truncate">
        {isSuper ? (compact ? 'HQ' : 'HQ · All businesses') : (
          <>
            <span className={cn(compact && 'hidden sm:inline')}>{business} · </span>{branch}
          </>
        )}
      </span>
    </span>
  );
}
export { ScopeBadge };
