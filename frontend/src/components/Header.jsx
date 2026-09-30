import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { Search, LogOut } from 'lucide-react';
import api from '../services/api';
import LowStockBell from './LowStockBell';

const BIZ_COLORS = { 1: '#B4502E', 2: '#2563EB' };

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Header() {
  const { user, logout } = useAuth();
  const { businesses, selectedBusiness, setSelectedBusiness } = useBusiness();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const term = searchVal.trim();
    if (term.length < 2) { setResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        const res = await api.get('/products', { params: { search: term } });
        const items = res.data.data || res.data.items || [];
        setResults(items.slice(0, 6));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchVal]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const goToSearch = () => {
    const term = searchVal.trim();
    if (!term) return;
    navigate(`/products?search=${encodeURIComponent(term)}`);
    setShowResults(false);
  };

  if (!user) return null;

  const roleLabel = user.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN';
  const initials = getInitials(user.full_name || user.email);

  return (
    <header className="h-16 bg-surface border-b border-line sticky top-0 z-50 flex items-center gap-4 px-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center text-white font-bold text-sm">H</div>
        <div>
          <div className="font-bold text-sm text-ink leading-tight">HQ Inventory</div>
          <div className="text-[10px] tracking-widest text-ink-muted uppercase leading-tight">Inventory Ops</div>
        </div>
      </div>

      {/* Global search */}
      <div className="flex-1 max-w-xs relative" ref={boxRef}>
        <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onKeyDown={e => { if (e.key === 'Enter') goToSearch(); if (e.key === 'Escape') setShowResults(false); }}
          placeholder="Search SKU, branch, product..."
          className="w-full h-9 rounded-full border border-line bg-subtle pl-8 pr-10 text-sm text-ink-secondary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted bg-surface border border-line rounded-lg px-1 font-mono">⏎</span>

        {showResults && searchVal.trim().length >= 2 && (
          <div className="absolute top-11 left-0 right-0 bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-ink-muted">No matches for "{searchVal.trim()}"</div>
            ) : (
              <>
                {results.map(item => (
                  <button
                    key={`${item.id}-${item.branch_id || ''}`}
                    type="button"
                    onClick={() => { navigate(`/products?product_id=${item.id}`); setShowResults(false); setSearchVal(''); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-subtle border-b border-line-soft last:border-b-0 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">{item.name}</div>
                      <div className="text-[11px] font-mono text-accent">{item.sku}</div>
                    </div>
                    {item.branch_name && <span className="text-[11px] text-ink-muted whitespace-nowrap">{item.branch_name}</span>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={goToSearch}
                  className="w-full text-center px-4 py-2 text-xs font-semibold text-accent hover:bg-accent-soft"
                >
                  See all results
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Role pill */}
        <div className="flex items-center gap-1.5 bg-success-soft text-success-fg text-xs font-semibold px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-success rounded-full" />
          {roleLabel}
        </div>

        <LowStockBell />

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-ink text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          {initials}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}