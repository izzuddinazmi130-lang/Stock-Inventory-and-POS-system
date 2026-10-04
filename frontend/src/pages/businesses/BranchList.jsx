import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Plus, Store, Pencil, Trash2, BarChart3, MapPin, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  Modal, FormSection, Button, Card, CardHeader, Badge, BusinessDot, Menu, PageHeader, EmptyState,
  Table, THead, TBody, TH, TR, TD, TableState, toDateInput, useConfirm, useToast,
} from '../../components/ui';
import BranchFields from '../../components/forms/BranchFields';
import CatalogPicker from '../../components/forms/CatalogPicker';

// Collect the distinct skip reasons returned by /products/add-to-branch across several requests
const collectSkipReasons = (settled) => [...new Set(settled.flatMap(r =>
  r.status === 'fulfilled'
    ? (r.value.data.results || []).filter(x => x.action === 'skipped').map(x => x.reason)
    : [r.reason?.response?.data?.message || 'request failed']
))].join('; ');

export default function BranchList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // `message` only carries errors shown inside the add/edit form; page messages are toasts
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
    contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null, name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
    contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: '', is_active: 1
  });

  // Stock existing products into the new branch at creation time
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [stockSelections, setStockSelections] = useState({}); // { [productId]: quantity }
  const [creatingBranch, setCreatingBranch] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [busRes, brRes] = await Promise.all([
        api.get(`/businesses/${id}`),
        api.get(`/businesses/${id}/branches`)
      ]);
      if (busRes.data.success) setBusiness(busRes.data.business || busRes.data.data);
      if (brRes.data.success) setBranches(brRes.data.branches || brRes.data.data || []);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load the branches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const openAddModal = async () => {
    setMessage(null);
    setStockSelections({});
    setCatalogSearch('');
    setShowAddModal(true);
    try {
      setCatalogLoading(true);
      const res = await api.get('/products/catalog', { params: { business_id: id } });
      if (res.data.success) setCatalogProducts(res.data.products || []);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Could not load this business’s products.' });
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

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setCreatingBranch(true);
    try {
      const res = await api.post('/branches', { ...addForm, business_id: id });
      if (res.data.success) {
        const newBranchId = res.data.data?.id;
        const selectedIds = Object.keys(stockSelections);

        let stockMsg = '';
        if (newBranchId && selectedIds.length > 0) {
          const results = await Promise.allSettled(
            selectedIds.map(pid =>
              api.post('/products/add-to-branch', {
                product_ids: [parseInt(pid, 10)],
                branch_ids: [newBranchId],
                initial_quantity: stockSelections[pid] || 0
              })
            )
          );
          const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.data.success).length;
          const failed = results.length - succeeded;
          stockMsg = failed > 0
            ? ` ${succeeded} existing product(s) stocked, ${failed} failed to add (${collectSkipReasons(results)}).`
            : ` ${succeeded} existing product(s) stocked into this branch.`;
        }

        toast.success(`${res.data.message}${stockMsg}`);
        setMessage(null);
        setShowAddModal(false);
        setAddForm({
          name: '', branch_code: '', address: '', city: '', state: '', postcode: '',
          contact_person: '', contact_phone: '', contact_email: '', operating_hours: '', opening_date: ''
        });
        setStockSelections({});
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to add branch' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to add branch' });
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put(`/branches/${editForm.id}`, editForm);
      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update branch' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update branch' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    const ok = await confirm({
      title: `Delete ${b.name}?`,
      message: 'This deletes the branch. A branch that has sales or a live pop-up store cannot be deleted.',
      confirmLabel: 'Delete branch',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/branches/${b.id}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchData();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete branch');
    }
  };

  const openEditModal = (b) => {
    setMessage(null);
    setEditForm({
      id: b.id,
      name: b.name || '',
      branch_code: b.branch_code || '',
      address: b.address || '',
      city: b.city || '',
      state: b.state || '',
      postcode: b.postcode || '',
      contact_person: b.contact_person || '',
      contact_phone: b.contact_phone || '',
      contact_email: b.contact_email || '',
      operating_hours: b.operating_hours || '',
      opening_date: toDateInput(b.opening_date),
      is_active: b.is_active !== undefined ? b.is_active : 1
    });
    setShowEditModal(true);
  };

  return (
    <Layout>
      <PageHeader
        breadcrumbs={[{ label: 'Businesses', to: '/businesses' }, { label: business?.name || 'Business' }]}
        title={business ? `${business.name} branches` : 'Branches'}
        description="Open a branch to see its stock, products and people."
        meta={business ? <Badge><BusinessDot business={business} size="sm" />{business.industry ? <span className="capitalize">{business.industry}</span> : business.name}</Badge> : null}
        actions={<Button icon={Plus} onClick={openAddModal}>Add branch</Button>}
      />

      {!loading && !loadError && branches.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description={`Add the first branch for ${business ? business.name : 'this business'}.`}
            action={<Button icon={Plus} onClick={openAddModal}>Add branch</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title="Branches" description={loading && branches.length === 0 ? 'Loading…' : `${branches.length} ${branches.length === 1 ? 'branch' : 'branches'}`} />
          <Table minWidth="48rem">
            <THead>
              <TR>
                <TH>Branch</TH>
                <TH>Location</TH>
                <TH>Contact</TH>
                <TH>Status</TH>
                <TH className="w-px"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              <TableState colSpan={5} loading={loading && branches.length === 0} error={!loading && loadError && branches.length === 0 ? loadError : null} onRetry={fetchData} />
              {branches.map((b, i) => (
                <TR key={b.id} index={i} onClick={() => navigate(`/branches/${b.id}`)}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg bg-sunken text-ink-secondary flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <div className="font-medium text-ink group-hover/row:text-accent transition-colors flex items-center gap-1">
                          {b.name}
                          <ChevronRight className="w-3.5 h-3.5 text-ink-subtle opacity-0 -translate-x-1 group-hover/row:opacity-100 group-hover/row:translate-x-0 transition-all" aria-hidden="true" />
                        </div>
                        <div className="text-caption text-ink-muted font-mono">{b.branch_code || `BR-${b.id}`}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="text-sm text-ink flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
                      {b.city ? `${b.city}${b.state ? `, ${b.state}` : ''}` : <span className="text-ink-muted">Not set</span>}
                    </div>
                    {b.address && <div className="text-caption text-ink-muted truncate max-w-xs">{b.address}</div>}
                  </TD>
                  <TD>
                    <div className="text-sm text-ink">{b.contact_person || <span className="text-ink-muted">Not set</span>}</div>
                    <div className="text-caption text-ink-muted">{b.contact_phone || b.contact_email || '—'}</div>
                  </TD>
                  <TD>
                    <Badge tone={b.is_active === 1 ? 'success' : 'neutral'} dot size="sm">{b.is_active === 1 ? 'Active' : 'Inactive'}</Badge>
                  </TD>
                  <TD onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <Menu
                        label={`Actions for ${b.name}`}
                        items={[
                          { label: 'Edit branch', icon: Pencil, onClick: () => openEditModal(b) },
                          { label: 'Stock reports', icon: BarChart3, to: `/reports?business_id=${b.business_id}&branch_id=${b.id}` },
                          { label: 'Pop-up stores', icon: Store, to: `/branches/${b.id}/stores` },
                          { divider: true },
                          { label: 'Delete branch', icon: Trash2, tone: 'danger', onClick: () => handleDelete(b) },
                        ]}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {showAddModal && (
        <Modal
          size="lg"
          icon={Building2}
          title={`Add a branch to ${business?.name || 'this business'}`}
          description="Only the branch name is required."
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={creatingBranch}>Create branch</Button>
          </>}
        >
          <BranchFields form={addForm} setForm={setAddForm} />
          <FormSection
            title="Starting products"
            description={`Optional. Tick products from ${business ? business.name : 'this business'}'s catalog to stock them in the new branch straight away.`}
          >
            <CatalogPicker
              products={catalogProducts}
              loading={catalogLoading}
              search={catalogSearch}
              onSearch={setCatalogSearch}
              selections={stockSelections}
              onToggle={toggleProductSelection}
              onQuantity={updateProductQuantity}
              emptyText="This business has no products yet."
            />
          </FormSection>
        </Modal>
      )}

      {showEditModal && (
        <Modal
          size="lg"
          icon={Pencil}
          title={`Edit ${editForm.name || 'branch'}`}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save changes</Button>
          </>}
        >
          <BranchFields form={editForm} setForm={setEditForm} showStatus />
        </Modal>
      )}
    </Layout>
  );
}
