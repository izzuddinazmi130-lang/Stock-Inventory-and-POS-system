import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { BusinessProvider } from '../context/BusinessContext';

export default function Layout({ children }) {
  return (
    <BusinessProvider>
      <div className="min-h-screen flex flex-col bg-page">
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
    </BusinessProvider>
  );
}
