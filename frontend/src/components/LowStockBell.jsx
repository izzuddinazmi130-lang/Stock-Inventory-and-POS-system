import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, PackageX, PackageMinus, PackageCheck, ArrowRight } from 'lucide-react';
import { cn } from './ui/cn';
import { ButtonBase } from './ui/Button';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { t as tr } from '../i18n';

const PREVIEW = 5;
const rowKey = (i) => `${i.id}-${i.branch_id}`;
const label = (i) => (i.size ? tr('{name} (Size {size})', { name: i.name, size: i.size }) : i.name);

/**
 * Header bell: how many products are out of stock / running low, the most urgent few,
 * and a toast the moment something newly drops to its alert level.
 */
export default function LowStockBell() {
  const { socket } = useSocket() || {};
  const { addToast } = useToast() || {};
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ out: 0, low: 0, total: 0 });
  const [items, setItems] = useState([]);
  const knownRef = useRef(null); // Map of alert key → status, null until the first load
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/products/low-stock');
      if (!res.data.success) return;
      const all = res.data.items || [];
      setCounts(res.data.counts || { out: 0, low: 0, total: 0 });
      setItems(all.slice(0, PREVIEW));

      // Notify about products that just crossed a threshold (not on the first load)
      const next = new Map(all.map(i => [rowKey(i), i.stock_status]));
      if (knownRef.current && addToast) {
        all.forEach(i => {
          const before = knownRef.current.get(rowKey(i));
          if (before === i.stock_status) return;
          if (i.stock_status === 'out') addToast(i.branch_name ? tr('{name} is now out of stock at {branch}.', { name: label(i), branch: i.branch_name }) : tr('{name} is now out of stock.', { name: label(i) }), 'error');
          else if (!before) addToast(tr('{name} is running low: {quantity} left.', { name: label(i), quantity: i.quantity }), 'warning');
        });
      }
      knownRef.current = next;
    } catch {
      // The bell is a convenience; errors stay quiet
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  // Refresh when stock changes anywhere in scope (small delay groups a multi-item sale into one refresh)
  useEffect(() => {
    if (!socket) return;
    let t;
    const onUpdate = () => { clearTimeout(t); t = setTimeout(load, 400); };
    socket.on('inventory_updated', onUpdate);
    return () => { clearTimeout(t); socket.off('inventory_updated', onUpdate); };
  }, [socket, load]);

  useEffect(() => {
    const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <ButtonBase
        onClick={() => setOpen(o => !o)}
        className={cn('relative w-10 h-10 flex items-center justify-center rounded-lg text-ink-secondary hover:text-ink hover:bg-sunken transition-colors')}
        aria-label={tr('Stock alerts: {total}', { total: counts.total })}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
        {counts.total > 0 && (
          <span className={cn(
            'absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ring-2 ring-page tabular-nums',
            counts.out > 0 ? 'bg-danger' : 'bg-warning'
          )}>
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        )}
      </ButtonBase>

      {open && (
        <div
          role="dialog"
          aria-label={tr('Stock alerts')}
          className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] bg-surface border border-line rounded-xl shadow-popover overflow-hidden z-50 animate-scale-in origin-top-right"
        >
          <div className="px-4 py-3 border-b border-line-soft">
            <p className="text-sm font-semibold text-ink">{tr('Stock alerts')}</p>
            <p className="text-caption text-ink-muted mt-0.5">
              {counts.total === 0
                ? tr('Everything is above its alert level.')
                : <><span className="font-semibold text-danger-fg tabular-nums">{counts.out}</span>{' '}{tr('out of stock ·')}{' '}<span className="font-semibold text-warning-fg tabular-nums">{counts.low}</span>{' '}{tr('running low')}</>}
            </p>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 flex flex-col items-center text-center">
              <PackageCheck className="w-6 h-6 text-success mb-1.5" aria-hidden="true" />
              <p className="text-caption text-ink-muted">{tr('No stock alerts right now.')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft max-h-72 overflow-y-auto">
              {items.map(i => (
                <li key={rowKey(i)} className="px-4 py-2.5 flex items-center gap-3">
                  {i.stock_status === 'out'
                    ? <PackageX className="w-4 h-4 text-danger-fg flex-shrink-0" aria-hidden="true" />
                    : <PackageMinus className="w-4 h-4 text-warning-fg flex-shrink-0" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{label(i)}</p>
                    <p className="text-[11px] text-ink-muted truncate">
                      <span className="font-mono">{i.sku}</span>{i.branch_name ? ` · ${i.branch_name}` : ''}
                    </p>
                  </div>
                  <span className={cn('text-caption font-semibold whitespace-nowrap tabular-nums', i.stock_status === 'out' ? 'text-danger-fg' : 'text-warning-fg')}>
                    {i.stock_status === 'out' ? tr('Out') : tr('{quantity} left', { quantity: i.quantity })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/low-stock"
            onClick={() => setOpen(false)}
            className={cn('flex items-center justify-center gap-1 px-4 py-2.5 text-caption font-semibold text-accent hover:bg-accent-soft border-t border-line-soft transition-colors')}
          >
            {counts.total > PREVIEW ? tr('View all {total}', { total: counts.total }) : tr('Open low stock list')} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
