import React from 'react';
import { Printer } from 'lucide-react';
import { Modal } from '../ui/Modal';
import Button from '../ui/Button';

// Shared by the Point of Sale and Sales history so a receipt always looks the same.

export const PAYMENT_LABELS = {
  cash: 'Cash',
  qr: 'QR / e-Wallet',
  online_banking: 'Card / Online',
};

export const TIER_LABELS = { customer: 'Customer', dealer: 'Dealer', staff: 'Staff' };

export const rm = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;

// "2026-09-30 14:05:00" (server local time) → "30 Sep 2026, 2:05 pm"
export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d)) return String(value);
  return d.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

// Printing: only the element with .pos-receipt is printed, at receipt-printer width
export const RECEIPT_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .pos-receipt, .pos-receipt * { visibility: visible !important; }
  .pos-receipt { position: absolute; left: 0; top: 0; width: 80mm; margin: 0 !important; padding: 0; border: 0 !important; box-shadow: none; max-height: none !important; overflow: visible !important; }
  .pos-no-print { display: none !important; }
}`;

/** The paper receipt for a completed sale (shape returned by /api/sales/:id and /qr/pos-transaction). */
export function SaleReceipt({ sale }) {
  if (!sale) return null;
  const isCash = sale.payment_method === 'cash' && sale.cash_received != null;
  return (
    <div className="pos-receipt font-mono text-xs text-ink p-4 border border-dashed border-line-strong rounded-lg bg-surface">
      <div className="text-center mb-3">
        <div className="text-sm font-bold">{sale.business_name || 'Receipt'}</div>
        <div>{sale.branch_name}{sale.store_name ? ` · ${sale.store_name}` : ''}</div>
      </div>

      <div className="space-y-0.5 mb-2">
        <Row label="Receipt" value={sale.receipt_no} bold />
        <Row label="Date" value={formatDateTime(sale.created_at)} />
        {sale.cashier_name && <Row label="Served by" value={sale.cashier_name} />}
        {sale.price_tier && sale.price_tier !== 'customer' && <Row label="Price type" value={TIER_LABELS[sale.price_tier]} />}
      </div>

      <div className="border-t border-dashed border-line-strong pt-2 space-y-1.5">
        {(sale.items || []).map(it => (
          <div key={it.id || `${it.sku}-${it.quantity}`}>
            <div className="flex justify-between gap-2">
              <span className="min-w-0">{it.name}{it.variant_text ? ` (${it.variant_text})` : ''}</span>
              <span className="flex-shrink-0">{rm(it.line_total)}</span>
            </div>
            <div className="text-ink-muted">{it.quantity} × {rm(it.unit_price)}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-line-strong mt-2 pt-2 space-y-0.5">
        <Row label="Items" value={sale.total_quantity} />
        <div className="flex justify-between text-sm font-bold pt-0.5"><span>TOTAL</span><span>{rm(sale.total_amount)}</span></div>
        <Row label="Paid by" value={PAYMENT_LABELS[sale.payment_method] || sale.payment_method} />
        {isCash && (
          <>
            <Row label="Cash received" value={rm(sale.cash_received)} />
            <div className="flex justify-between font-bold"><span>Change</span><span>{rm(sale.change_due)}</span></div>
          </>
        )}
        {sale.note && <div className="text-ink-muted pt-1">Note: {sale.note}</div>}
      </div>
      <div className="text-center mt-3">Thank you!</div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-muted">{label}</span>
      <span className={bold ? 'font-bold' : ''}>{value}</span>
    </div>
  );
}

/**
 * Modal frame around a receipt: header and buttons are not printed, only the .pos-receipt block is.
 * `closeVariant` picks the main button colour ("primary" for a sale, "success" for received stock).
 */
export function ReceiptModal({ header, children, onClose, closeLabel = 'Close', closeVariant = 'primary' }) {
  return (
    <Modal
      size="sm"
      hideClose
      onClose={onClose}
      bodyClassName="space-y-4"
      footer={
        <div className="pos-no-print grid grid-cols-2 gap-2 w-full">
          <Button variant="secondary" size="lg" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button variant={closeVariant} size="lg" onClick={onClose} data-autofocus>{closeLabel}</Button>
        </div>
      }
    >
      <style>{RECEIPT_PRINT_CSS}</style>
      {header && <div className="pos-no-print">{header}</div>}
      {children}
    </Modal>
  );
}
