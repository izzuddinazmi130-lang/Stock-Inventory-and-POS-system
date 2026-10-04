import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, ScanLine } from 'lucide-react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { Breadcrumbs, SegmentedControl } from '../../components/ui';
import QrGenerator from './QrGenerator';
import QrScanner from './QrScanner';

export default function QrHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const tab = location.pathname.startsWith('/qr/generate') ? 'generate' : 'scan';
  const setTab = (next) => navigate({ pathname: next === 'generate' ? '/qr/generate' : '/qr/scan', search: location.search }, { replace: true });

  // QR labels belong to products for head office (reached from Products); for a branch they sit next to the till
  const crumbs = tab === 'generate'
    ? (isSuperAdmin ? { section: 'Inventory', items: [{ label: 'Products', to: '/products' }, { label: 'Print QR labels' }] } : { items: [{ label: 'Print QR labels' }] })
    : { items: undefined };

  return (
    <Layout>
      <Breadcrumbs section={crumbs.section} items={crumbs.items} className="mb-3" />
      <SegmentedControl
        label="Point of sale or QR labels"
        size="lg"
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: 'scan', label: isSuperAdmin ? 'POS overview' : 'Point of sale', icon: ScanLine },
          { value: 'generate', label: 'Print QR labels', icon: QrCode },
        ]}
      />
      {tab === 'scan' ? <QrScanner embedded /> : <QrGenerator embedded />}
    </Layout>
  );
}
