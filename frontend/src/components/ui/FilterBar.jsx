import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from './cn';
import Button from './Button';
import { t } from '../../i18n';

/**
 * Row of filters above a list. Children wrap on small screens; `actions` sit on the right.
 *   <FilterBar actions={<Button variant="ghost" onClick={reset}>Reset</Button>}>
 *     <SearchInput … wrapperClassName="flex-1 min-w-[14rem]" /> <Select …/>
 *   </FilterBar>
 */
export default function FilterBar({ children, actions, className, onReset, resetVisible = true }) {
  return (
    <div className={cn('bg-surface border border-line rounded-xl shadow-card p-3 mb-4 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center [&>*:first-child]:col-span-2', className)}>
      {children}
      {(actions || (onReset && resetVisible)) && (
        <div className="col-span-2 flex items-center justify-end gap-2 md:ml-auto">
          {onReset && resetVisible && (
            <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={onReset}>{t('Reset filters')}</Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
export { FilterBar };
