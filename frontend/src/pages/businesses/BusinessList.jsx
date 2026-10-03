import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, ArrowRight, Pencil, Trash2, Phone, Mail, SlidersHorizontal, User } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  Modal, FormSection, Field, Input, Select, Textarea, Button, Card, Badge, BusinessDot, EmptyState, ErrorState, Menu, PageHeader,
  Skeleton, useConfirm, useToast,
} from '../../components/ui';

export default function BusinessList() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  // `message` only carries errors shown inside the add/edit form; page messages are toasts
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', legal_name: '', registration_number: '', industry: '',
    contact_person: '', contact_email: '', contact_phone: '', address: '', notes: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null, name: '', legal_name: '', registration_number: '', industry: '',
    contact_person: '', contact_email: '', contact_phone: '', address: '', notes: ''
  });

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/businesses');
      if (res.data.success) {
        setBusinesses(res.data.businesses || res.data.data || []);
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load the businesses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/businesses', addForm);
      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowAddModal(false);
        setAddForm({
          name: '', legal_name: '', registration_number: '', industry: '',
          contact_person: '', contact_email: '', contact_phone: '', address: '', notes: ''
        });
        fetchBusinesses();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to create business' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to create business' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/businesses/${editForm.id}`, editForm);
      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowEditModal(false);
        fetchBusinesses();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update business' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update business' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    const branchCount = Number(b.active_branch_count || b.total_branch_count || 0);
    if (branchCount > 0) {
      toast.warning(`${b.name} still has ${branchCount} branch(es). Delete or move its branches first.`);
      return;
    }

    const ok = await confirm({
      title: `Delete ${b.name}?`,
      message: 'This permanently removes the business. It cannot be undone.',
      confirmLabel: 'Delete business',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await api.delete(`/businesses/${b.id}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchBusinesses();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete business');
    }
  };

  const openEditModal = (b) => {
    setEditForm({
      id: b.id,
      name: b.name || '',
      legal_name: b.legal_name || '',
      registration_number: b.registration_number || '',
      industry: b.industry || '',
      contact_person: b.contact_person || '',
      contact_email: b.contact_email || '',
      contact_phone: b.contact_phone || '',
      address: b.address || '',
      notes: b.notes || b.description || ''
    });
    setMessage(null);
    setShowEditModal(true);
  };

  const openAdd = () => { setMessage(null); setShowAddModal(true); };

  return (
    <Layout>
      <PageHeader
        title="Businesses"
        description="Each business has its own branches, products and product form."
        actions={<Button icon={Plus} onClick={openAdd}>Add business</Button>}
      />

      {loading && businesses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : loadError && businesses.length === 0 ? (
        <Card><ErrorState description={loadError} onRetry={fetchBusinesses} /></Card>
      ) : businesses.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="No businesses yet" description="Add your first business to start creating branches and products." action={<Button icon={Plus} onClick={openAdd}>Add business</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {businesses.map((b, i) => {
            const activeBranches = Number(b.active_branch_count || 0);
            return (
              <Card key={b.id} className="flex flex-col animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-lg bg-sunken flex items-center justify-center flex-shrink-0 relative">
                        <Building2 className="w-5 h-5 text-ink-secondary" aria-hidden="true" />
                        <BusinessDot business={b} className="absolute -top-0.5 -right-0.5 ring-2 ring-surface" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-ink truncate">{b.name}</h2>
                        <p className="text-caption text-ink-muted truncate">{b.legal_name || (b.registration_number ? `Reg. ${b.registration_number}` : 'No registered name')}</p>
                      </div>
                    </div>
                    <Menu
                      label={`Actions for ${b.name}`}
                      items={[
                        { label: 'Edit details', icon: Pencil, onClick: () => openEditModal(b) },
                        { label: 'Product form', icon: SlidersHorizontal, onClick: () => navigate(`/businesses/${b.id}/forms`) },
                        { divider: true },
                        { label: 'Delete business', icon: Trash2, tone: 'danger', onClick: () => handleDelete(b) },
                      ]}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {b.industry && <Badge className="capitalize">{b.industry}</Badge>}
                    {b.registration_number && b.legal_name && <Badge className="font-mono">{b.registration_number}</Badge>}
                  </div>

                  <dl className="space-y-1.5 text-sm text-ink-secondary">
                    <div className="flex items-center gap-2"><dt className="sr-only">Contact</dt><User className="w-4 h-4 text-ink-muted flex-shrink-0" aria-hidden="true" /><dd className="truncate">{b.contact_person || <span className="text-ink-muted">No contact person</span>}</dd></div>
                    {b.contact_email && <div className="flex items-center gap-2"><dt className="sr-only">Email</dt><Mail className="w-4 h-4 text-ink-muted flex-shrink-0" aria-hidden="true" /><dd className="truncate">{b.contact_email}</dd></div>}
                    {b.contact_phone && <div className="flex items-center gap-2"><dt className="sr-only">Phone</dt><Phone className="w-4 h-4 text-ink-muted flex-shrink-0" aria-hidden="true" /><dd className="tabular-nums">{b.contact_phone}</dd></div>}
                  </dl>
                </div>

                <div className="px-5 py-3 border-t border-line-soft flex items-center justify-between gap-2 bg-subtle/60 rounded-b-xl">
                  <span className="text-sm text-ink-muted">
                    <span className="font-semibold text-ink tabular-nums">{activeBranches}</span> active {activeBranches === 1 ? 'branch' : 'branches'}
                  </span>
                  <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate(`/businesses/${b.id}/branches`)}>Branches</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <Modal
          size="lg"
          icon={Building2}
          title="Add a new business"
          description="Only the trading name is required. You can fill in the rest later."
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create business</Button>
          </>}
        >
          <BusinessFields form={addForm} setForm={setAddForm} />
        </Modal>
      )}

      {showEditModal && (
        <Modal
          size="lg"
          icon={Pencil}
          title={`Edit ${editForm.name || 'business'}`}
          description="Changes apply to this business and all of its branches."
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save changes</Button>
          </>}
        >
          <BusinessFields form={editForm} setForm={setEditForm} />
        </Modal>
      )}
    </Layout>
  );
}

// Fields shared by the Add and Edit business forms
function BusinessFields({ form, setForm }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <>
      <FormSection title="Business identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Trading name" required hint="The name staff and customers know.">
            <Input required placeholder="e.g. Kaftanasia" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Registered company name" optional>
            <Input placeholder="e.g. Kaftanasia Sdn. Bhd." value={form.legal_name} onChange={set('legal_name')} />
          </Field>
          <Field label="Registration number" optional>
            <Input placeholder="e.g. 202601099882 (123456-X)" value={form.registration_number} onChange={set('registration_number')} />
          </Field>
          <Field label="Industry" optional hint="Used to group businesses. Product form fields are set under “Product form”.">
            <Select value={form.industry} onChange={set('industry')}>
              <option value="">Choose an industry…</option>
              <option value="fashion">Fashion &amp; Apparel</option>
              <option value="technology">Technology &amp; Electronics</option>
              <option value="general">General / Other</option>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Main contact" description="Who HQ should reach about this business.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Contact person" optional>
            <Input placeholder="Full name" value={form.contact_person} onChange={set('contact_person')} />
          </Field>
          <Field label="Email" optional>
            <Input type="email" placeholder="you@gmail.com" value={form.contact_email} onChange={set('contact_email')} />
          </Field>
          <Field label="Phone" optional>
            <Input type="tel" placeholder="+60 12-33445566" value={form.contact_phone} onChange={set('contact_phone')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Other details">
        <Field label="Head office address" optional>
          <Input placeholder="Street, building, city, state" value={form.address} onChange={set('address')} />
        </Field>
        <Field label="Internal notes" optional hint="Only visible to HQ.">
          <Textarea rows={2} placeholder="Anything worth remembering about this business…" value={form.notes} onChange={set('notes')} />
        </Field>
      </FormSection>
    </>
  );
}