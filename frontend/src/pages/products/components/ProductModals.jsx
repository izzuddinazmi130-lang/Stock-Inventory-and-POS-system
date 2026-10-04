import React from 'react';
import { SKU_HINT, normalizeSku, useSkuCheck, SkuStatus } from '../skuField';
import {
  ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, ArrowUpDown, Pencil, Save, QrCode, Printer, Building2, Package,
} from 'lucide-react';
import {
  Modal, Button, Field, FormSection, Input, Select, MoneyInput, ChoiceCards, SearchInput, Checkbox, Alert, Badge,
  EmptyState, Skeleton, cn,
} from '../../../components/ui';

// Business form-config options may be a JSON array, a JSON string or a comma list
export function parseFormOptions(options) {
  if (Array.isArray(options)) return options;
  if (typeof options !== 'string') return [];
  try { const parsed = JSON.parse(options); return Array.isArray(parsed) ? parsed : []; }
  catch { return options.split(',').map(o => o.trim()).filter(Boolean); }
}

// ── Adjust stock ────────────────────────────────────────────────────────────
export function AdjustStockModal({ item, form, setForm, branches, currentQty, newQty, error, onDismissError, onClose, onSubmit, saving }) {
  return (
    <Modal
      icon={ArrowUpDown}
      title="Adjust stock"
      description={<>{item.item_name} <span className="font-mono text-accent">({item.item_code})</span></>}
      onClose={onClose}
      onSubmit={onSubmit}
      error={error}
      onDismissError={onDismissError}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Save adjustment</Button>
      </>}
    >
      {branches.length > 1 && (
        <Field label="Branch" required>
          <Select required value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}>
            <option value="">Choose a branch…</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      )}

      <Field label="What happened?">
        <ChoiceCards
          columns={3}
          name="Adjustment type"
          value={form.adjustment_type}
          onChange={v => setForm({ ...form, adjustment_type: v })}
          options={[
            { value: 'in', icon: ArrowDownToLine, activeColor: 'text-success-fg', label: 'Stock in', description: 'New stock arrived.' },
            { value: 'out', icon: ArrowUpFromLine, activeColor: 'text-info-fg', label: 'Stock out', description: 'Taken out, not through the POS.' },
            { value: 'adjust', icon: SlidersHorizontal, activeColor: 'text-violet-fg', label: 'Set exact count', description: 'After counting the shelf.' },
          ]}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={form.adjustment_type === 'adjust' ? 'Actual count on shelf' : 'Quantity'} required>
          <Input type="number" min={form.adjustment_type === 'adjust' ? 0 : 1} step="1" required inputMode="numeric" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="font-mono" suffix="units" />
        </Field>
        {form.adjustment_type === 'out' && (
          <Field label="Payment method" hint="Used in the sales report.">
            <Select value={form.payment_method || 'cash'} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="qr">QR / e-Wallet</option>
              <option value="online_banking">Online Banking</option>
            </Select>
          </Field>
        )}
      </div>

      {currentQty != null && (
        <div className={cn('p-3 rounded-lg border text-sm flex items-center justify-between transition-colors', newQty < 0 ? 'bg-danger-soft border-danger-line text-danger-fg' : 'bg-subtle border-line text-ink-secondary')}>
          <span>Stock after saving</span>
          <span className="font-mono font-semibold tabular-nums">
            {currentQty} → <span className={newQty < 0 ? 'text-danger-fg' : 'text-accent-fg'}>{newQty}</span>
          </span>
        </div>
      )}

      <Field label="Note" optional>
        <Input placeholder="e.g. Delivery from supplier, invoice #1234" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
      </Field>
    </Modal>
  );
}

// ── Edit product ────────────────────────────────────────────────────────────
export function EditProductModal({ item, form, setForm, config, error, onDismissError, onClose, onSubmit, saving }) {
  const skuCheck = useSkuCheck([form.sku || ''], item.id);
  const skuStatus = skuCheck(form.sku);
  const skuChanged = normalizeSku(form.sku) !== String(item.item_code || item.sku || '');
  const skuProblem = skuStatus?.state === 'taken' || skuStatus?.state === 'invalid' ? skuStatus.message : '';
  return (
    <Modal
      size="lg"
      icon={Pencil}
      title="Edit product"
      description="Changes apply in every branch that carries this product."
      onClose={onClose}
      onSubmit={onSubmit}
      error={error}
      onDismissError={onDismissError}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" icon={Save} loading={saving} disabled={Boolean(skuProblem)}>Save changes</Button>
      </>}
    >
      <FormSection title="Product">
        <Field label="Product name" required>
          <Input required value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
        </Field>
        <Field
          label="SKU"
          required
          error={skuProblem}
          hint={skuProblem ? undefined : (skuChanged
            ? `Was ${item.item_code || item.sku}. Labels already printed with the old SKU still scan; print new labels when you can.`
            : SKU_HINT)}
        >
          <Input
            required
            value={form.sku}
            onChange={e => setForm({ ...form, sku: e.target.value })}
            error={Boolean(skuProblem)}
            maxLength={50}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          {skuChanged && <SkuStatus status={skuStatus} />}
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Category" required>
            <Select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} disabled={config.loading}>
              <option value="">Choose a category…</option>
              {/* Keep the current value selectable even if it was removed from the business's list */}
              {form.category && !config.categories.some(c => c.name === form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
              {config.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Status" hint={form.status === 'discontinued' ? 'Hidden from the POS and the product list.' : 'Out of stock / low stock is worked out from each branch’s quantity.'}>
            <Select value={form.status || 'available'} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="available">Selling</option>
              <option value="discontinued">Discontinued</option>
            </Select>
          </Field>
        </div>
        {config.attributes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.attributes.map(attr => {
              const value = form.variants?.[attr.attribute_key] || '';
              const setValue = (v) => setForm({ ...form, variants: { ...form.variants, [attr.attribute_key]: v } });
              const options = parseFormOptions(attr.options);
              return (
                <Field key={attr.attribute_key} label={attr.label} optional>
                  {attr.input_type === 'select' ? (
                    <Select value={value} onChange={e => setValue(e.target.value)}>
                      <option value="">Choose…</option>
                      {value && !options.includes(value) && <option value={value}>{value}</option>}
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input value={value} onChange={e => setValue(e.target.value)} placeholder={attr.label} />
                  )}
                </Field>
              );
            })}
          </div>
        )}
      </FormSection>

      <FormSection title="Prices" description="The cashier picks Customer, Dealer or Staff price when selling.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Customer price" hint="Normal walk-in price.">
            <MoneyInput value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
          </Field>
          <Field label="Dealer price" hint="For resellers / wholesale.">
            <MoneyInput value={form.price_dealer} onChange={e => setForm({ ...form, price_dealer: e.target.value })} />
          </Field>
          <Field label="Staff price" hint="Employee purchase price.">
            <MoneyInput value={form.price_staff} onChange={e => setForm({ ...form, price_staff: e.target.value })} />
          </Field>
          <Field label="Cost price" hint="What you paid. Internal only, used for damage loss.">
            <MoneyInput value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Stock alert">
        <Field label="Low-stock alert at" hint="The product is flagged “low stock” when a branch has this many or fewer.">
          <Input type="number" min="0" step="1" inputMode="numeric" value={form.minimum_quantity} onChange={e => setForm({ ...form, minimum_quantity: e.target.value })} className="font-mono" wrapperClassName="sm:max-w-[12rem]" suffix="units" />
        </Field>
      </FormSection>
    </Modal>
  );
}

// ── QR label preview ────────────────────────────────────────────────────────
export function QrLabelModal({ item, qrData, loading, branchOptions, branchId, onBranchChange, onClose }) {
  return (
    <Modal
      size="sm"
      icon={QrCode}
      title="QR label"
      description={<>{item.item_name} · <span className="font-mono">{item.item_code}</span></>}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button icon={Printer} to={`/qr/generate?product_id=${item.id}`}>Print label</Button>
      </>}
    >
      {branchOptions.length > 1 && (
        <Field label="Branch">
          <Select value={branchId} onChange={e => onBranchChange(e.target.value)}>
            {branchOptions.map(b => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name} ({b.branch_code || `BR-${b.branch_id}`}) · {b.quantity} in stock
              </option>
            ))}
          </Select>
        </Field>
      )}
      {loading || !qrData ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Skeleton className="w-48 h-48 rounded-xl" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : (
        <div className="flex flex-col items-center text-center animate-fade-in">
          <div className="w-52 h-52 p-3 bg-surface border border-line rounded-xl shadow-xs [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qrData.qr_svg }} />
          <p className="mt-3 text-caption text-ink-muted">{item.category}</p>
          <p className="mt-1 font-mono text-caption text-ink-secondary break-all">{qrData.qr_code}</p>
          <div className="mt-4 w-full flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm">
            <span className="text-ink-muted">Customer price</span>
            <span className="font-semibold text-ink tabular-nums">RM {parseFloat(item.selling_price || 0).toFixed(2)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Add existing products to a branch / restock ─────────────────────────────
export function AddToBranchModal({
  isSuperAdmin, user, form, setForm, businesses, branches, onBusinessChange,
  catalog, catalogLoading, catalogSearch, setCatalogSearch, result, onClose, onSubmit, saving,
}) {
  const count = form.product_ids.length;
  const filtered = catalog.filter(p =>
    !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  );
  const toggleProduct = (p, isChecked) => setForm(f => ({
    ...f,
    product_ids: isChecked ? f.product_ids.filter(id => id !== p.id) : [...f.product_ids, p.id],
    product_quantities: isChecked
      ? Object.fromEntries(Object.entries(f.product_quantities || {}).filter(([id]) => String(id) !== String(p.id)))
      : { ...(f.product_quantities || {}), [p.id]: f.product_quantities?.[p.id] ?? 1 },
  }));

  return (
    <Modal
      size="lg"
      icon={Building2}
      title="Add to branch / Restock"
      description="Add products this business already has to a branch, or add more stock to products the branch already has."
      onClose={onClose}
      onSubmit={onSubmit}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={count === 0 || (isSuperAdmin && form.branch_ids.length === 0)}>
          {count > 0 ? `Add / restock ${count} product${count === 1 ? '' : 's'}` : 'Add / restock'}
        </Button>
      </>}
    >
      <FormSection title="1. Where">
        {isSuperAdmin ? (
          <>
            <Field label="Business" required>
              <Select required value={form.business_id} onChange={e => onBusinessChange(e.target.value)}>
                <option value="">Choose a business…</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field
              label="Branches"
              required
              hint="Pick one branch to see which products it already has."
              labelAction={branches.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, branch_ids: f.branch_ids.length === branches.length ? [] : branches.map(b => b.id) }))}
                >
                  {form.branch_ids.length === branches.length ? 'Clear all' : 'Select all'}
                </Button>
              )}
            >
              {branches.length === 0 ? (
                <p className="text-sm text-ink-muted">Choose a business first.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-0.5">
                  {branches.map(br => {
                    const isChecked = form.branch_ids.includes(br.id);
                    return (
                      <div key={br.id} className={cn('rounded-lg border px-3 py-2.5 transition-colors', isChecked ? 'bg-accent-soft border-accent-line' : 'bg-surface border-line hover:bg-subtle')}>
                        <Checkbox
                          label={br.name}
                          checked={isChecked}
                          onChange={() => setForm(f => ({ ...f, branch_ids: isChecked ? f.branch_ids.filter(id => id !== br.id) : [...f.branch_ids, br.id] }))}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Field>
          </>
        ) : (
          <div className="p-3 bg-subtle border border-line-soft rounded-lg text-sm text-ink-secondary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ink-muted" aria-hidden="true" />
            <span><strong className="text-ink font-medium">{user?.branch_name || 'Your branch'}</strong> · {user?.business_name || 'Your business'}</span>
          </div>
        )}
      </FormSection>

      <FormSection
        title="2. Products and quantities"
        description="For a product already in the branch, the quantity is added to its current stock. For a new one, it's the starting stock (0 is allowed)."
      >
        <div className="flex items-center gap-3">
          <SearchInput
            wrapperClassName="flex-1"
            size="sm"
            placeholder="Search by product name or SKU…"
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
            aria-label="Search products"
          />
          <span className={cn('text-caption font-semibold whitespace-nowrap tabular-nums', count ? 'text-accent' : 'text-ink-muted')}>{count} selected</span>
        </div>

        {catalogLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div>
        ) : catalog.length === 0 ? (
          <div className="border border-dashed border-line rounded-xl">
            <EmptyState compact icon={Package} title={isSuperAdmin && !form.business_id ? 'Choose a business first' : 'This business has no products yet'} />
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-line-soft border border-line rounded-xl bg-surface">
            {filtered.map(p => {
              const isChecked = form.product_ids.includes(p.id);
              return (
                <li key={p.id} className={cn('px-3 py-2.5 flex items-center gap-3 text-sm transition-colors', isChecked ? 'bg-accent-soft/60' : 'hover:bg-subtle')}>
                  <Checkbox
                    className="flex-1 min-w-0"
                    checked={isChecked}
                    onChange={() => toggleProduct(p, isChecked)}
                    label={<span className="block truncate font-medium">{p.name}</span>}
                    description={<><span className="font-mono text-accent">{p.sku}</span>{p.category && <> · {p.category}</>} · RM {parseFloat(p.price_customer || 0).toFixed(2)}</>}
                  />
                  {p.in_branch
                    ? <Badge tone="success" size="sm">In branch · {p.branch_qty}</Badge>
                    : <Badge tone="neutral" size="sm">New to branch</Badge>}
                  {isChecked && (
                    <label className="flex items-center gap-1.5 text-caption text-ink-muted flex-shrink-0 animate-fade-in">
                      {p.in_branch ? 'Add' : 'Start'}
                      <Input
                        type="number"
                        size="sm"
                        min={p.in_branch ? 1 : 0}
                        step="1"
                        inputMode="numeric"
                        value={form.product_quantities?.[p.id] ?? 1}
                        onChange={e => {
                          const value = e.target.value;
                          setForm(f => ({ ...f, product_quantities: { ...(f.product_quantities || {}), [p.id]: value } }));
                        }}
                        className="w-16 px-2 font-mono"
                        aria-label={p.in_branch ? `Quantity to add for ${p.name}` : `Starting stock for ${p.name}`}
                      />
                    </label>
                  )}
                </li>
              );
            })}
            {filtered.length === 0 && <li><EmptyState compact title="No products match that search" /></li>}
          </ul>
        )}
      </FormSection>

      {result && (
        <Alert tone="warning" title={result.message}>
          {result.results.length > 0 && (
            <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
              {result.results.map(r => {
                const prod = catalog.find(cp => cp.id === r.product_id);
                const br = branches.find(b => b.id === r.branch_id);
                return (
                  <li key={`${r.product_id}-${r.branch_id}`} className={r.action === 'skipped' ? 'text-danger-fg' : 'text-success-fg'}>
                    <span className="font-semibold capitalize">{r.action}</span>{' '}
                    {prod ? `${prod.name} (${prod.sku})` : `Product #${r.product_id}`}
                    {' → '}{br?.name || (isSuperAdmin ? `Branch #${r.branch_id}` : user?.branch_name)}
                    {r.action === 'skipped' ? `: ${r.reason}` : ` (qty ${r.qty_before} → ${r.qty_after})`}
                  </li>
                );
              })}
            </ul>
          )}
        </Alert>
      )}
    </Modal>
  );
}
