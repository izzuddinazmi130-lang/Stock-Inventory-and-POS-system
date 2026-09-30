import React from 'react';
import { Camera, ImageUp, Package, RefreshCw, ScanLine, Search, X } from 'lucide-react';
import { Button, ButtonBase, Card, EmptyState, IconButton, Input, Select, Skeleton, cn } from '../../../components/ui';

const rm = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;

/**
 * Left side of the POS: one big scan/search box, camera and photo scanning, category chips and product tiles.
 * The camera viewport keeps id="pos-camera-viewport" because html5-qrcode renders into it by id.
 */
export default function ProductFinder({
  searchInputRef, fileInputRef, search, setSearch, onSubmit, looking,
  cameraOpen, setCameraOpen, cameraStatus, cameras, selectedCamId, setSelectedCamId, onImage,
  categories, category, setCategory,
  productsLoading, products, filteredProducts, maxTiles, toCartProduct, cartQtyById, isSale, unitPrice, onAdd,
}) {
  return (
    <Card as="section" className="min-w-0">
      <div className="p-4 border-b border-line-soft space-y-3">
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={searchInputRef}
              autoFocus
              size="lg"
              icon={ScanLine}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Scan a barcode, or search by name or SKU…"
              className="bg-subtle focus:bg-surface pr-12"
              aria-label="Scan or search products"
            />
            {looking
              ? <RefreshCw className="w-4 h-4 text-accent animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" aria-label="Looking up" />
              : search && (
                <IconButton
                  icon={X}
                  label="Clear search"
                  tooltip={false}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                />
              )}
          </div>
          <Button
            variant={cameraOpen ? 'primary' : 'secondary'}
            size="lg"
            icon={Camera}
            className={cn('h-12 px-3 sm:px-4', cameraOpen && 'bg-ink hover:bg-ink-hover')}
            onClick={() => setCameraOpen(o => !o)}
            aria-pressed={cameraOpen}
          >
            <span className="hidden sm:inline">Camera</span>
          </Button>
          <IconButton icon={ImageUp} label="Scan a QR code from a photo" variant="secondary" size="lg" className="h-12 w-12" onClick={() => fileInputRef.current?.click()} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => onImage(e.target.files?.[0])} />
        </form>

        {cameraOpen && (
          <div className="rounded-lg overflow-hidden border border-line bg-ink animate-fade-in">
            <div id="pos-camera-viewport" className="w-full min-h-[240px]" />
            <div className="flex items-center justify-between gap-2 px-3 py-2 text-caption text-white/80">
              <span className="truncate" aria-live="polite">{cameraStatus}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {cameras.length > 1 && (
                  <Select size="sm" value={selectedCamId} onChange={e => setSelectedCamId(e.target.value)} aria-label="Camera" className="max-w-[10rem] bg-ink-hover border-ink-secondary text-white">
                    {cameras.map(c => <option key={c.id} value={c.id}>{c.label || 'Camera'}</option>)}
                  </Select>
                )}
                <Button size="sm" variant="secondary" onClick={() => setCameraOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        {categories.length > 2 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1" role="group" aria-label="Category">
            {categories.map(c => (
              <ButtonBase
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap border',
                  category === c ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-secondary border-line hover:border-line-strong hover:text-ink'
                )}
              >
                {c}
              </ButtonBase>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[7.5rem] rounded-lg" />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState icon={Package} title="No products in this branch yet" description="Add products or receive stock to start selling." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No products match “${search}”`}
            description={<>Press <kbd className="px-1.5 py-0.5 rounded border border-line-strong text-caption">Enter</kbd> to look the code up anyway.</>}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.slice(0, maxTiles).map((p, i) => {
                const item = toCartProduct(p);
                const inCart = cartQtyById[item.id] || 0;
                const soldOut = isSale && item.in_stock - inCart <= 0;
                const low = item.in_stock > 0 && item.in_stock <= (parseInt(p.minimum_quantity ?? p.min_quantity ?? 5, 10) || 0);
                return (
                  <ButtonBase
                    key={`${p.id}-${p.branch_id}`}
                    onClick={() => onAdd(p)}
                    disabled={soldOut}
                    style={i < 8 ? { animationDelay: `${i * 20}ms` } : undefined}
                    className={cn(
                      'relative text-left p-3 rounded-lg border flex flex-col gap-1.5 min-h-[7.5rem] active:scale-[0.98] animate-fade-in',
                      inCart ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line bg-surface hover:border-accent-line hover:shadow-card hover:-translate-y-px',
                      'disabled:opacity-50 disabled:hover:shadow-none disabled:hover:translate-y-0'
                    )}
                    aria-label={`${item.name}${item.size ? `, size ${item.size}` : ''}, ${rm(unitPrice(item))}${inCart ? `, ${inCart} in the order` : ''}`}
                  >
                    {inCart > 0 && (
                      <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-accent text-white text-caption font-semibold flex items-center justify-center shadow-xs animate-scale-in tabular-nums">{inCart}</span>
                    )}
                    <span className="text-sm font-medium text-ink leading-snug line-clamp-2">{item.name}</span>
                    {(item.size || item.colour) && (
                      <span className="text-caption text-ink-muted truncate">{[item.size && `Size ${item.size}`, item.colour].filter(Boolean).join(' · ')}</span>
                    )}
                    <span className="mt-auto">
                      <span className="block text-base font-semibold text-ink tabular-nums whitespace-nowrap">{rm(unitPrice(item))}</span>
                      <span className={cn('block text-caption font-medium whitespace-nowrap tabular-nums', item.in_stock <= 0 ? 'text-danger-fg' : low ? 'text-warning-fg' : 'text-ink-muted')}>
                        {item.in_stock <= 0 ? 'Out of stock' : `${item.in_stock} left`}
                      </span>
                    </span>
                  </ButtonBase>
                );
              })}
            </div>
            {filteredProducts.length > maxTiles && (
              <p className="text-caption text-ink-muted text-center mt-3">Showing {maxTiles} of {filteredProducts.length}. Type in the search box to narrow down.</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
