import React, { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { cn } from './cn';
import { SkeletonRows } from './Skeleton';
import EmptyState, { ErrorState } from './EmptyState';
import { t } from '../../i18n';

const TableContext = createContext({ dense: false });

/**
 * Data table. On phones (< 640px) each row becomes a stacked card: the first cell is the title and every
 * other cell shows its column heading as a label (`stack={false}` keeps the scrolling table instead).
 * From 640px up it is a normal table that scrolls sideways if it is wider than its card (`minWidth`).
 * Give `maxHeight` for a scrolling body with a sticky header.
 *   <Table>
 *     <THead><TR><TH>Product</TH><TH numeric>Qty</TH></TR></THead>
 *     <TBody>
 *       <TableState colSpan={2} loading={loading} error={error} empty={rows.length === 0} … />
 *       {rows.map((r, i) => <TR key={r.id} index={i}><TD>{r.name}</TD><TD numeric>{r.qty}</TD></TR>)}
 *     </TBody>
 *   </Table>
 */
export function Table({ children, dense = false, stack = true, className, tableClassName, minWidth, maxHeight }) {
  const tableRef = useRef(null);

  // Give every body cell its column heading as data-label, used as the label in the stacked phone layout.
  // Runs after every render (rows come and go with filters and paging).
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!stack || !table) return;
    const headings = [];
    table.querySelectorAll('thead tr:last-child th').forEach(th => {
      const span = th.colSpan || 1;
      for (let i = 0; i < span; i++) headings.push(th.textContent.trim());
    });
    table.querySelectorAll('tbody tr').forEach(tr => {
      let col = 0;
      Array.from(tr.children).forEach(td => {
        const span = td.colSpan || 1;
        if (span === 1 && headings[col]) td.setAttribute('data-label', headings[col]);
        else td.removeAttribute('data-label');
        col += span;
      });
    });
  });

  return (
    <TableContext.Provider value={{ dense }}>
      <div className={cn('overflow-x-auto', maxHeight && 'overflow-y-auto', className)} style={maxHeight ? { maxHeight } : undefined}>
        <table
          ref={tableRef}
          className={cn('w-full text-sm border-separate border-spacing-0', stack && 'table-stack', minWidth && 'table-min', tableClassName)}
          style={minWidth ? { '--table-min-width': typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : undefined}
        >
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
}

export function THead({ children, className }) {
  return <thead className={cn('sticky top-0 z-10', className)}>{children}</thead>;
}

export function TBody({ children, className }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TH({ numeric = false, className, children, ...props }) {
  const { dense } = useContext(TableContext);
  return (
    <th
      scope="col"
      className={cn(
        'bg-subtle px-4 text-table-head uppercase text-ink-muted border-b border-line whitespace-nowrap',
        dense ? 'py-2' : 'py-2.5',
        numeric ? 'text-right' : 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

/**
 * Row. `onClick` makes it keyboard-clickable; `highlight` flashes it (e.g. after a live update);
 * `index` staggers the first-load fade (first 8 rows only).
 */
export function TR({ onClick, highlight = false, index, selected = false, className, children, ...props }) {
  const clickable = Boolean(onClick);
  const stagger = typeof index === 'number' && index < 8;
  return (
    <tr
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick(e); } : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={cn(
        'group/row transition-colors duration-fast [&>td]:transition-colors [&>td]:duration-fast',
        'hover:[&>td]:bg-subtle',
        clickable && 'cursor-pointer focus-visible:outline-none focus-visible:[&>td]:bg-accent-soft/60',
        selected && '[&>td]:bg-accent-soft/50',
        highlight && '[&>td]:animate-row-flash',
        stagger && 'animate-fade-in', // opacity only: transforms on <tr> are unreliable across browsers
        className
      )}
      style={stagger ? { animationDelay: `${index * 20}ms` } : undefined}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({ numeric = false, className, children, ...props }) {
  const { dense } = useContext(TableContext);
  return (
    <td
      className={cn(
        'px-4 border-b border-line-soft text-ink align-middle',
        dense ? 'py-2' : 'py-3',
        numeric && 'text-right tabular-nums whitespace-nowrap',
        className
      )}
      {...props}
    >
      {/* `contents` = no box on wider screens; on phones it becomes the value block beside the label */}
      <div className="td-content contents">{children}</div>
    </td>
  );
}

/**
 * Loading / error / empty row for a table body. Renders nothing when there is data to show.
 */
export function TableState({
  colSpan, loading, error, empty, onRetry, rows = 5,
  emptyIcon, emptyTitle = t('Nothing to show'), emptyDescription, emptyAction, errorTitle = t('Could not load this list'),
}) {
  if (loading) return <SkeletonRows rows={rows} cols={colSpan} />;
  if (error) {
    return (
      <tr>
        <td colSpan={colSpan}>
          <ErrorState compact title={errorTitle} description={typeof error === 'string' ? error : undefined} onRetry={onRetry} />
        </td>
      </tr>
    );
  }
  if (empty) {
    return (
      <tr>
        <td colSpan={colSpan}>
          <EmptyState compact icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </td>
      </tr>
    );
  }
  return null;
}

export default Table;
