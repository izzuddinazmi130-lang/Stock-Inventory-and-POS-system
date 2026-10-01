import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Menu as MenuIcon } from 'lucide-react';
import ChangePasswordModal from './auth/ChangePasswordModal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LowStockBell from './LowStockBell';
import { currentSectionLabel } from './navigation';
import { cn } from './ui/cn';
import { ButtonBase, IconButton } from './ui/Button';
import { SearchInput } from './ui/controls';
import { Menu } from './ui/Menu';
import { Badge } from './ui/Badge';
import ScopeBadge from './ui/ScopeBadge';

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Quick product search: suggestions as you type, Enter opens the full product list. */
function GlobalSearch() {
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

  return (
    <div className="relative w-full" ref={boxRef}>
      <SearchInput
        size="sm"
        value={searchVal}
        onChange={e => { setSearchVal(e.target.value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        onKeyDown={e => { if (e.key === 'Enter') goToSearch(); if (e.key === 'Escape') setShowResults(false); }}
        placeholder="Search products or SKU…"
        aria-label="Search products"
        className="bg-surface"
      />
      {showResults && searchVal.trim().length >= 2 && (
        <div className="absolute top-10 left-0 right-0 bg-surface border border-line rounded-xl shadow-popover overflow-hidden z-50 animate-scale-in origin-top">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-caption text-ink-muted">No matches for “{searchVal.trim()}”</div>
          ) : (
            <>
              {results.map(item => (
                <ButtonBase
                  key={`${item.id}-${item.branch_id || ''}`}
                  onClick={() => { navigate(`/products?product_id=${item.id}`); setShowResults(false); setSearchVal(''); }}
                  className={cn('w-full text-left px-4 py-2.5 hover:bg-subtle border-b border-line-soft last:border-b-0 flex items-center justify-between gap-2 transition-colors')}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{item.name}</div>
                    <div className="text-caption font-mono text-accent">{item.sku}</div>
                  </div>
                  {item.branch_name && <span className="text-caption text-ink-muted whitespace-nowrap">{item.branch_name}</span>}
                </ButtonBase>
              ))}
              <ButtonBase
                onClick={goToSearch}
                className={cn('w-full text-center px-4 py-2 text-caption font-semibold text-accent hover:bg-accent-soft transition-colors')}
              >
                See all results
              </ButtonBase>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Top bar: page context and search on the left; scope, stock alerts and account menu on the right. */
export default function Header({ onOpenNav }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [changingPassword, setChangingPassword] = useState(false);
  if (!user) return null;

  const isSuper = user.role === 'super_admin';
  const section = currentSectionLabel(user, pathname);

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 sm:px-6 lg:px-8 bg-page/85 backdrop-blur border-b border-line">
      <IconButton icon={MenuIcon} label="Open navigation" onClick={onOpenNav} size="md" className="md:hidden -ml-2" tooltip={false} />

      {section && <span className="text-sm font-medium text-ink truncate">{section}</span>}

      <div className="hidden md:block flex-1 max-w-xs ml-2">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ScopeBadge compact className="hidden sm:inline-flex max-w-[16rem]" />
        <LowStockBell />
        <Menu
          label="Account"
          width="w-64"
          header={
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{user.full_name || user.email}</p>
              <p className="text-caption text-ink-muted truncate">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge size="sm" tone={isSuper ? 'accent' : 'neutral'}>{isSuper ? 'Super admin' : 'Branch admin'}</Badge>
              </div>
              <ScopeBadge className="mt-2 sm:hidden" />
            </div>
          }
          items={[
            { label: 'Change password', icon: KeyRound, onClick: () => setChangingPassword(true) },
            { divider: true },
            { label: 'Sign out', icon: LogOut, onClick: logout, tone: 'danger' },
          ]}
          trigger={({ ref, ...props }) => (
            <ButtonBase
              ref={ref}
              aria-label="Account menu"
              className={cn('rounded-full p-0.5 hover:ring-4 hover:ring-sunken transition-shadow')}
              {...props}
            >
              <span className="w-8 h-8 rounded-full bg-ink text-white text-caption font-semibold flex items-center justify-center">
                {getInitials(user.full_name || user.email)}
              </span>
            </ButtonBase>
          )}
        />
      </div>
      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </header>
  );
}
