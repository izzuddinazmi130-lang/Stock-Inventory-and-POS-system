import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Printer, Package, Building2, Ruler, Download, ChevronDown, FileImage, FileText, Image as ImageIcon } from 'lucide-react';
import { Alert, Button, ButtonBase, Card, CardHeader, Checkbox, EmptyState, Menu, PageHeader, QuantityStepper, SearchInput, Skeleton, cn, useToast } from '../../components/ui';
import { labelImage, labelsPdf, saveBlob } from './labelExport';

// Only the label sheet is printed: everything else on the page (the app root) is hidden.
const PRINT_CSS = `
.qr-print-root { display: none; }
@media print {
  @page { margin: 8mm; }
  body > *:not(.qr-print-root) { display: none !important; }
  body { background: #fff !important; }
  .qr-print-root { display: flex !important; flex-wrap: wrap; gap: 4mm; }
  .qr-print-label {
    width: 70mm; height: 36mm; box-sizing: border-box;
    border: 0.3mm dashed #999; border-radius: 2mm; padding: 2.5mm;
    display: flex; gap: 2.5mm; align-items: center;
    break-inside: avoid; page-break-inside: avoid;
    font-family: 'Inter', system-ui, sans-serif; color: #000;
  }
  .qr-print-label .qr-box { width: 30mm; height: 30mm; flex-shrink: 0; }
  .qr-print-label .qr-box svg { width: 100%; height: 100%; display: block; }
  .qr-print-label .info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1mm; }
  .qr-print-label .name { font-size: 9pt; font-weight: 700; line-height: 1.2; max-height: 2.4em; overflow: hidden; }
  .qr-print-label .variant { font-size: 7.5pt; color: #333; }
  .qr-print-label .sku { font-family: ui-monospace, monospace; font-size: 7.5pt; }
  .qr-print-label .price { font-size: 12pt; font-weight: 800; margin-top: auto; }
}`;

const money = (v) => `RM ${(parseFloat(v) || 0).toFixed(2)}`;
const rowKey = (item) => `${item.id}-${item.branch_id}`;

// Size / colour etc. shown under the product name, e.g. "Size L · Red"
function variantLine(item) {
  if (!item) return '';
  const v = item.variants || {};
  const parts = [];
  if (v.size || item.size) parts.push(`Size ${v.size || item.size}`);
  Object.entries(v).forEach(([k, val]) => {
    if (k !== 'size' && val) parts.push(String(val));
  });
  return parts.join(' · ');
}

// The label itself, used both for the on-screen preview and the print sheet
function Label({ item, qrSvg, showPrice, print = false }) {
  const variants = variantLine(item);
  if (print) {
    return (
      <div className="qr-print-label">
        <div className="qr-box" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="info">
          <div className="name">{item.item_name}</div>
          {variants && <div className="variant">{variants}</div>}
          <div className="sku">{item.item_code}</div>
          {showPrice && <div className="price">{money(item.selling_price)}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-md aspect-[70/36] bg-surface rounded-xl border-2 border-dashed border-line-strong p-4 flex items-center gap-4 text-ink">
      <div className="h-full aspect-square flex-shrink-0 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className="min-w-0 flex-1 h-full flex flex-col py-1">
        <p className="font-bold text-base leading-snug line-clamp-2">{item.item_name}</p>
        {variants && <p className="text-sm text-ink-secondary mt-0.5 truncate">{variants}</p>}
        <p className="font-mono text-xs text-ink-muted mt-1">{item.item_code}</p>
        {showPrice && <p className="mt-auto text-xl font-extrabold">{money(item.selling_price)}</p>}
      </div>
    </div>
  );
}

export default function QrGenerator({ embedded = false }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const Wrap = embedded ? React.Fragment : Layout;
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('product_id') || '';

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [downloading, setDownloading] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        if (res.data.success) {
          const list = res.data.items || [];
          setItems(list);
          const wanted = initialProductId && list.find(i => String(i.id) === String(initialProductId));
          const first = wanted || list[0];
          if (first) setSelectedKey(rowKey(first));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load products.');
      } finally {
        setItemsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const selectedItem = useMemo(() => items.find(i => rowKey(i) === selectedKey) || null, [items, selectedKey]);

  useEffect(() => {
    if (!selectedItem) return;
    let cancelled = false;
    const generateQr = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/qr/generate/${selectedItem.id}`, {
          params: isSuperAdmin ? { branch_id: selectedItem.branch_id } : undefined
        });
        if (!cancelled && res.data.success) setQrData(res.data);
      } catch (err) {
        if (!cancelled) {
          setQrData(null);
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    generateQr();
    return () => { cancelled = true; };
  }, [selectedItem, isSuperAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.item_name || '').toLowerCase().includes(q) ||
      (i.item_code || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      variantLine(i).toLowerCase().includes(q)
    );
  }, [items, search]);

  // Details come from the product list (it has size/variants); the QR comes from /qr/generate
  const labelItem = selectedItem && qrData ? { ...qrData.item, ...selectedItem } : null;
  const canPrint = !!(labelItem && qrData?.qr_svg && !loading);
  const noPrice = labelItem && !(parseFloat(labelItem.selling_price) > 0);

  const setCopiesSafe = (n) => setCopies(Math.min(100, Math.max(1, parseInt(n, 10) || 1)));

  // Download the label as an image (one label) or a PDF (all copies on A4, like the print sheet)
  const download = async (format) => {
    if (!canPrint) return;
    setDownloading(format);
    try {
      const label = {
        name: labelItem.item_name,
        variants: variantLine(labelItem),
        sku: labelItem.item_code,
        price: showPrice ? money(labelItem.selling_price) : null,
      };
      const base = `QR-label-${String(labelItem.item_code || labelItem.id).replace(/[^A-Za-z0-9_-]+/g, '-')}`;
      if (format === 'pdf') {
        saveBlob(await labelsPdf({ qrSvg: qrData.qr_svg, label, copies }), `${base}-${copies}x.pdf`);
        toast.success(`Saved a PDF with ${copies} label${copies === 1 ? '' : 's'}.`);
      } else {
        saveBlob(await labelImage({ qrSvg: qrData.qr_svg, label, format }), `${base}.${format}`);
        toast.success(`Saved the label as ${format.toUpperCase()}.`);
      }
    } catch (err) {
      toast.error(err.message || 'Could not create the file.');
    } finally {
      setDownloading('');
    }
  };

  const StepTitle = ({ n, children }) => (
    <span className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-accent text-white text-[11px] font-semibold flex items-center justify-center">{n}</span>
      {children}
    </span>
  );

  return (
    <Wrap>
      <style>{PRINT_CSS}</style>

      <PageHeader
        title="Print QR labels"
        description="Pick a product, check the label, then print or download it (PNG, JPG or PDF). Stick the label on the item or shelf so it can be scanned at the point of sale."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left: product picker ── */}
        <Card as="section" className="lg:col-span-5 overflow-hidden">
          <CardHeader
            title={<StepTitle n={1}>Choose a product</StepTitle>}
            actions={<span className="text-caption text-ink-muted tabular-nums">{filtered.length} of {items.length}</span>}
          />
          <div className="p-3 border-b border-line-soft">
            <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, size or category…" aria-label="Search products" />
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-line-soft" role="listbox" aria-label="Products">
            {itemsLoading ? (
              <div className="p-3 space-y-2">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState compact icon={Package} title={items.length === 0 ? 'No products yet' : 'No products match your search'} />
            ) : filtered.map(item => {
              const isSelected = rowKey(item) === selectedKey;
              const variants = variantLine(item);
              return (
                <ButtonBase
                  key={rowKey(item)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedKey(rowKey(item))}
                  className={cn('w-full text-left px-4 py-3 flex items-center gap-3 border-l-[3px]', isSelected ? 'bg-accent-soft border-accent' : 'border-transparent hover:bg-subtle')}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium truncate', isSelected ? 'text-accent-fg' : 'text-ink')}>{item.item_name}</p>
                    <p className="text-caption text-ink-muted mt-0.5 truncate">
                      <span className="font-mono">{item.item_code}</span>
                      {variants && <> · {variants}</>}
                      {isSuperAdmin && item.branch_name && <> · {item.branch_name}</>}
                    </p>
                  </div>
                  <span className={cn('flex-shrink-0 text-caption font-medium tabular-nums', parseInt(item.quantity, 10) > 0 ? 'text-ink-muted' : 'text-warning-fg')}>
                    {parseInt(item.quantity, 10) || 0} in stock
                  </span>
                </ButtonBase>
              );
            })}
          </div>
        </Card>

        {/* ── Right: preview + print options ── */}
        <Card as="section" className="lg:col-span-7 overflow-hidden lg:sticky lg:top-20">
          <CardHeader title={<StepTitle n={2}>Check the label and print</StepTitle>} />

          {error && <Alert tone="danger" className="mx-4 mt-4">{error}</Alert>}

          <div className="bg-subtle m-4 rounded-xl border border-line-soft min-h-[240px] flex items-center justify-center p-6">
            {loading ? (
              <div className="w-full max-w-md flex gap-4 items-center">
                <Skeleton className="w-32 h-32 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-6 w-1/3 mt-4" /></div>
              </div>
            ) : labelItem ? (
              <div key={selectedKey} className="w-full flex justify-center animate-scale-in">
                <Label item={labelItem} qrSvg={qrData.qr_svg} showPrice={showPrice} />
              </div>
            ) : (
              <EmptyState compact icon={QrCode} title="Choose a product to see its label" />
            )}
          </div>

          {labelItem && (
            <div className="px-4 pb-1 -mt-1 text-caption text-ink-muted flex flex-wrap gap-x-4 gap-y-1">
              <span>{labelItem.category}</span>
              {labelItem.branch_name && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" aria-hidden="true" />{labelItem.branch_name}</span>}
              <span className="inline-flex items-center gap-1"><Ruler className="w-3 h-3" aria-hidden="true" />70 × 36 mm</span>
            </div>
          )}

          {noPrice && showPrice && (
            <Alert tone="warning" className="mx-4 mt-3">
              This product has no customer price yet, so the label will show RM 0.00. Set a price in Products, or untick “Show price”.
            </Alert>
          )}

          <div className="p-4 mt-3 border-t border-line-soft flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">Copies</span>
              <QuantityStepper min={1} max={100} value={copies} onChange={setCopiesSafe} label="Number of copies" />
            </div>

            <Checkbox label="Show price" className="whitespace-nowrap" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />

            <div className="flex gap-2 sm:ml-auto">
              <Menu
                label="Download label"
                align="end"
                width="w-64"
                items={[
                  { label: 'PNG image (1 label)', icon: FileImage, onClick: () => download('png') },
                  { label: 'JPG image (1 label)', icon: ImageIcon, onClick: () => download('jpg') },
                  { divider: true },
                  { label: `PDF, A4 (${copies} label${copies === 1 ? '' : 's'})`, icon: FileText, onClick: () => download('pdf') },
                ]}
                trigger={({ ref, ...props }) => (
                  <Button ref={ref} variant="secondary" icon={Download} loading={Boolean(downloading)} disabled={!canPrint} {...props}>
                    Download <ChevronDown className="w-4 h-4 -mr-1" aria-hidden="true" />
                  </Button>
                )}
              />
              <Button icon={Printer} onClick={() => window.print()} disabled={!canPrint}>
                Print {copies} label{copies === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Print-only sheet, mounted outside the app root so nothing else prints */}
      {canPrint && createPortal(
        <div className="qr-print-root">
          {Array.from({ length: copies }, (_, i) => (
            <Label key={i} item={labelItem} qrSvg={qrData.qr_svg} showPrice={showPrice} print />
          ))}
        </div>,
        document.body
      )}
    </Wrap>
  );
}
