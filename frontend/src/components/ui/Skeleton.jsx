import React from 'react';
import { cn } from './cn';

/** Grey shimmering placeholder. Size it with classes: <Skeleton className="h-4 w-32" /> */
export function Skeleton({ className, ...props }) {
  return <div aria-hidden="true" className={cn('skeleton h-4 w-full', className)} {...props} />;
}

/** A few lines of text. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Table rows while data loads. Use inside <tbody>. */
export function SkeletonRows({ rows = 5, cols = 4 }) {
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-5/6', 'w-2/5'];
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3.5 border-b border-line-soft">
              <Skeleton className={cn('h-3.5', widths[(r + c) % widths.length])} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Card-shaped placeholder. */
export function SkeletonCard({ className, lines = 3 }) {
  return (
    <div className={cn('bg-surface border border-line rounded-xl p-5', className)} aria-hidden="true">
      <Skeleton className="h-4 w-1/3 mb-4" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** KPI card placeholder. */
export function SkeletonKpi({ className }) {
  return (
    <div className={cn('bg-surface border border-line rounded-xl p-5', className)} aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-20 mt-4" />
      <Skeleton className="h-3 w-28 mt-2" />
    </div>
  );
}

export default Skeleton;
