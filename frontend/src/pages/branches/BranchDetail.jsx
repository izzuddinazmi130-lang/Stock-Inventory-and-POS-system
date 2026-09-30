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
        <div className="text-center py-12 text-slate-400 text-sm">
          Loading branch details & inventory...
        </div>
      </Layout>
    );
  }

  if (!branch) {
    return (
      <Layout>
        <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
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
      <nav className="text-sm text-slate-400 mb-4 flex items-center gap-1.5">
        <Link to="/businesses" className="hover:text-slate-900 transition-colors">Businesses</Link>
        <span>/</span>
        <Link to={`/businesses/${branch.business_id}/branches`} className="hover:text-slate-900 transition-colors">{branch.business_name || 'Business'}</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{branch.name}</span>
      </nav>

      {message && (
        <div className={`mb-6 flex items-center justify-between transition-all ${
          message.type === 'success' 
            ? 'p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm' 
            : 'p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm'
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
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{branch.name}</h1>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 font-mono">
              Code: {branch.branch_code || `BR-${branch.id}`}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dedicated inventory catalog, stock threshold metrics, and management actions for {branch.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openAddExistingModal} className="inline-flex items-center gap-2 h-9 px-3 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <Layers size={14} className="text-indigo-600" /> Add Existing Product
          </button>
          <Link to={`/products/add?business_id=${branch.business_id}&branch_id=${branch.id}`} className="inline-flex items-center gap-2 h-9 px-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Add Product
          </Link>
          {isSuperAdmin && (
            <button onClick={() => { setMessage(null); setShowEditModal(true); }} className="inline-flex items-center gap-2 h-9 px-3 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <Edit3 size={14} /> Edit Branch
            </button>
          )}
          <Link to={`/reports?business_id=${branch.business_id}&branch_id=${id}`} className="inline-flex items-center gap-2 h-9 px-3 bg-white text-indigo-600 text-sm font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors">
            <Boxes className="w-4 h-4" /> Reports
          </Link>
          <Link to={`/branches/${id}/stores`} className="inline-flex items-center gap-2 h-9 px-3 bg-white text-amber-600 text-sm font-medium rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors">
            <Store className="w-4 h-4" /> Pop-Up Stores
          </Link>
          <button onClick={fetchData} className="inline-flex items-center gap-2 h-9 px-3 bg-white text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Refresh Data">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm" style={{ borderLeft: `3px solid ${bColor}` }}>
        <div className="flex items-center gap-3 text-slate-700">
          <MapPin className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">Location</span>
            <span className="font-medium text-slate-900">{branch.city ? `${branch.city}, ${branch.state || ''}` : branch.address || 'Standard Location'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-700">
          <Users className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">Branch Contact</span>
            <span className="font-medium text-slate-900">{branch.contact_person || 'HQ Manager'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-700">
          <Phone className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">Contact Phone</span>
            <span className="font-mono font-medium text-slate-900">{branch.contact_phone || branch.contact_email || '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-700">
          <Clock className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">Operating Hours</span>
            <span className="font-medium text-slate-900">{branch.operating_hours || 'Mon - Sun 10:00 - 22:00'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">TOTAL PRODUCTS LISTED</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalItems}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Boxes size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">TOTAL PHYSICAL UNITS</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalStock}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${stats.lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">LOW STOCK ALERTS</p>
            <p className="text-2xl font-bold text-slate-900">{stats.lowStockCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Branch Products Catalog ({items.length})</h3>
          </div>
          <Link to={`/products?business_id=${branch.business_id}&branch_id=${id}`} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
            Open Full Products Manager &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">SKU & Item Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Category</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Available Stock</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-left">Selling Price</th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500 text-sm bg-white">
                    No products listed under <strong className="text-slate-900">{branch.name}</strong> yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const minQty = parseInt(item.minimum_quantity || item.min_quantity || 5);
                  const qty = parseInt(item.quantity || 0);
                  const isOutOfStock = qty <= 0;
                  const isLow = !isOutOfStock && qty <= minQty;
                  const stockBadgeClass = isOutOfStock
                    ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                    : isLow
                    ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                    : "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors bg-white">
                      <td className="px-4 py-3 text-sm border-b border-slate-100">
                        <span className="font-bold text-slate-900 block">{item.item_name}</span>
                        <span className="font-mono text-xs text-indigo-600 block">{item.item_code}</span>
                      </td>
                      <td className="px-4 py-3 text-sm border-b border-slate-100">
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700">{item.category || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 text-sm">
                        <div className="flex items-center gap-2 font-mono font-bold">
                          <span className={stockBadgeClass}>
                            {item.quantity} units
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">Min: {minQty}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-900 font-semibold border-b border-slate-100">
                        RM {parseFloat(item.selling_price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm border-b border-slate-100 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Link
                            to={`/products?business_id=${branch.business_id}&branch_id=${id}&product_id=${item.id}`}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            title="Manage Stock Balance for this Product"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Manage
                          </Link>
                          <Link
                            to={`/qr/generate?product_id=${item.id}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 transition-colors"
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

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users size={22} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Assigned Personnel ({admins.length})</h4>
            <p className="text-sm text-slate-500 mt-0.5">
              {admins.length > 0 ? admins.map(a => a.full_name).join(', ') : 'No dedicated branch admin assigned yet'}
            </p>
          </div>
        </div>
        <Link 
          to={`/users?business_id=${branch.business_id}&branch_id=${branch.id}`} 
          className="inline-flex items-center gap-2 h-9 px-3 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
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