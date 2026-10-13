import React from 'react';
import { AlertTriangle, Building2, PackageX, Upload, X, Maximize2, ImageOff, FileText } from 'lucide-react';
import {
  Modal, Button, ButtonBase, Field, FormSection, Input, Select, Textarea, MoneyInput, SearchInput, Badge, EmptyState, Skeleton, cn,
} from '../../../components/ui';
import { t, locale } from '../../../i18n';

export const REASON_CATEGORIES = [
  { value: 'transit_damage', label: t('Transit damage'), tone: 'warning' },
  { value: 'breakage', label: t('Breakage / impact'), tone: 'danger' },
  { value: 'water_damage', label: t('Water / weather'), tone: 'info' },
  { value: 'expired', label: t('Expired'), tone: 'warning' },
  { value: 'manufacturing_defect', label: t('Manufacturing defect'), tone: 'violet' },
  { value: 'other', label: t('Other / written off'), tone: 'neutral' },
];

export function getCategoryMeta(value) {
  return REASON_CATEGORIES.find(c => c.value === value) || { value, label: value || t('Other'), tone: 'neutral' };
}

export function ReasonBadge({ value, size = 'sm' }) {
  const meta = getCategoryMeta(value);
  return <Badge tone={meta.tone} size={size}>{meta.label}</Badge>;
}

const money = (v) => `RM ${(parseFloat(v) || 0).toFixed(2)}`;

// ── Report damaged stock ────────────────────────────────────────────────────
export function ReportDamageModal({
  isSuperAdmin, user, branches, branchId, onBranchChange,
  productSearch, setProductSearch, products, productResults, loadingProducts,
  selectedProduct, onSelectProduct, onClearProduct,
  form, setForm, totalLoss, photos, previews, onAddPhotos, onRemovePhoto, fileInputRef,
  error, onDismissError, submitting, onClose, onSubmit,
}) {
  const qty = parseInt(form.quantity, 10) || 0;
  const stock = selectedProduct ? parseInt(selectedProduct.quantity || 0, 10) : null;
  return (
    <Modal
      size="lg"
      icon={AlertTriangle}
      iconTone="danger"
      title={t('Report damaged stock')}
      description={t('The damaged quantity is removed from branch stock and the loss is recorded.')}
      onClose={onClose}
      onSubmit={onSubmit}
      error={error}
      onDismissError={onDismissError}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('Cancel')}</Button>
        <Button type="submit" variant="danger" icon={PackageX} loading={submitting} disabled={!selectedProduct}>
          {submitting ? t('Submitting…') : t('Report & remove {qty} from stock', { qty })}
        </Button>
      </>}
    >
      <FormSection title={t('1. What was damaged?')}>
        {isSuperAdmin ? (
          <Field label={t('Branch')} required>
            <Select required value={branchId} onChange={e => onBranchChange(e.target.value)}>
              <option value="">{t('Choose a branch…')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.business_name || t('Branch')})</option>)}
            </Select>
          </Field>
        ) : (
          <div className="p-3 bg-subtle border border-line-soft rounded-lg text-sm text-ink-secondary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ink-muted" aria-hidden="true" />
            {t('Branch:')}{' '}<strong className="font-medium text-ink">{user?.branch_name || t('My branch')}</strong>
          </div>
        )}

        <Field label={t('Product')} required>
          {selectedProduct ? (
            <div className="p-3 bg-subtle border border-line rounded-lg flex items-center justify-between gap-3 animate-fade-in">
              <div className="min-w-0">
                <div className="font-medium text-ink text-sm truncate">{selectedProduct.name || selectedProduct.item_name}</div>
                <div className="text-caption text-ink-muted mt-0.5">
                  <span className="font-mono text-accent">{selectedProduct.sku || selectedProduct.item_code}</span>
                  {' · '}<span className="tabular-nums">{selectedProduct.quantity || 0}</span>{' '}{t('in stock')}
                </div>
              </div>
              <Button variant="link" size="sm" onClick={onClearProduct}>{t('Change')}</Button>
            </div>
          ) : (
            <div>
              <SearchInput
                placeholder={loadingProducts ? t('Loading products…') : t('Search by product name or SKU…')}
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                disabled={loadingProducts || (isSuperAdmin && !branchId)}
                aria-label={t('Search products')}
              />
              <div className="mt-1.5 border border-line rounded-lg max-h-56 overflow-y-auto bg-surface divide-y divide-line-soft">
                {isSuperAdmin && !branchId ? (
                  <EmptyState compact title={t('Choose a branch first')} />
                ) : loadingProducts ? (
                  <div className="p-3 space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-9" />)}</div>
                ) : products.length === 0 ? (
                  <EmptyState compact icon={PackageX} title={t('This branch has no products')} />
                ) : productResults.length === 0 ? (
                  <EmptyState compact title={t('No products match “{productSearch}”', { productSearch })} />
                ) : productResults.map(p => {
                  const stockQty = parseInt(p.quantity || 0, 10);
                  return (
                    <ButtonBase
                      key={`${p.id}-${p.branch_id}`}
                      disabled={stockQty <= 0}
                      onClick={() => onSelectProduct(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent-soft/50 flex items-center justify-between gap-3 text-sm disabled:opacity-50 disabled:hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{p.name || p.item_name}</span>
                        <span className="block text-caption text-ink-muted"><span className="font-mono">{p.sku || p.item_code}</span>{p.category && <> · {p.category}</>}</span>
                      </span>
                      <Badge tone={stockQty > 0 ? 'success' : 'danger'} size="sm">{stockQty > 0 ? t('{stockQty} in stock', { stockQty }) : t('No stock')}</Badge>
                    </ButtonBase>
                  );
                })}
              </div>
            </div>
          )}
        </Field>
      </FormSection>

      <FormSection title={t('2. How many, and what is the loss?')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={t('Damaged quantity')}
            required
            hint={selectedProduct ? t('Up to {stock} (current stock).', { stock }) : undefined}
            error={selectedProduct && qty > stock ? t('Only {stock} in stock.', { stock }) : undefined}
          >
            <Input
              type="number" min="1" step="1" required inputMode="numeric"
              max={selectedProduct ? (selectedProduct.quantity || 1) : undefined}
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              suffix="units"
            />
          </Field>
          <Field label={t('Cost per unit')} hint={t('Filled in from the product\'s cost price. Change it if needed.')}>
            <MoneyInput value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} />
          </Field>
        </div>
        <div className="p-3 bg-danger-soft border border-danger-line rounded-lg flex items-center justify-between gap-3">
          <span className="text-caption text-danger-fg tabular-nums">
            {t('Total loss: {qty} × {value}', { qty, value: money(form.cost_per_unit || selectedProduct?.cost_price || 0) })}
          </span>
          <span className="font-display text-lg font-semibold text-danger-fg tabular-nums">{t('RM ')}{totalLoss}</span>
        </div>
      </FormSection>

      <FormSection title={t('3. What happened?')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={t('Reason')}>
          {REASON_CATEGORIES.map(c => {
            const active = form.reason_category === c.value;
            return (
              <ButtonBase
                key={c.value}
                role="radio"
                aria-checked={active}
                onClick={() => setForm({ ...form, reason_category: c.value })}
                className={cn('px-3 py-2.5 rounded-lg border text-sm font-medium text-left', active ? 'border-accent bg-accent-soft text-accent-fg ring-1 ring-accent' : 'border-line text-ink-secondary hover:border-line-strong hover:bg-subtle')}
              >
                {c.label}
              </ButtonBase>
            );
          })}
        </div>
        <Field label={t('Details')} optional>
          <Textarea
            rows={2}
            value={form.reason_details}
            onChange={e => setForm({ ...form, reason_details: e.target.value })}
            placeholder={t('What happened? Batch number, courier, where it was found…')}
          />
        </Field>
      </FormSection>

      <FormSection title={t('4. Photos')} description={t('Optional. Up to 5 photos as evidence (JPG, PNG or WebP). {length}/5 added.', { length: photos.length })}>
        {previews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {previews.map((url, idx) => (
              <div key={url} className="relative aspect-square rounded-lg border border-line overflow-hidden bg-sunken animate-fade-in">
                <img src={url} alt={t('Evidence {value}', { value: idx + 1 })} className="w-full h-full object-cover" />
                <ButtonBase
                  onClick={() => onRemovePhoto(idx)}
                  className="absolute top-1 right-1 bg-ink/60 text-white rounded-full p-1.5 hover:bg-ink/80"
                  aria-label={t('Remove photo {value}', { value: idx + 1 })}
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </ButtonBase>
              </div>
            ))}
          </div>
        )}
        {photos.length < 5 && (
          <div>
            <input type="file" ref={fileInputRef} multiple accept="image/jpeg,image/png,image/webp" onChange={onAddPhotos} className="sr-only" id="damage-photo-upload" />
            <label
              htmlFor="damage-photo-upload"
              className="flex flex-col items-center justify-center gap-1 p-5 border-2 border-dashed border-line rounded-lg cursor-pointer hover:border-accent hover:bg-subtle transition-colors text-sm text-ink-secondary focus-within:ring-2 focus-within:ring-accent/40"
            >
              <Upload className="w-5 h-5 text-ink-muted" aria-hidden="true" />
              <span className="font-medium">{t('Add photos')}</span>
              <span className="text-caption text-ink-muted">{t('Click to choose files')}</span>
            </label>
          </div>
        )}
      </FormSection>
    </Modal>
  );
}

// ── View one record ─────────────────────────────────────────────────────────
export function DamageDetailModal({ report, onClose, onOpenPhoto }) {
  return (
    <Modal
      size="md"
      icon={FileText}
      title={<span className="flex items-center gap-2"><span className="font-mono">{t('#DR-{id}', { id: report.id })}</span><ReasonBadge value={report.reason_category} /></span>}
      description={t('Recorded {value}', { value: new Date(report.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>{t('Close')}</Button>}
    >
      <div className="p-4 bg-subtle border border-line-soft rounded-lg">
        <p className="text-caption text-ink-muted">{t('Product')}</p>
        <p className="text-base font-semibold text-ink mt-0.5">{report.item_name}</p>
        <p className="text-caption text-ink-secondary mt-1">
          <span className="font-mono">{report.item_code}</span>{report.category && <> · {report.category}</>}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div className="p-3 border border-line rounded-lg">
          <dt className="text-caption text-ink-muted">{t('Quantity')}</dt>
          <dd className="text-lg font-semibold text-danger-fg tabular-nums mt-0.5">−{report.quantity}</dd>
        </div>
        <div className="p-3 border border-line rounded-lg">
          <dt className="text-caption text-ink-muted">{t('Unit cost')}</dt>
          <dd className="text-lg font-semibold text-ink tabular-nums mt-0.5">{money(report.cost_per_unit)}</dd>
        </div>
        <div className="p-3 bg-danger-soft border border-danger-line rounded-lg">
          <dt className="text-caption text-danger-fg">{t('Total loss')}</dt>
          <dd className="text-lg font-semibold text-danger-fg tabular-nums mt-0.5">{money(report.total_value)}</dd>
        </div>
      </dl>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-caption text-ink-muted">{t('Location')}</dt>
          <dd className="font-medium text-ink mt-0.5">{report.branch_name}</dd>
          <dd className="text-caption text-ink-muted">{report.business_name}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Reported by')}</dt>
          <dd className="font-medium text-ink mt-0.5">{report.reported_by_name || t('System admin')}</dd>
          <dd className="text-caption text-ink-muted">{report.reported_by_email || '—'}</dd>
        </div>
      </dl>

      <div>
        <p className="text-sm font-semibold text-ink mb-1.5">{t('What happened')}</p>
        <p className="p-3 bg-subtle border border-line-soft rounded-lg text-sm text-ink-secondary leading-relaxed">
          {report.reason_details || t('No extra details were recorded.')}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-2">{t('Photos')}{' '}<span className="text-ink-muted font-normal tabular-nums">({report.photos?.length || 0})</span></p>
        {report.photos?.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {report.photos.map((p, i) => (
              <ButtonBase
                key={p.id || i}
                onClick={() => onOpenPhoto(p.photo_path)}
                className="group relative aspect-square rounded-lg border border-line overflow-hidden bg-sunken"
                aria-label={t('Open photo {value}', { value: i + 1 })}
              >
                <img src={p.photo_path} alt="" className="w-full h-full object-cover transition-transform duration-base group-hover:scale-105" />
                <span className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/30 transition-colors">
                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                </span>
              </ButtonBase>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-line rounded-lg"><EmptyState compact icon={ImageOff} title={t('No photos were uploaded')} /></div>
        )}
      </div>
    </Modal>
  );
}

// ── Full-size photo ─────────────────────────────────────────────────────────
export function PhotoViewer({ src, onClose }) {
  return (
    <Modal size="xl" title={t('Evidence photo')} onClose={onClose} bodyClassName="p-0 sm:p-0 bg-ink/95 flex items-center justify-center">
      <img src={src} alt={t('Evidence, full size')} className="max-h-[75vh] max-w-full object-contain" />
    </Modal>
  );
}
