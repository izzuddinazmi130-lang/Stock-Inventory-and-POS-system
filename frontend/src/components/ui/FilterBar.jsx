import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from './cn';
import Button from './Button';

/**
 * Row of filters above a list. Children wrap on small screens; `actions` sit on the right.
 *   <FilterBar actions={<Button variant="ghost" onClick={reset}>Reset</Button>}>
 *     <SearchInput … wrapperClassName="flex-1 min-w-[14rem]" /> <Select …/>
 *   </FilterBar>
 */
export default function FilterBar({ children, actions, className, onReset, resetVisible = true }) {
  return (
    <div className={cn('bg-surface border border-line rounded-xl shadow-card p-3 mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center', className)}>
      {children}
      {(actions || (onReset && resetVisible)) && (
        <div className="flex items-center gap-2 md:ml-auto">
          {onReset && resetVisible && (
            <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={onReset}>Reset filters</Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
export { FilterBar };
