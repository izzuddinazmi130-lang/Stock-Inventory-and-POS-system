import React from 'react';
import { Package } from 'lucide-react';
import { Checkbox, EmptyState, Input, SearchInput, Skeleton, cn } from '../ui';

// Searchable checklist of catalog products with a starting-stock box for each ticked product.
// selections: { [productId]: quantity }
export default function CatalogPicker({ products, loading, search, onSearch, selections, onToggle, onQuantity, emptyText }) {
  const q = search.trim().toLowerCase();
  const visible = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  const count = Object.keys(selections).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <SearchInput
          wrapperClassName="flex-1"
          size="sm"
          placeholder="Search by product name or SKU…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          aria-label="Search the catalog"
        />
        <span className={cn('text-caption font-semibold whitespace-nowrap tabular-nums', count ? 'text-accent' : 'text-ink-muted')}>{count} selected</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl"><EmptyState compact icon={Package} title={emptyText} /></div>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y divide-line-soft border border-line rounded-xl bg-surface">
          {visible.map(p => {
            const checked = p.id in selections;
            return (
              <li key={p.id} className={cn('px-3 py-2.5 flex items-center gap-3 text-sm transition-colors', checked ? 'bg-accent-soft/60' : 'hover:bg-subtle')}>
                <Checkbox
                  className="flex-1 min-w-0"
                  checked={checked}
                  onChange={() => onToggle(p.id)}
                  label={<span className="block truncate font-medium">{p.name}</span>}
                  description={<>
                    <span className="font-mono text-accent">{p.sku}</span>
                    {p.category && <> · {p.category}</>}
                    {p.branch_count != null && <> · in {p.branch_count} branch{Number(p.branch_count) === 1 ? '' : 'es'}</>}
                  </>}
                />
                {checked && (
                  <label className="flex items-center gap-1.5 text-caption text-ink-muted flex-shrink-0 animate-fade-in">
                    Starting stock
                    <Input
                      type="number"
                      size="sm"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={selections[p.id]}
                      onChange={e => onQuantity(p.id, e.target.value)}
                      className="w-20 px-2 font-mono"
                      aria-label={`Starting stock for ${p.name}`}
                    />
                  </label>
                )}
              </li>
            );
          })}
          {visible.length === 0 && <li><EmptyState compact title="No products match that search" /></li>}
        </ul>
      )}
      <p className="text-caption text-ink-muted mt-1.5">Starting stock can be 0 if you only want the product listed in this branch.</p>
    </div>
  );
}
