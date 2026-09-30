import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { QrCode, ScanLine } from 'lucide-react';
import Layout from '../../components/Layout';
import { SegmentedControl } from '../../components/ui';
import QrGenerator from './QrGenerator';
import QrScanner from './QrScanner';

export default function QrHub() {
  const location = useLocation();
  const [tab, setTab] = useState(location.pathname.startsWith('/qr/generate') ? 'generate' : 'scan');

  return (
    <Layout>
      <SegmentedControl
        label="Point of sale or QR labels"
        size="lg"
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: 'scan', label: 'Point of sale', icon: ScanLine },
          { value: 'generate', label: 'Print QR labels', icon: QrCode },
        ]}
      />
      {tab === 'scan' ? <QrScanner embedded /> : <QrGenerator embedded />}
    </Layout>
  );
}
