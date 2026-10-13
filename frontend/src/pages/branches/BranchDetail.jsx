import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Package, Boxes, PackageMinus, ArrowUpDown, RefreshCw, QrCode, Users, Store, Pencil, Plus, Phone, Clock, MapPin,
  Layers, BarChart3, Building2,
} from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Modal, Button, IconButton, Card, CardHeader, KpiCard, Menu, PageHeader, Badge, BusinessDot, StatusPill, EmptyState, ErrorState,
  Skeleton, SkeletonKpi, Table, THead, TBody, TH, TR, TD, TableState, toDateInput, useToast, cn,
} from '../../components/ui';
import BranchFields from '../../components/forms/BranchFields';
import CatalogPicker from '../../components/forms/CatalogPicker';
import { t } from '../../i18n';

// Collect the distinct skip reasons returned by /products/add-to-branch across several requests
const collectSkipReasons = (settled) => [...new Set(settled.flatMap(r =>
  r.status === 'fulfilled'
    ? (r.value.data.results || []).filter(x => x.action === 'skipped').map(x => x.reason)
    : [r.reason?.response?.data?.message || 'request failed']
))].join('; ');

export default function BranchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [branch, setBranch] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // `message` only carries errors shown inside a modal; page messages are toasts
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
    contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: '', is_active: 1
  });

  // Add Existing Product to this Branch
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [stockSelections, setStockSelections] = useState({}); // { [productId]: quantity }
  const [addingExisting, setAddingExisting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [branchRes, productsRes] = await Promise.all([
        api.get(`/branches/${id}`),
        api.get('/products', { params: { branch_id: id } })
      ]);

      if (branchRes.data.success) {
        const brData = branchRes.data.data || branchRes.data.branch;
        setBranch(brData);
        setEditForm({
          name: brData.name || '', branch_code: brData.branch_code || '', address: brData.address || '',
          city: brData.city || '', state: brData.state || '', postcode: brData.postcode || '',
          contact_person: brData.contact_person || '', contact_phone: brData.contact_phone || '',
          contact_email: brData.contact_email || '', operating_hours: brData.operating_hours || '',
          opening_date: toDateInput(brData.opening_date), is_active: brData.is_active ?? 1
        });
      }
      if (productsRes.data.success) {
        setItems(productsRes.data.items || []);
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || t('Could not load this branch.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put(`/branches/${id}`, editForm);
      if (res.data.success) {
        toast.success(t('Branch details saved.'));
        setMessage(null);
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || t('Failed to update branch') });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || t('Failed to update branch') });
    } finally {
      setSaving(false);
    }
  };

  // Products already stocked at this branch (so we don't list duplicates in the catalog picker)
  const stockedProductIds = new Set(items.map(it => it.id));

  const openAddExistingModal = async () => {
    setMessage(null);
    setStockSelections({});
    setCatalogSearch('');
    setShowAddExistingModal(true);
    try {
      setCatalogLoading(true);
      const res = await api.get('/products/catalog', { params: { business_id: branch.business_id } });
      if (res.data.success) setCatalogProducts(res.data.products || []);
    } catch {
      setMessage({ type: 'danger', text: t('Could not load this business’s products.') });
    } finally {
      setCatalogLoading(false);
    }
  };

  const toggleProductSelection = (productId) => {
    setStockSelections(prev => {
      const next = { ...prev };
      if (productId in next) {
        delete next[productId];
      } else {
        next[productId] = 0;
      }
      return next;
    });
  };

  const updateProductQuantity = (productId, qty) => {
    setStockSelections(prev => ({ ...prev, [productId]: Math.max(0, parseInt(qty, 10) || 0) }));
  };

  const handleAddExistingSubmit = async (e) => {
    e.preventDefault();
    const selectedIds = Object.keys(stockSelections);
    if (selectedIds.length === 0) {
      setMessage({ type: 'danger', text: t('Please select at least one product to add to this branch.') });
      return;
    }

    setAddingExisting(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map(pid =>
          api.post('/products/add-to-branch', {
            product_ids: [parseInt(pid, 10)],
            branch_ids: [parseInt(id, 10)],
            initial_quantity: stockSelections[pid] || 0
          })
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.data.success).length;
      const failed = results.length - succeeded;

      if (succeeded > 0) {
        if (failed > 0) toast.warning(t('{succeeded} product(s) added to {name}, but {failed} failed ({results}).', { succeeded, name: branch.name, failed, results: collectSkipReasons(results) }));
        else toast.success(t('{succeeded} product(s) added to {name}.', { succeeded, name: branch.name }));
        setMessage(null);
        setShowAddExistingModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: t('Failed to add the selected product(s) to this branch: {results}', { results: collectSkipReasons(results) }) });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || t('Failed to add products to this branch.') });
    } finally {
      setAddingExisting(false);
    }
  };

  // Search filtering happens inside CatalogPicker
  const availableCatalogProducts = catalogProducts.filter(p => !stockedProductIds.has(p.id));

  if (loading && !branch) {
    return (
      <Layout>
        <Skeleton className="h-4 w-48 mb-3" />
        <Skeleton className="h-8 w-72 mb-8" />
        <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">{[0, 1, 2].map(i => <SkeletonKpi key={i} />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </Layout>
    );
  }

  if (!branch) {
    return (
      <Layout>
        <Card>
          {loadError
            ? <ErrorState description={loadError} onRetry={fetchData} />
            : <EmptyState icon={Building2} title={t('Branch not found')} description={t('It may have been deleted.')} action={<Button variant="secondary" to="/businesses">{t('Back to businesses')}</Button>} />}
        </Card>
      </Layout>
    );
  }

  const stats = branch.stats || { totalItems: items.length, totalStock: 0, lowStockCount: 0 };
  const admins = branch.admins || [];
  const inactive = Number(branch.is_active) === 0;

  return (
    <Layout>
      <PageHeader
        breadcrumbs={[
          { label: t('Businesses'), to: '/businesses' },
          { label: branch.business_name || t('Business'), to: `/businesses/${branch.business_id}/branches` },
          { label: branch.name },
        ]}
        title={branch.name}
        description={t('Stock, alerts and people for {name}.', { name: branch.name })}
        meta={<>
          <Badge tone="neutral" className="font-mono">{branch.branch_code || `BR-${branch.id}`}</Badge>
          <Badge tone="neutral"><BusinessDot business={{ name: branch.business_name, id: branch.business_id }} size="sm" />{branch.business_name}</Badge>
          {inactive && <Badge tone="warning">{t('Inactive')}</Badge>}
        </>}
        actions={<>
          <Button variant="secondary" icon={Layers} onClick={openAddExistingModal}>{t('Add existing product')}</Button>
          <Button icon={Plus} to={`/products/add?business_id=${branch.business_id}&branch_id=${branch.id}`}>{t('Add product')}</Button>
          <Menu
            label={t('More branch actions')}
            triggerVariant="secondary"
            triggerSize="md"
            items={[
              { label: t('Edit branch'), icon: Pencil, onClick: () => { setMessage(null); setShowEditModal(true); }, hidden: !isSuperAdmin },
              { label: t('Stock reports'), icon: BarChart3, to: `/reports?business_id=${branch.business_id}&branch_id=${id}` },
              { label: t('Pop-up stores'), icon: Store, to: `/branches/${id}/stores` },
              { divider: true },
              { label: t('Refresh'), icon: RefreshCw, onClick: fetchData },
            ]}
          />
        </>}
      />

      <Card className="p-4 mb-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {[
            [MapPin, t('Location'), branch.city ? `${branch.city}${branch.state ? `, ${branch.state}` : ''}` : branch.address || t('Not set')],
            [Users, t('Contact person'), branch.contact_person || t('Not set')],
            [Phone, t('Phone / email'), branch.contact_phone || branch.contact_email || t('Not set')],
            [Clock, t('Opening hours'), branch.operating_hours || t('Not set')],
          ].map(([Icon, label, value]) => (
            <div key={label} className="flex items-start gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-sunken text-ink-secondary flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" aria-hidden="true" /></span>
              <div className="min-w-0">
                <dt className="text-caption text-ink-muted">{label}</dt>
                <dd className={cn('font-medium truncate', value === t('Not set') ? 'text-ink-muted' : 'text-ink')}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard label={t('Products')} value={Number(stats.totalItems) || 0} icon={Package} tone="accent" meta={t('Stocked in this branch')} />
        <KpiCard label={t('Items in stock')} value={Number(stats.totalStock) || 0} icon={Boxes} tone="success" meta={t('All products')} />
        <KpiCard label={t('Low stock')} value={Number(stats.lowStockCount) || 0} icon={PackageMinus} tone={stats.lowStockCount > 0 ? 'warning' : 'success'} meta={stats.lowStockCount > 0 ? t('Need restocking') : t('All healthy')} metaTone={stats.lowStockCount > 0 ? 'danger' : 'success'} />
      </div>

      <Card className="overflow-hidden mb-6">
        <CardHeader
          icon={Package}
          title={t('Products in this branch')}
          description={t('{n} {n|product|products}', { n: items.length })}
          actions={<Button variant="ghost" size="sm" to={`/products?business_id=${branch.business_id}&branch_id=${id}`}>{t('Open in Products')}</Button>}
        />
        <Table minWidth="44rem">
          <THead>
            <TR>
              <TH>{t('Product')}</TH>
              <TH>{t('Category')}</TH>
              <TH>{t('Stock')}</TH>
              <TH numeric>{t('Price')}</TH>
              <TH className="w-px"><span className="sr-only">{t('Actions')}</span></TH>
            </TR>
          </THead>
          <TBody>
            <TableState
              colSpan={5}
              empty={items.length === 0}
              emptyIcon={Package}
              emptyTitle={t('No products in {name} yet', { name: branch.name })}
              emptyAction={<Button size="sm" icon={Plus} to={`/products/add?business_id=${branch.business_id}&branch_id=${branch.id}`}>{t('Add product')}</Button>}
            />
            {items.map((item, i) => {
              const minQty = parseInt(item.minimum_quantity ?? item.min_quantity ?? 0, 10) || 0;
              const qty = parseInt(item.quantity || 0, 10);
              const level = item.stock_status || (qty <= 0 ? 'out' : qty <= minQty ? 'low' : 'ok');
              return (
                <TR key={`${item.id}-${item.branch_id}`} index={i}>
                  <TD>
                    <div className="font-medium text-ink">{item.item_name}</div>
                    <div className="font-mono text-caption text-ink-muted">{item.item_code}</div>
                  </TD>
                  <TD className="text-ink-secondary">{item.category || t('General')}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-semibold tabular-nums', level === 'out' ? 'text-danger-fg' : level === 'low' ? 'text-warning-fg' : 'text-ink')}>{item.quantity}</span>
                      <StatusPill kind="stock" value={level} size="sm" showIcon={false} />
                    </div>
                    <div className="text-caption text-ink-muted tabular-nums mt-0.5">{t('Alert at ')}{minQty}</div>
                  </TD>
                  <TD numeric className="font-semibold">{t('RM ')}{parseFloat(item.selling_price || 0).toFixed(2)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="secondary" size="sm" icon={ArrowUpDown} to={`/products?business_id=${branch.business_id}&branch_id=${id}&product_id=${item.id}`}>{t('Adjust')}</Button>
                      <IconButton icon={QrCode} label={t('Print QR label')} to={`/qr/generate?product_id=${item.id}`} />
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{t('Branch admins')}{' '}<span className="text-ink-muted font-normal tabular-nums">({admins.length})</span></h2>
            <p className="text-sm text-ink-muted truncate">{admins.length > 0 ? admins.map(a => a.full_name).join(', ') : t('No branch admin assigned yet')}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" to={`/users?business_id=${branch.business_id}&branch_id=${branch.id}`}>{t('Manage people')}</Button>
      </Card>

      {showEditModal && (
        <Modal
          size="lg"
          icon={Pencil}
          title={t('Edit {name}', { name: branch.name })}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={saving}>{t('Save changes')}</Button>
          </>}
        >
          <BranchFields form={editForm} setForm={setEditForm} showStatus />
        </Modal>
      )}

      {showAddExistingModal && (
        <Modal
          icon={Layers}
          title={t('Add products to {name}', { name: branch.name })}
          description={t('Pick products that already exist in {business_name}\'s catalog. Products already in this branch are not listed.', { business_name: branch.business_name })}
          onClose={() => setShowAddExistingModal(false)}
          onSubmit={handleAddExistingSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowAddExistingModal(false)}>{t('Cancel')}</Button>
            <Button type="submit" icon={Layers} loading={addingExisting} disabled={Object.keys(stockSelections).length === 0}>
              {addingExisting ? t('Adding…') : t('Add {value} to branch', { value: Object.keys(stockSelections).length || '' })}
            </Button>
          </>}
        >
          <CatalogPicker
            products={availableCatalogProducts}
            loading={catalogLoading}
            search={catalogSearch}
            onSearch={setCatalogSearch}
            selections={stockSelections}
            onToggle={toggleProductSelection}
            onQuantity={updateProductQuantity}
            emptyText={catalogProducts.length === 0
              ? t('This business has no products yet.')
              : t('Every catalog product is already in this branch.')}
          />
        </Modal>
      )}
    </Layout>
  );
}
