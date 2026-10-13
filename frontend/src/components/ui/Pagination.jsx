import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import Button from './Button';
import { t } from '../../i18n';

/**
 * Page controls for a list.
 *   <Pagination page={page} totalPages={pages} onChange={setPage} summary="Showing 1–25 of 140" />
 */
export function Pagination({ page, totalPages, onChange, summary, prevLabel = t('Previous'), nextLabel = t('Next'), className }) {
  if (!totalPages || totalPages <= 1) return summary ? <div className={cn('px-4 py-3 text-caption text-ink-muted', className)}>{summary}</div> : null;
  return (
    <nav aria-label={t('Pagination')} className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line-soft', className)}>
      <span className="text-caption text-ink-muted">
        {summary || <>{t('Page')}{' '}<span className="tabular-nums text-ink">{page}</span>{' '}{t('of')}{' '}<span className="tabular-nums text-ink">{totalPages}</span></>}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          {prevLabel}
        </Button>
        <Button variant="secondary" size="sm" iconRight={ChevronRight} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          {nextLabel}
        </Button>
      </div>
    </nav>
  );
}

export default Pagination;
