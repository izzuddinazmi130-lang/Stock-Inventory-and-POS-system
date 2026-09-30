import React, { cloneElement, isValidElement, useId } from 'react';
import { cn } from './cn';

const SIDES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2 origin-top',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2 origin-right',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2 origin-left',
};

/**
 * Small dark label shown on hover and keyboard focus (CSS only, no JS positioning).
 *   <Tooltip content="Print label"><IconButton … /></Tooltip>
 */
export function Tooltip({ content, side = 'top', children, className }) {
  const id = useId();
  if (!content) return children;
  const child = isValidElement(children) ? cloneElement(children, { 'aria-describedby': id }) : children;
  return (
    <span className={cn('relative inline-flex group/tooltip', className)}>
      {child}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-caption font-medium text-white shadow-popover',
          // Out of the layout until shown, so a hidden tooltip near the screen edge can't cause sideways scrolling
          'hidden group-hover/tooltip:block group-has-[:focus-visible]/tooltip:block animate-fade-in [animation-delay:250ms]',
          SIDES[side] || SIDES.top
        )}
      >
        {content}
      </span>
    </span>
  );
}

export default Tooltip;
