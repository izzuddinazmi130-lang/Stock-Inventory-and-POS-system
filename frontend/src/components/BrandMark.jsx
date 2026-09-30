import React from 'react';
import { cn } from './ui/cn';

/** The app's logo mark: a stacked-box glyph on the accent colour. */
export default function BrandMark({ className, withName = false, subtitle = 'Inventory & POS' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shadow-xs flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 4 7l8 4 8-4-8-4Z" />
          <path d="m4 12 8 4 8-4" />
          <path d="m4 17 8 4 8-4" />
        </svg>
      </span>
      {withName && (
        <span className="min-w-0 leading-tight">
          <span className="block font-display font-semibold text-[15px] text-ink tracking-tight">HQ Inventory</span>
          {subtitle && <span className="block text-[11px] text-ink-muted">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}
