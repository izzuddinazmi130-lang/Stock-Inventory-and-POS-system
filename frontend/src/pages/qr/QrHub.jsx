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
      <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit mb-6">
        <button
          type="button"
          onClick={() => setTab('scan')}
          className={`flex items-center gap-1.5 px-4 h-9 rounded-md text-sm font-semibold transition-all ${tab === 'scan' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Camera className="w-4 h-4 text-indigo-600" />
          <span>POS &amp; Scanner</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('generate')}
          className={`flex items-center gap-1.5 px-4 h-9 rounded-md text-sm font-semibold transition-all ${tab === 'generate' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <QrCode className="w-4 h-4 text-indigo-600" />
          <span>Label Generator</span>
        </button>
      </div>
      {tab === 'scan' ? <QrScanner embedded /> : <QrGenerator embedded />}
    </Layout>
  );
}
