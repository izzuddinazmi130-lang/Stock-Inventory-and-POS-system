import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building, Plus, Store, Edit3, Trash2, X, CheckCircle, AlertCircle, FileBarChart, ExternalLink, Search, CheckSquare, Square, Layers, RefreshCw } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Modal, FormSection, PrimaryButton, SecondaryButton, toDateInput } from '../../components/ui/Form';
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
  const [message, setMessage] = useState(null);

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
      const [busRes, brRes] = await Promise.all([
        api.get(`/businesses/${id}`),
        api.get(`/businesses/${id}/branches`)
      ]);
      if (busRes.data.success) setBusiness(busRes.data.business || busRes.data.data);
      if (brRes.data.success) setBranches(brRes.data.branches || brRes.data.data || []);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to fetch branch network' });
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
      setMessage({ type: 'danger', text: 'Failed to load the business product catalog.' });
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

        setMessage({ type: 'success', text: `${res.data.message}${stockMsg}` });
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
      const res = await api.put(`/branches/${editForm.id}`, editForm);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update branch' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update branch' });
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Are you sure you want to delete branch '${b.name}'?`)) return;
    try {
      const res = await api.delete(`/branches/${b.id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to delete branch' });
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
      <nav className="text-sm text-ink-muted flex items-center gap-1.5 mb-4">
        <Link to="/businesses" className="hover:text-ink transition-colors">Businesses</Link>
        <span>/</span>
        <span className="text-ink font-semibold">{business ? business.name : 'Loading...'}</span>
      </nav>

      {message && (
        <div className={`mb-6 flex items-center justify-between transition-all ${
          message.type === 'success' 
            ? 'p-3 bg-success-soft border border-success-line rounded-xl text-success-fg text-sm' 
            : 'p-3 bg-danger-soft border border-danger-line rounded-xl text-danger-fg text-sm'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">{business ? business.name : 'Branches'}</h1>
          <p className="text-sm text-ink-muted mt-1">Operational branch locations under {business ? business.name : 'this business'}. Click any branch to enter its dashboard.</p>
        </div>
        <button onClick={openAddModal} className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors mt-4 sm:mt-0">
          <Plus size={18} />
          Add Branch
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-ink-muted text-sm">Loading branch network...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 bg-subtle border border-line rounded-xl flex flex-col items-center justify-center">
          <Building className="w-12 h-12 text-ink-subtle mb-3" />
          <p className="text-ink-secondary font-medium">No branches yet</p>
          <p className="text-sm text-ink-muted mb-4">No branches registered under {business ? business.name : 'this business'} yet.</p>
          <button onClick={openAddModal} className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors">
            <Plus size={16} /> Add Branch
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
            <h3 className="font-semibold text-ink text-sm">Branch Network ({branches.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Branch Name & Code</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Location / Address</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Contact Person</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {branches.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-subtle transition-colors group cursor-pointer bg-surface"
                    onClick={(e) => {
                      if (e.target.closest('button') || e.target.closest('a')) return;
                      navigate(`/branches/${b.id}`);
                    }}
                  >
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-soft text-accent rounded-lg">
                          <Building size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-ink group-hover:text-accent transition-colors">{b.name}</span>
                            <ExternalLink size={12} className="text-ink-muted group-hover:text-accent opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                          <span className="text-xs text-ink-muted">Code: {b.branch_code || `BR-${b.id}`}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <div className="font-medium">{b.city ? `${b.city}${b.state ? `, ${b.state}` : ''}` : 'Location Set'}</div>
                      <div className="text-ink-muted text-xs truncate max-w-xs">{b.address || 'Standard Address'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <div>{b.contact_person || 'HQ Manager'}</div>
                      <div className="text-ink-muted text-xs">{b.contact_phone || b.contact_email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft">
                      <span className={b.is_active === 1 
                        ? 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-success-soft text-success-fg' 
                        : 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-sunken text-ink-secondary'}>
                        {b.is_active === 1 ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-b border-line-soft text-right">
                      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditModal(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-ink-secondary border border-line hover:bg-subtle transition-colors"
                          title="Edit Branch"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/reports?business_id=${b.business_id}&branch_id=${b.id}`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-accent border border-line hover:bg-accent-soft transition-colors"
                          title="View Reports"
                        >
                          <FileBarChart size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/branches/${b.id}/stores`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-warning-fg border border-line hover:bg-warning-soft transition-colors"
                          title="View Stores"
                        >
                          <Store size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-danger-soft text-danger-fg border border-danger-line hover:bg-danger-muted transition-colors"
                          title="Delete Branch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <Modal
          size="lg"
          icon={Building}
          title={`Add a branch to ${business?.name || 'this business'}`}
          description="Only the branch name is required."
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={creatingBranch}>
              {creatingBranch ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : 'Create branch'}
            </PrimaryButton>
          </>}
        >
          <BranchFields form={addForm} setForm={setAddForm} />
          <FormSection
            title="Starting products (optional)"
            description={`Tick products from ${business ? business.name : 'this business'}'s catalog to stock them in the new branch straight away.`}
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
          icon={Edit3}
          title={`Edit ${editForm.name || 'branch'}`}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton>Save changes</PrimaryButton>
          </>}
        >
          <BranchFields form={editForm} setForm={setEditForm} showStatus />
        </Modal>
      )}
    </Layout>
  );
}