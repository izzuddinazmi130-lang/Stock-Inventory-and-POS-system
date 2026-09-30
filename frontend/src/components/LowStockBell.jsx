import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, PackageX, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

const PREVIEW = 5;
const rowKey = (i) => `${i.id}-${i.branch_id}`;
const label = (i) => `${i.name}${i.size ? ` (Size ${i.size})` : ''}`;

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
          if (i.stock_status === 'out') addToast(`${label(i)} is now out of stock${i.branch_name ? ` at ${i.branch_name}` : ''}.`, 'error');
          else if (!before) addToast(`${label(i)} is running low: ${i.quantity} left.`, 'warning');
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

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        title="Stock alerts"
        aria-label={`Stock alerts: ${counts.total}`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {counts.total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${counts.out > 0 ? 'bg-rose-500' : 'bg-amber-500'}`}>
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">Stock alerts</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {counts.total === 0 ? 'Everything is above its alert level.' : <><strong className="text-rose-600">{counts.out}</strong> out of stock · <strong className="text-amber-600">{counts.low}</strong> running low</>}
            </p>
          </div>
          {items.length > 0 && (
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {items.map(i => (
                <li key={rowKey(i)} className="px-4 py-2.5 flex items-center gap-3">
                  {i.stock_status === 'out'
                    ? <PackageX className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{label(i)}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      <span className="font-mono">{i.sku}</span>{i.branch_name ? ` · ${i.branch_name}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap ${i.stock_status === 'out' ? 'text-rose-600' : 'text-amber-600'}`}>
                    {i.stock_status === 'out' ? 'Out' : `${i.quantity} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/low-stock"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border-t border-slate-100"
          >
            {counts.total > PREVIEW ? `View all ${counts.total}` : 'Open low stock list'} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
