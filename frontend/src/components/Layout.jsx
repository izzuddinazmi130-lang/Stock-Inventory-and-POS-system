import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { BusinessProvider } from '../context/BusinessContext';
import { ToastProvider } from '../context/ToastContext';

export default function Layout({ children }) {
  return (
    <BusinessProvider>
      <ToastProvider>
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-page)' }}>
          <Header />
          <div className="flex flex-grow overflow-hidden">
            <Sidebar />
            <main className="flex-grow overflow-auto p-6">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </BusinessProvider>
  );
}
