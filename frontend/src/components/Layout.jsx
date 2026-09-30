import React, { createContext, useContext, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar, { NavList } from './Sidebar';
import BrandMark from './BrandMark';
import { Drawer } from './ui/Modal';
import { BusinessProvider } from '../context/BusinessContext';

const ShellContext = createContext(false);
const COLLAPSE_KEY = 'hq.sidebar.collapsed';

function readCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) return saved === '1';
  } catch { /* storage unavailable */ }
  // Tablets start with the icon-only sidebar
  return typeof window !== 'undefined' && window.innerWidth < 1024;
}

function Frame({ children }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  return (
    <div className="min-h-screen flex bg-page">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-surface focus:shadow-popover focus:text-sm">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header onOpenNav={() => setNavOpen(true)} />
        <main id="main" className="flex-1 w-full">
          {/* Route change: quick fade + rise (opacity/transform only, so nothing shifts) */}
          <div key={pathname} className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-slide-up">
            {children}
          </div>
        </main>
      </div>
      <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left" width="w-72" title={<BrandMark withName />}>
        <div className="py-2"><NavList onNavigate={() => setNavOpen(false)} /></div>
      </Drawer>
    </div>
  );
}

/** Persistent app shell used as the parent route: sidebar and header stay mounted between pages. */
export function AppShell() {
  return (
    <ShellContext.Provider value={true}>
      <BusinessProvider>
        <Frame>
          <Outlet />
        </Frame>
      </BusinessProvider>
    </ShellContext.Provider>
  );
}

/**
 * Pages wrap themselves in <Layout>. Inside the AppShell it's a pass-through;
 * rendered on its own (e.g. outside the shell route) it draws the full frame.
 */
export default function Layout({ children }) {
  const inShell = useContext(ShellContext);
  if (inShell) return <>{children}</>;
  return (
    <ShellContext.Provider value={true}>
      <BusinessProvider>
        <Frame>{children}</Frame>
      </BusinessProvider>
    </ShellContext.Provider>
  );
}
