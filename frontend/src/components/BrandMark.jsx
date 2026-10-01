import React from 'react';
import { cn } from './ui/cn';
import logo from '../assets/brand/logo.png';
import logoMark from '../assets/brand/logo-mark.png';

/**
 * The company logo. `withName` shows the full HQ AS Tech lockup with the product subtitle;
 * without it only the square HQ mark is shown (collapsed sidebar, small spaces).
 */
export default function BrandMark({ className, withName = false, subtitle = 'Inventory & POS', size = 'md' }) {
  const lg = size === 'lg';
  if (!withName) {
    return (
      <span className={cn('inline-flex flex-shrink-0', className)}>
        <img src={logoMark} alt="HQ AS Tech" draggable="false" className={cn('logo-adaptive object-contain', lg ? 'w-12 h-12' : 'w-9 h-9')} />
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img src={logo} alt="HQ AS Tech" draggable="false" className={cn('logo-adaptive w-auto flex-shrink-0', lg ? 'h-14' : 'h-11')} />
      {subtitle && (
        <>
          <span aria-hidden="true" className="h-7 w-px bg-line" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted leading-tight">{subtitle}</span>
        </>
      )}
    </span>
  );
}
