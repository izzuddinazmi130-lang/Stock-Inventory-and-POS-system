import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Package, Boxes, AlertTriangle, ArrowDownLeft, RefreshCw,
  QrCode, Building, Users, Store, Edit3, X, Plus, Phone, Mail, Clock, MapPin, CheckCircle, AlertCircle,
  Search, CheckSquare, Square, Layers
} from 'lucide-react';
import Layout from '../../components/Layout';
import KpiCard from '../../components/KpiCard';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Modal, PrimaryButton, SecondaryButton, toDateInput } from '../../components/ui/Form';
import BranchFields from '../../components/forms/BranchFields';
import CatalogPicker from '../../components/forms/CatalogPicker';

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
  const [message, setMessage] = useState(null);

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
      setMessage({ type: 'danger', text: 'Failed to load branch details & inventory' });
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
      const res = await api.put(`/branches/${id}`, editForm);
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Branch information updated successfully!' });
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || 'Failed to update branch' });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update branch' });
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

  const handleAddExistingSubmit = async (e) => {
    e.preventDefault();
    const selectedIds = Object.keys(stockSelections);
    if (selectedIds.length === 0) {
      setMessage({ type: 'danger', text: 'Please select at least one product to add to this branch.' });
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
        setMessage({
          type: failed > 0 ? 'danger' : 'success',
          text: failed > 0
            ? `${succeeded} product(s) added to ${branch.name}, but ${failed} failed (${collectSkipReasons(results)}).`
            : `${succeeded} product(s) successfully added to ${branch.name}'s stock.`
        });
        setShowAddExistingModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: `Failed to add the selected product(s) to this branch: ${collectSkipReasons(results)}` });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to add products to this branch.' });
    } finally {
      setAddingExisting(false);
    }
  };

  // Search filtering happens inside CatalogPicker
  const availableCatalogProducts = catalogProducts.filter(p => !stockedProductIds.has(p.id));

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-ink-muted text-sm">
          Loading branch details & inventory...
        </div>
      </Layout>
    );
  }

  if (!branch) {
    return (
      <Layout>
        <div className="text-center py-12 bg-subtle border border-line rounded-xl text-ink-secondary">
          Branch profile not found.
        </div>
      </Layout>
    );
  }

  const stats = branch.stats || { totalItems: items.length, totalStock: 0, lowStockCount: 0 };
  const admins = branch.admins || [];
  
  const getBusinessColor = (name) => {
    const text = (name || '').toLowerCase();
    if (text.includes('kaftanasia') || text.includes('fashion')) return '#B4502E';
    if (text.includes('as tech') || text.includes('technology')) return '#2563EB';
    return '#6366f1'; 
  };
  const bColor = getBusinessColor(branch.business_name);

  return (
    <Layout>
      <nav className="text-sm text-ink-muted mb-4 flex items-center gap-1.5">
        <Link to="/businesses" className="hover:text-ink transition-colors">Businesses</Link>
        <span>/</span>
        <Link to={`/businesses/${branch.business_id}/branches`} className="hover:text-ink transition-colors">{branch.business_name || 'Business'}</Link>
        <span>/</span>
        <span className="text-ink font-semibold">{branch.name}</span>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">{branch.name}</h1>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-accent-soft text-accent-fg font-mono">
              Code: {branch.branch_code || `BR-${branch.id}`}
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Dedicated inventory catalog, stock threshold metrics, and management actions for {branch.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openAddExistingModal} className="inline-flex items-center gap-2 h-9 px-3 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors shadow-sm">
            <Layers size={14} className="text-accent" /> Add Existing Product
          </button>
          <Link to={`/products/add?business_id=${branch.business_id}&branch_id=${branch.id}`} className="inline-flex items-center gap-2 h-9 px-3 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors">
            <Plus size={16} /> Add Product
          </Link>
          {isSuperAdmin && (
            <button onClick={() => { setMessage(null); setShowEditModal(true); }} className="inline-flex items-center gap-2 h-9 px-3 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors">
              <Edit3 size={14} /> Edit Branch
            </button>
          )}
          <Link to={`/reports?business_id=${branch.business_id}&branch_id=${id}`} className="inline-flex items-center gap-2 h-9 px-3 bg-surface text-accent text-sm font-medium rounded-lg border border-accent-line hover:bg-accent-soft transition-colors">
            <Boxes className="w-4 h-4" /> Reports
          </Link>
          <Link to={`/branches/${id}/stores`} className="inline-flex items-center gap-2 h-9 px-3 bg-surface text-warning-fg text-sm font-medium rounded-lg border border-warning-line hover:bg-warning-soft transition-colors">
            <Store className="w-4 h-4" /> Pop-Up Stores
          </Link>
          <button onClick={fetchData} className="inline-flex items-center gap-2 h-9 px-3 bg-surface text-ink-secondary text-sm font-medium rounded-lg border border-line hover:bg-subtle transition-colors" title="Refresh Data">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm" style={{ borderLeft: `3px solid ${bColor}` }}>
        <div className="flex items-center gap-3 text-ink-secondary">
          <MapPin className="w-5 h-5 text-accent flex-shrink-0" />
          <div className="truncate">
            <span className="text-ink-muted block text-[11px] font-semibold uppercase">Location</span>
            <span className="font-medium text-ink">{branch.city ? `${branch.city}, ${branch.state || ''}` : branch.address || 'Standard Location'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-ink-secondary">
          <Users className="w-5 h-5 text-success-fg flex-shrink-0" />
          <div className="truncate">
            <span className="text-ink-muted block text-[11px] font-semibold uppercase">Branch Contact</span>
            <span className="font-medium text-ink">{branch.contact_person || 'HQ Manager'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-ink-secondary">
          <Phone className="w-5 h-5 text-warning-fg flex-shrink-0" />
          <div className="truncate">
            <span className="text-ink-muted block text-[11px] font-semibold uppercase">Contact Phone</span>
            <span className="font-mono font-medium text-ink">{branch.contact_phone || branch.contact_email || '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-ink-secondary">
          <Clock className="w-5 h-5 text-violet-fg flex-shrink-0" />
          <div className="truncate">
            <span className="text-ink-muted block text-[11px] font-semibold uppercase">Operating Hours</span>
            <span className="font-medium text-ink">{branch.operating_hours || 'Mon - Sun 10:00 - 22:00'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-accent-soft text-accent rounded-lg">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted">TOTAL PRODUCTS LISTED</p>
            <p className="text-2xl font-bold text-ink">{stats.totalItems}</p>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-success-soft text-success-fg rounded-lg">
            <Boxes size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted">TOTAL PHYSICAL UNITS</p>
            <p className="text-2xl font-bold text-ink">{stats.totalStock}</p>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${stats.lowStockCount > 0 ? 'bg-danger-soft text-danger-fg' : 'bg-warning-soft text-warning-fg'}`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted">LOW STOCK ALERTS</p>
            <p className="text-2xl font-bold text-ink">{stats.lowStockCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-ink text-sm">Branch Products Catalog ({items.length})</h3>
          </div>
          <Link to={`/products?business_id=${branch.business_id}&branch_id=${id}`} className="text-sm text-accent hover:text-accent-fg font-semibold transition-colors">
            Open Full Products Manager &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">SKU & Item Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Category</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Available Stock</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-left">Selling Price</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-ink-muted bg-subtle border-b border-line text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-ink-muted text-sm bg-surface">
                    No products listed under <strong className="text-ink">{branch.name}</strong> yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const minQty = parseInt(item.minimum_quantity || item.min_quantity || 5);
                  const qty = parseInt(item.quantity || 0);
                  const isOutOfStock = qty <= 0;
                  const isLow = !isOutOfStock && qty <= minQty;
                  const stockBadgeClass = isOutOfStock
                    ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-danger-soft text-danger-fg border border-danger-line"
                    : isLow
                    ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning-fg border border-warning-line"
                    : "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-success-soft text-success-fg border border-success-line";

                  return (
                    <tr key={item.id} className="hover:bg-subtle transition-colors bg-surface">
                      <td className="px-4 py-3 text-sm border-b border-line-soft">
                        <span className="font-bold text-ink block">{item.item_name}</span>
                        <span className="font-mono text-xs text-accent block">{item.item_code}</span>
                      </td>
                      <td className="px-4 py-3 text-sm border-b border-line-soft">
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-info-soft text-info-fg">{item.category || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-line-soft text-sm">
                        <div className="flex items-center gap-2 font-mono font-bold">
                          <span className={stockBadgeClass}>
                            {item.quantity} units
                          </span>
                        </div>
                        <div className="text-[10px] text-ink-muted mt-1 font-mono">Min: {minQty}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-ink font-semibold border-b border-line-soft">
                        RM {parseFloat(item.selling_price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm border-b border-line-soft text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Link
                            to={`/products?business_id=${branch.business_id}&branch_id=${id}&product_id=${item.id}`}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-success-soft text-success-fg text-xs font-medium rounded-lg border border-success-line hover:bg-success-muted transition-colors"
                            title="Manage Stock Balance for this Product"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Manage
                          </Link>
                          <Link
                            to={`/qr/generate?product_id=${item.id}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-accent border border-line hover:bg-accent-soft transition-colors"
                            title="Generate QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 flex items-center justify-between mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-accent-soft text-accent rounded-lg">
            <Users size={22} />
          </div>
          <div>
            <h4 className="font-bold text-ink text-sm">Assigned Personnel ({admins.length})</h4>
            <p className="text-sm text-ink-muted mt-0.5">
              {admins.length > 0 ? admins.map(a => a.full_name).join(', ') : 'No dedicated branch admin assigned yet'}
            </p>
          </div>
        </div>
        <Link 
          to={`/users?business_id=${branch.business_id}&branch_id=${branch.id}`} 
          className="inline-flex items-center gap-2 h-9 px-3 text-ink-secondary text-sm font-medium rounded-lg hover:bg-sunken hover:text-ink transition-colors"
        >
          Manage Personnel
        </Link>
      </div>

      {showEditModal && (
        <Modal
          size="lg"
          icon={Edit3}
          title={`Edit ${branch.name}`}
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

      {showAddExistingModal && (
        <Modal
          icon={Layers}
          title={`Add products to ${branch.name}`}
          description={`Pick products that already exist in ${branch.business_name}'s catalog. Products already in this branch are not listed.`}
          onClose={() => setShowAddExistingModal(false)}
          onSubmit={handleAddExistingSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <SecondaryButton onClick={() => setShowAddExistingModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={Object.keys(stockSelections).length === 0 || addingExisting}>
              {addingExisting
                ? <><RefreshCw size={14} className="animate-spin" /> Adding…</>
                : <><Layers size={14} /> Add {Object.keys(stockSelections).length || ''} to branch</>}
            </PrimaryButton>
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
              ? 'This business has no products yet.'
              : 'Every catalog product is already in this branch.'}
          />
        </Modal>
      )}
    </Layout>
  );
}