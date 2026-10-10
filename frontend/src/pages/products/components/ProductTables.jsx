import React from 'react';
import { ArrowUpDown, ChevronRight, Pencil, QrCode, Trash2, Package, Plus, RotateCcw, Building2, MinusCircle } from 'lucide-react';
import {
  Badge, BusinessDot, Button, ButtonBase, IconButton, Menu, StatusPill, Table, THead, TBody, TH, TR, TD, TableState, cn,
} from '../../../components/ui';

const money = (v) => `RM ${(parseFloat(v) || 0).toFixed(2)}`;
const isNew = (p) => p.new_until && new Date(p.new_until) > new Date();

function stockLevel(item) {
  const qty = parseInt(item.quantity || 0, 10);
  const min = parseInt(item.minimum_quantity ?? item.min_quantity ?? 0, 10) || 0;
  if (item.stock_status) return item.stock_status;
  return qty <= 0 ? 'out' : qty <= min ? 'low' : 'ok';
}

/** Product name, NEW tag, clickable SKU (opens the QR label) and business. */
function ProductCell({ item, onQr, showBusiness }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink truncate">{item.item_name}</span>
        {isNew(item) && <Badge tone="accent" size="sm">New</Badge>}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-caption">
        <ButtonBase onClick={onQr} className="inline-flex items-center gap-1 rounded font-mono text-accent hover:text-accent-hover hover:underline underline-offset-2" title="Show QR label">
          <QrCode className="w-3 h-3" aria-hidden="true" />
          {item.item_code}
        </ButtonBase>
        {showBusiness && item.business_name && (
          <span className="inline-flex items-center gap-1.5 text-ink-muted truncate">
            <BusinessDot business={{ id: item.business_id, name: item.business_name }} size="sm" />
            {item.business_name}
          </span>
        )}
      </div>
    </div>
  );
}

/** Category plus variant values (size, colour, model) as quiet chips. */
function VariantCell({ item }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-sm text-ink-secondary mr-1">{item.category}</span>
      {item.size && <Badge size="sm" tone="neutral" className="font-semibold">{item.size}</Badge>}
      {item.variant_color && <Badge size="sm" tone="neutral">{item.variant_color}</Badge>}
      {item.model && <span className="text-caption text-ink-muted font-mono">{item.model}</span>}
    </div>
  );
}

function PriceCell({ item }) {
  return (
    <div className="text-right tabular-nums">
      <div className="font-semibold text-ink">{money(item.selling_price)}</div>
      {(item.price_dealer > 0 || item.price_staff > 0) && (
        <div className="text-caption text-ink-muted whitespace-nowrap">
          {item.price_dealer > 0 && <>Dealer {money(item.price_dealer)}</>}
          {item.price_dealer > 0 && item.price_staff > 0 && ' · '}
          {item.price_staff > 0 && <>Staff {money(item.price_staff)}</>}
        </div>
      )}
    </div>
  );
}

function EmptyAction({ hasFilters, onClearFilters, onShowHidden }) {
  if (hasFilters) return <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onClearFilters}>Clear filters</Button>;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button size="sm" icon={Plus} to="/products/add">Add product</Button>
      {onShowHidden && <Button variant="secondary" size="sm" onClick={onShowHidden}>Show hidden products</Button>}
    </div>
  );
}

// Empty list wording: with no filters, "no products for sale" (hidden products are not listed by default)
const emptyCopy = (hasFilters) => hasFilters
  ? { title: 'No products match these filters', description: 'Try another search or clear the filters.' }
  : { title: 'No products for sale', description: 'Add a product to start tracking stock. Hidden products are not listed here.' };

/** One row per product per branch (default view). */
export function ByBranchTable({
  items, loading, error, onRetry, isSuperAdmin, highlightId, changedKeys, hasFilters, onClearFilters, onShowHidden,
  onAdjust, onQr, onEdit, onDelete, onRemoveFromBranch,
}) {
  const cols = isSuperAdmin ? 6 : 5;
  const copy = emptyCopy(hasFilters);
  return (
    <Table minWidth="60rem">
      <THead>
        <TR>
          <TH>Product</TH>
          <TH>Category &amp; variant</TH>
          {isSuperAdmin && <TH>Branch</TH>}
          <TH>Stock</TH>
          <TH numeric>Price</TH>
          <TH className="w-px"><span className="sr-only">Actions</span></TH>
        </TR>
      </THead>
      <TBody>
        <TableState
          colSpan={cols}
          loading={loading && items.length === 0}
          error={!loading && error && items.length === 0 ? error : null}
          onRetry={onRetry}
          empty={!loading && !error && items.length === 0}
          emptyIcon={Package}
          emptyTitle={copy.title}
          emptyDescription={copy.description}
          emptyAction={<EmptyAction hasFilters={hasFilters} onClearFilters={onClearFilters} onShowHidden={onShowHidden} />}
        />
        {items.map((item, i) => {
          const level = stockLevel(item);
          const min = parseInt(item.minimum_quantity ?? item.min_quantity ?? 0, 10) || 0;
          return (
            <TR key={`${item.id}-${item.branch_id}`} index={i} selected={String(item.id) === String(highlightId)} highlight={changedKeys?.has(`${item.id}-${item.branch_id}`)}>
              <TD className="max-w-[18rem]"><ProductCell item={item} onQr={() => onQr(item)} showBusiness={isSuperAdmin} /></TD>
              <TD><VariantCell item={item} /></TD>
              {isSuperAdmin && (
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-secondary whitespace-nowrap">
                    <Building2 className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
                    {item.branch_name || 'Main Branch'}
                  </span>
                </TD>
              )}
              <TD>
                <div className="flex items-center gap-2">
                  <span className={cn('font-semibold tabular-nums', level === 'out' ? 'text-danger-fg' : level === 'low' ? 'text-warning-fg' : 'text-ink')}>{item.quantity}</span>
                  <StatusPill kind="stock" value={level} size="sm" showIcon={false} />
                </div>
                <div className="text-caption text-ink-muted tabular-nums mt-0.5">Alert at {min}</div>
              </TD>
              <TD><PriceCell item={item} /></TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="secondary" size="sm" icon={ArrowUpDown} onClick={() => onAdjust(item)}>Adjust</Button>
                  <Menu
                    label={`More actions for ${item.item_name}`}
                    items={[
                      { label: 'Show QR label', icon: QrCode, onClick: () => onQr(item) },
                      { label: 'Edit product', icon: Pencil, onClick: () => onEdit(item) },
                      { divider: true },
                      {
                        label: isSuperAdmin ? `Remove from ${item.branch_name || 'this branch'}` : 'Remove from this branch',
                        icon: MinusCircle,
                        tone: 'danger',
                        onClick: () => onRemoveFromBranch(item, { branch_id: item.branch_id, branch_name: item.branch_name, quantity: item.quantity }, Number(item.branch_count) || 1),
                        hidden: !(Number(item.branch_count) > 1),
                      },
                      // Deleting wipes the product from every branch, so only HQ (super admin) can do it
                      { label: 'Delete product', icon: Trash2, tone: 'danger', onClick: () => onDelete(item.id, item.item_name), hidden: !isSuperAdmin },
                    ]}
                  />
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

/** One row per product with the combined stock; expand to see each branch (super admin). */
export function CombinedTable({
  products, loading, error, onRetry, expandedIds, onToggle, hasFilters, onClearFilters, onShowHidden,
  onAdjust, onQr, onEdit, onDelete, onRemoveFromBranch,
}) {
  return (
    <Table minWidth="60rem">
      <THead>
        <TR>
          <TH className="w-10"><span className="sr-only">Expand</span></TH>
          <TH>Product</TH>
          <TH>Category &amp; variant</TH>
          <TH>Branches</TH>
          <TH>Total stock</TH>
          <TH numeric>Price</TH>
          <TH className="w-px"><span className="sr-only">Actions</span></TH>
        </TR>
      </THead>
      <TBody>
        <TableState
          colSpan={7}
          loading={loading && products.length === 0}
          error={!loading && error && products.length === 0 ? error : null}
          onRetry={onRetry}
          empty={!loading && !error && products.length === 0}
          emptyIcon={Package}
          emptyTitle={emptyCopy(hasFilters).title}
          emptyDescription={emptyCopy(hasFilters).description}
          emptyAction={<EmptyAction hasFilters={hasFilters} onClearFilters={onClearFilters} onShowHidden={onShowHidden} />}
        />
        {products.map((prod, i) => {
          const expanded = expandedIds.has(prod.id);
          const worst = prod.has_critical ? 'out' : prod.has_low ? 'low' : 'ok';
          const worstLabel = prod.has_critical ? 'Out at a branch' : prod.has_low ? 'Low at a branch' : 'Healthy everywhere';
          return (
            <React.Fragment key={prod.id}>
              <TR index={i}>
                <TD className="pr-0">
                  <IconButton
                    icon={ChevronRight}
                    label={expanded ? 'Hide branch stock' : 'Show branch stock'}
                    aria-expanded={expanded}
                    onClick={() => onToggle(prod.id)}
                    tooltip={false}
                    className={cn('transition-transform duration-base', expanded && 'rotate-90 text-accent')}
                  />
                </TD>
                <TD className="max-w-[18rem]"><ProductCell item={prod} onQr={() => onQr(prod, prod.branches)} showBusiness /></TD>
                <TD><VariantCell item={prod} /></TD>
                <TD><Badge tone="neutral" icon={Building2}>{prod.branches.length} {prod.branches.length === 1 ? 'branch' : 'branches'}</Badge></TD>
                <TD>
                  <div className="font-semibold text-ink tabular-nums">{prod.total_quantity} <span className="text-caption font-normal text-ink-muted">units</span></div>
                  <StatusPill kind="stock" value={worst} label={worstLabel} size="sm" className="mt-1" />
                </TD>
                <TD><PriceCell item={prod} /></TD>
                <TD>
                  <div className="flex justify-end">
                    <Menu
                      label={`Actions for ${prod.item_name}`}
                      items={[
                        { label: 'Show QR label', icon: QrCode, onClick: () => onQr(prod, prod.branches) },
                        { label: 'Edit product', icon: Pencil, onClick: () => onEdit(prod) },
                        { divider: true },
                        { label: 'Delete product', icon: Trash2, tone: 'danger', onClick: () => onDelete(prod.id, prod.item_name) },
                      ]}
                    />
                  </div>
                </TD>
              </TR>
              {expanded && (
                <tr className="animate-fade-in">
                  <td colSpan={7} className="bg-subtle px-6 py-4 border-b border-line-soft">
                    <p className="text-table-head uppercase text-ink-muted mb-2">Stock by branch</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {prod.branches.map((br, bi) => {
                        const level = br.is_critical ? 'out' : br.is_low ? 'low' : 'ok';
                        return (
                          <div key={br.branch_id} className="bg-surface border border-line rounded-lg p-3 flex items-center justify-between gap-3 animate-slide-up" style={{ animationDelay: `${Math.min(bi, 8) * 35}ms` }}>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{br.branch_name}</p>
                              <p className="text-caption text-ink-muted tabular-nums">
                                {br.branch_code && <span className="font-mono">{br.branch_code} · </span>}Alert at {br.min_quantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={cn('font-semibold tabular-nums', level === 'out' ? 'text-danger-fg' : level === 'low' ? 'text-warning-fg' : 'text-ink')}>{br.quantity}</span>
                              <Button variant="secondary" size="sm" onClick={() => onAdjust(prod, br.branch_id)}>Adjust</Button>
                              {prod.branches.length > 1 && (
                                <IconButton
                                  icon={MinusCircle}
                                  label={`Remove from ${br.branch_name}`}
                                  className="hover:bg-danger-muted hover:text-danger-fg"
                                  onClick={() => onRemoveFromBranch(prod, br, prod.branches.length)}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </TBody>
    </Table>
  );
}
