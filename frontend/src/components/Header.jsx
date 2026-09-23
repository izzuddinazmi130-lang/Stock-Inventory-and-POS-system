import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { Search, LogOut } from 'lucide-react';
import api from '../services/api';

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
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-50 flex items-center gap-4 px-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">H</div>
        <div>
          <div className="font-bold text-sm text-slate-900 leading-tight">HQ Inventory</div>
          <div className="text-[10px] tracking-widest text-slate-400 uppercase leading-tight">Inventory Ops</div>
        </div>
      </div>

      {/* Global search */}
      <div className="flex-1 max-w-xs relative" ref={boxRef}>
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onKeyDown={e => { if (e.key === 'Enter') goToSearch(); if (e.key === 'Escape') setShowResults(false); }}
          placeholder="Search SKU, branch, product..."
          className="w-full h-9 rounded-full border border-slate-200 bg-slate-50 pl-8 pr-10 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1 font-mono">⏎</span>

        {showResults && searchVal.trim().length >= 2 && (
          <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400">No matches for "{searchVal.trim()}"</div>
            ) : (
              <>
                {results.map(item => (
                  <button
                    key={`${item.id}-${item.branch_id || ''}`}
                    type="button"
                    onClick={() => { navigate(`/products?product_id=${item.id}`); setShowResults(false); setSearchVal(''); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] font-mono text-indigo-600">{item.sku}</div>
                    </div>
                    {item.branch_name && <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.branch_name}</span>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={goToSearch}
                  className="w-full text-center px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
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
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          {roleLabel}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          {initials}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}