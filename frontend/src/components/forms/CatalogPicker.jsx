import React from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';

// Searchable checklist of catalog products with a starting-stock box for each ticked product.
// selections: { [productId]: quantity }
export default function CatalogPicker({ products, loading, search, onSearch, selections, onToggle, onQuantity, emptyText }) {
  const q = search.trim().toLowerCase();
  const visible = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  const count = Object.keys(selections).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or SKU…"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className={`text-xs font-semibold whitespace-nowrap ${count ? 'text-indigo-600' : 'text-slate-400'}`}>{count} selected</span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading products…</div>
      ) : visible.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
          {products.length === 0 ? emptyText : 'No products match your search.'}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
          {visible.map(p => {
            const checked = p.id in selections;
            return (
              <div key={p.id} className={`px-3 py-2 flex items-center gap-3 text-sm ${checked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}>
                <button type="button" onClick={() => onToggle(p.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                  {checked ? <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{p.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      <span className="font-mono text-indigo-600">{p.sku}</span>
                      {p.category && <> · {p.category}</>}
                      {p.branch_count != null && <> · in {p.branch_count} branch{Number(p.branch_count) === 1 ? '' : 'es'}</>}
                    </span>
                  </span>
                </button>
                {checked && (
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-shrink-0">
                    Starting stock
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={selections[p.id]}
                      onChange={e => onQuantity(p.id, e.target.value)}
                      className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-500 mt-1.5">Starting stock can be 0 if you only want the product listed in this branch.</p>
    </div>
  );
}
