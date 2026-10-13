import React from 'react';
import { ArrowDownToLine, CheckCircle2, ShoppingCart, StickyNote, Store, Trash2, X, AlertTriangle, Banknote, QrCode, CreditCard } from 'lucide-react';
import {
  Alert, Button, ButtonBase, Card, IconButton, Input, QuantityStepper, SegmentedControl, Select, cn,
} from '../../../components/ui';
import { t as tr } from '../../../i18n';

export const PAYMENT_METHODS = [
  { value: 'cash', label: tr('Cash'), icon: Banknote },
  { value: 'qr', label: tr('QR / e-Wallet'), icon: QrCode },
  { value: 'online_banking', label: tr('Card / Online'), icon: CreditCard },
];
export const PRICE_TIERS = [
  { value: 'customer', label: tr('Customer') },
  { value: 'dealer', label: tr('Dealer') },
  { value: 'staff', label: tr('Staff') },
];

const rm = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;
const toSen = (n) => Math.round((parseFloat(n) || 0) * 100);

// Quick "customer handed me…" amounts: the next round notes above the total
function cashSuggestions(total) {
  const t = toSen(total);
  const out = [];
  for (const step of [500, 1000, 5000, 10000]) {
    const v = Math.ceil(t / step) * step;
    if (v > t && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 3).map(v => v / 100);
}

/** Right side of the POS: the order, price type, payment, cash/change, note, total and the big Charge button. */
export default function OrderPanel({
  isSale, cart, totalUnits, onClear, errorMessage, onDismissError, lastAddedId, unitPrice, updateQuantity, removeItem,
  priceTier, setPriceTier, stores, storeId, setStoreId, paymentMethod, setPaymentMethod,
  isCashSale, cashReceived, setCashReceived, grandTotal, cashShortSen, changeDue,
  showNote, setShowNote, saleNote, setSaleNote, onConfirm, submitting, stockProblems,
}) {
  return (
    <Card as="section" aria-label={isSale ? tr('Current sale') : tr('Stock being received')} className="flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
        <div>
          <h2 className="text-sm font-semibold text-ink">{isSale ? tr('Current sale') : tr('Stock being received')}</h2>
          <p className="text-caption text-ink-muted tabular-nums">
            {cart.length === 0 ? tr('No items yet') : tr('{length} product{value} · {totalUnits} unit{value2}', { length: cart.length, value: cart.length === 1 ? '' : 's', totalUnits, value2: totalUnits === 1 ? '' : 's' })}
          </p>
        </div>
        {cart.length > 0 && <Button variant="ghost" size="sm" onClick={onClear}>{tr('Clear all')}</Button>}
      </div>

      {errorMessage && <Alert tone="danger" className="mx-4 mt-3" onClose={onDismissError}>{errorMessage}</Alert>}

      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[10rem]">
        {cart.length === 0 ? (
          <div className="h-full py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-sunken ring-8 ring-subtle text-ink-muted flex items-center justify-center mb-3">
              <ShoppingCart className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-ink">{tr('Scan or tap a product to add it')}</p>
            <p className="text-caption text-ink-muted mt-1">{tr('A barcode scanner works anywhere on this page.')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft" aria-live="polite">
            {cart.map(item => {
              const price = unitPrice(item);
              const over = isSale && item.quantity > item.in_stock;
              return (
                <li
                  key={item.id}
                  className={cn('py-3 px-2 -mx-2 rounded-lg transition-colors duration-slow animate-fade-in', lastAddedId === item.id && 'bg-accent-soft', over && 'bg-danger-soft')}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink leading-snug">{item.name}</div>
                      <div className="text-caption text-ink-muted mt-0.5">
                        {[item.size && tr('Size {size}', { size: item.size }), item.colour, item.model].filter(Boolean).join(' · ')}
                        {(item.size || item.colour || item.model) && ' · '}
                        <span className="font-mono">{item.sku}</span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-semibold text-ink">{rm(price * item.quantity)}</div>
                      <div className="text-caption text-ink-muted">{rm(price)}{tr(' each')}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {/* min 0: stepping below 1 removes the line, as before */}
                    <QuantityStepper size="lg" min={0} value={item.quantity} onChange={n => updateQuantity(item.id, n)} label={tr('Quantity of {name}', { name: item.name })} />
                    <IconButton icon={Trash2} label={tr('Remove {name}', { name: item.name })} size="lg" className="hover:text-danger-fg hover:bg-danger-soft" onClick={() => removeItem(item.id)} />
                  </div>
                  {over && (
                    <p className="mt-1.5 text-caption font-medium text-danger-fg flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{' '}{tr('Only {in_stock} in stock', { in_stock: item.in_stock })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line-soft px-4 py-4 space-y-3 bg-subtle/70 rounded-b-xl">
        {isSale && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption font-medium text-ink-muted">{tr('Price type')}</span>
              <SegmentedControl size="lg" label={tr('Price type')} value={priceTier} onChange={setPriceTier} tabs={PRICE_TIERS} />
            </div>

            {stores.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-caption font-medium text-ink-muted flex items-center gap-1"><Store className="w-3.5 h-3.5" aria-hidden="true" />{' '}{tr('Selling at')}</span>
                <Select size="sm" wrapperClassName="max-w-[14rem] flex-1" value={storeId} onChange={e => setStoreId(e.target.value)} aria-label={tr('Selling at')}>
                  <option value="">{tr('Branch counter')}</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.status === 'upcoming' ? tr(' (upcoming)') : ''}</option>)}
                </Select>
              </div>
            )}

            <div>
              <span className="text-caption font-medium text-ink-muted block mb-1.5">{tr('Payment')}</span>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tr('Payment method')}>
                {PAYMENT_METHODS.map(pm => {
                  const active = paymentMethod === pm.value;
                  return (
                    <ButtonBase
                      key={pm.value}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPaymentMethod(pm.value)}
                      className={cn(
                        'h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-caption font-medium',
                        active ? 'border-accent bg-accent-soft text-accent-fg ring-1 ring-accent' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'
                      )}
                    >
                      <pm.icon className="w-5 h-5" aria-hidden="true" />
                      {pm.label}
                    </ButtonBase>
                  );
                })}
              </div>
            </div>

            {isCashSale && cart.length > 0 && (
              <div className="rounded-lg border border-line bg-surface p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="pos-cash" className="text-caption font-medium text-ink-muted">{tr('Cash received')}</label>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted text-caption font-semibold pointer-events-none">{tr('RM')}</span>
                    <Input
                      id="pos-cash"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      placeholder={grandTotal.toFixed(2)}
                      error={cashShortSen > 0}
                      className="pl-9 pr-2 text-right font-semibold tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ButtonBase
                    onClick={() => setCashReceived('')}
                    aria-pressed={cashReceived === ''}
                    className={cn('h-9 px-3 rounded-lg border text-caption font-semibold', cashReceived === '' ? 'border-accent bg-accent-soft text-accent-fg' : 'border-line text-ink-secondary hover:bg-subtle')}
                  >
                    {tr('Exact')}
                  </ButtonBase>
                  {cashSuggestions(grandTotal).map(v => {
                    const active = cashReceived !== '' && toSen(cashReceived) === toSen(v);
                    return (
                      <ButtonBase
                        key={v}
                        aria-pressed={active}
                        onClick={() => setCashReceived(v.toFixed(2))}
                        className={cn('h-9 px-3 rounded-lg border text-caption font-semibold tabular-nums', active ? 'border-accent bg-accent-soft text-accent-fg' : 'border-line text-ink-secondary hover:bg-subtle')}
                      >
                        {tr('RM')}{' '}{v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}
                      </ButtonBase>
                    );
                  })}
                </div>
                {cashShortSen > 0 ? (
                  <div className="flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2 text-danger-fg" aria-live="polite">
                    <span className="text-caption font-semibold">{tr('Still to pay')}</span>
                    <span className="font-semibold tabular-nums">{rm(cashShortSen / 100)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-success-soft px-3 py-2 text-success-fg" aria-live="polite">
                    <span className="text-caption font-semibold">{tr('Change to give')}</span>
                    <span className="font-display text-lg font-semibold tabular-nums">{rm(changeDue)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {showNote ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <Input
              autoFocus
              size="sm"
              value={saleNote}
              onChange={e => setSaleNote(e.target.value)}
              placeholder={isSale ? tr('Note, e.g. customer name or order no.') : tr('Note, e.g. supplier delivery no.')}
              wrapperClassName="flex-1"
              aria-label={tr('Note')}
            />
            <IconButton icon={X} label={tr('Remove note')} onClick={() => { setShowNote(false); setSaleNote(''); }} />
          </div>
        ) : (
          <Button variant="link" size="sm" className="min-h-11" icon={StickyNote} onClick={() => setShowNote(true)}>{tr('Add a note')}</Button>
        )}

        <div className="flex items-end justify-between pt-1">
          <span className="text-sm font-medium text-ink-secondary">{isSale ? tr('Total') : tr('Stock value (cost)')}</span>
          <span className={cn('font-display text-3xl font-semibold tracking-tight tabular-nums', isSale ? 'text-ink' : 'text-success-fg')}>{rm(grandTotal)}</span>
        </div>

        <Button
          size="xl"
          fullWidth
          variant={isSale ? 'primary' : 'success'}
          icon={isSale ? CheckCircle2 : ArrowDownToLine}
          loading={submitting}
          onClick={onConfirm}
          disabled={cart.length === 0 || stockProblems.length > 0 || cashShortSen > 0}
        >
          {submitting ? tr('Processing…') : isSale ? tr('Charge {grandTotal}', { grandTotal: rm(grandTotal) }) : tr('Receive {totalUnits} unit{value}', { totalUnits, value: totalUnits === 1 ? '' : 's' })}
        </Button>
        {stockProblems.length > 0 && (
          <p className="text-caption text-danger-fg text-center">{tr('Fix the items marked in red to continue.')}</p>
        )}
      </div>
    </Card>
  );
}
