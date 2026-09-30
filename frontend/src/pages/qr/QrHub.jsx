import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import QrGenerator from './QrGenerator';
import QrScanner from './QrScanner';
import { QrCode, Camera } from 'lucide-react';

export default function QrHub() {
  const location = useLocation();
  const [tab, setTab] = useState(location.pathname.startsWith('/qr/generate') ? 'generate' : 'scan');

  return (
    <Layout>
      <div className="flex items-center bg-sunken p-1 rounded-lg border border-line w-fit mb-6">
        <button
          type="button"
          onClick={() => setTab('scan')}
          className={`flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-semibold transition-all ${tab === 'scan' ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-secondary hover:text-ink'}`}
        >
          <Camera className="w-4 h-4 text-accent" />
          <span>Point of Sale</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('generate')}
          className={`flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-semibold transition-all ${tab === 'generate' ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-secondary hover:text-ink'}`}
        >
          <QrCode className="w-4 h-4 text-accent" />
          <span>Print QR labels</span>
        </button>
      </div>
      {tab === 'scan' ? <QrScanner embedded /> : <QrGenerator embedded />}
    </Layout>
  );
}
