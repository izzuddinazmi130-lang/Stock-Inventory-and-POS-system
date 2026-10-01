# HQ Inventory design system

This is how the frontend looks and how to keep it consistent. Every page is built from the UI kit in
`src/components/ui`. If you need something the kit doesn't have, add it to the kit first, not to a page.

Run `npm run dev` and open **`/styleguide`** (development builds only) to see every component live.

---

## 1. Rules

1. **Colours come from tokens only.** Don't write hex values or Tailwind palette colours (`bg-blue-600`,
   `text-gray-500`) in pages. Use `bg-accent`, `text-ink-muted`, `border-line` and so on.
2. **Don't use raw `<button>`, `<select>`, `<table>` or modal wrappers in pages.** Use `Button`,
   `IconButton` or `ButtonBase`, then `Select`, `Table` and `Modal`/`Drawer`.
3. **Don't use `alert()` or `confirm()`.** Use `useToast()` for feedback and `useConfirm()` for questions.
4. **Every list has a loading, an empty and an error state:** `SkeletonRows` / `TableState`,
   `EmptyState` and `ErrorState`.
5. **Icons come from `lucide-react` only.** The stroke width is set globally to 1.75. Size them `w-4 h-4`
   inline, `w-[18px] h-[18px]` in navigation and `w-5 h-5` in large controls. Always add `aria-hidden="true"`.
6. **Radius:** controls use `rounded-lg`, cards/modals/panels use `rounded-xl`, and pills/avatars use
   `rounded-full`.
7. **Touch targets:** at least 40px everywhere, and at least **44px on the point of sale** (use `size="lg"`).

## 2. Tokens

Tokens are CSS variables in `src/index.css`, stored as RGB channels so alpha works (`bg-accent/10`).
`tailwind.config.js` maps them to utilities.

| Group | Utilities | Use |
|---|---|---|
| Surfaces | `bg-page`, `bg-surface`, `bg-subtle`, `bg-sunken` | Page background, cards, table headers/hover, tracks/chips |
| Borders | `border-line`, `border-line-soft`, `border-line-strong` | Default borders, dividers inside cards, hovered inputs |
| Text | `text-ink`, `text-ink-secondary`, `text-ink-muted`, `text-ink-subtle` | Body, secondary, captions, icons/placeholders only (not AA) |
| Accent | `accent`, `accent-hover`, `accent-fg`, `accent-soft`, `accent-muted`, `accent-line` | Primary actions, links, active nav, focus |
| Status | `success`, `warning`, `danger`, `info`, `violet`, each with the same 6 steps | In stock / low / critical, info, adjustments |
| Business | `bg-brand-kaftanasia`, `bg-brand-astech` | Small identity dots only (`BusinessDot`) |

Each status family follows one pattern: `soft` is the tinted background, `fg` is the text on it and
`line` is the border. The bare name is the solid fill.

```jsx
<div className="rounded-lg bg-warning-soft text-warning-fg border border-warning-line">…</div>
```

**What each status colour means:**
- success: stock in, healthy, active.
- warning: low stock, pending.
- danger: out of stock, damage, destructive actions.
- info: stock out/sales movement.
- violet: manual adjustment.

### Type

| | Class | Notes |
|---|---|---|
| Page title | `font-display text-2xl font-semibold tracking-tight` | Space Grotesk. Rendered by `PageHeader` |
| Section title | `text-sm font-semibold text-ink` | Rendered by `CardHeader` |
| Body | `text-sm text-ink` | Inter |
| Caption | `text-caption text-ink-muted` | 12/16 |
| Table header | `text-table-head uppercase` | 11px, tracked. Rendered by `TH` |
| Numbers | `tabular-nums` | All money, quantities and counts. `font-mono` for SKUs and receipt numbers |

### Spacing and layout
- Page content is padded by the shell. Sections are separated with `space-y-6` / `mb-6`.
- Inside cards, use `px-5 py-4` for headers and `p-5` for bodies (`CardHeader` / `CardBody`).
- Grids: KPIs use `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`, and forms use `grid gap-4 sm:grid-cols-2`.
- Breakpoints checked: **375, 768, 1024, 1440**. No page may scroll horizontally. Wide tables scroll
  inside their card (`Table minWidth`).

### Elevation
`shadow-xs` for controls, `shadow-card` for cards, `shadow-popover` for menus and popovers, and
`shadow-modal` for dialogs.

### Motion
- Durations: `duration-fast` (150ms) for hover/colour, `duration-base` (200ms) for movement,
  `duration-slow` (300ms) for highlights.
- Easing: `ease-out` (cubic-bezier(0.2, 0, 0, 1)).
- Animations: `animate-fade-in`, `animate-scale-in` (modals and menus), `animate-slide-up` (route
  change), `animate-toast-in`, `animate-shimmer` (skeletons) and `animate-row-flash` (a row that just
  changed).
- `prefers-reduced-motion` turns all of these off globally. In JS, check `prefersReducedMotion()`
  before count-ups and similar effects.

## 3. Page anatomy

Every page follows the same order:

```jsx
<Layout>
  <PageHeader title="Low stock" description="…" actions={<Button icon={PackagePlus}>Restock all</Button>} />
  <FilterBar onReset={reset} resetVisible={dirty}>…</FilterBar>        {/* optional */}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
    <KpiCard label="Out of stock" value={n} icon={PackageX} tone="danger" loading={loading} />
  </div>
  <Card>
    <CardHeader title="Receipts" description="4 sales" />
    <Table>…</Table>                                                    {/* with TableState for loading/empty/error */}
  </Card>
</Layout>
```

## 4. Components

Import them from the barrel:

```js
import { Button, Card, Table, … } from '../../components/ui';
```

### Buttons
```jsx
<Button icon={Plus}>Add product</Button>                         // primary (default)
<Button variant="secondary">Cancel</Button>
<Button variant="danger" loading={saving}>Delete</Button>
<Button variant="ghost" size="sm" to="/sales">View all</Button>   // renders a <Link>
<IconButton icon={Trash2} label="Remove item" />                   // label is required (aria + tooltip)
<ButtonBase className="…">custom clickable</ButtonBase>            // unstyled, keeps focus ring + type="button"
```
- Variants: `primary`, `secondary`, `ghost`, `outline`, `danger`, `danger-soft`, `success`,
  `accent-soft`, `link`.
- Sizes: `sm` (32px), `md` (40px), `lg` (44px), `xl` (52px, POS charge button).
- Use one primary button per view.

### Forms
```jsx
<Field label="Price" hint="Customer price" error={errors.price} required>
  <MoneyInput value={price} onChange={e => setPrice(e.target.value)} />
</Field>
<Select value={v} onChange={…}><option>…</option></Select>
<SearchInput value={q} onChange={…} placeholder="Search…" />
<Switch checked={on} onChange={setOn} label="Mark as new" description="…" />
<QuantityStepper value={qty} onChange={setQty} min={1} max={100} size="lg" label="Quantity" />
{submitError && <FormAlert>{submitError}</FormAlert>}
```
- `Field` wires up `id`, `aria-describedby` and `aria-invalid` for its child.
- Errors appear under the field in `text-danger-fg`.

### Feedback
```jsx
const toast = useToast();      toast.success('Product saved');   toast.error(msg);
const confirm = useConfirm();  if (!(await confirm({ title: 'Delete product?', message: '…', confirmLabel: 'Delete', tone: 'danger' }))) return;
<Alert tone="warning" title="…">…</Alert>
```

### Overlays
```jsx
<Modal open={open} onClose={close} title="Restock" icon={PackagePlus} onSubmit={save}
       footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit">Save</Button></>}>
  …
</Modal>
<Drawer open={open} onClose={close} side="left">…</Drawer>
<Menu items={[{ label: 'Edit', icon: Pencil, onClick }, { divider: true }, { label: 'Delete', tone: 'danger', onClick }]} />
<Tooltip content="Explain">…</Tooltip>
```
Modals render in a portal. They trap focus, close on Esc (topmost first), lock page scroll and animate
out.

### Data display
```jsx
<Table minWidth="48rem">
  <THead><TR><TH>Product</TH><TH numeric>Qty</TH></TR></THead>
  <TBody>
    <TableState loading={loading} error={error} empty={!rows.length} colSpan={2} onRetry={load}
                emptyTitle="No products yet" />
    {rows.map((r, i) => <TR key={r.id} index={i} onClick={() => open(r)}><TD>{r.name}</TD><TD numeric>{r.qty}</TD></TR>)}
  </TBody>
</Table>
<Pagination page={page} totalPages={pages} onChange={setPage} />
<Badge tone="success" dot>Active</Badge>
<StatusPill kind="stock" value="low_stock" />      {/* kinds: stock, movement, user, store, product, payment */}
<Tabs tabs={[{ value: 'all', label: 'All', count: 12 }]} value={tab} onChange={setTab} />
<SegmentedControl tabs={…} value={v} onChange={setV} size="lg" />
<EmptyState icon={PackageX} title="Nothing here" description="…" action={<Button>…</Button>} />
<ErrorState description={error} onRetry={load} />
<Skeleton className="h-4 w-32" />  <SkeletonRows rows={5} />  <SkeletonKpi />
```

### Shell
- `components/Layout.jsx` is the app shell: sidebar, header and route transition. Pages still wrap
  their content in `<Layout>`, which passes straight through inside the shell.
- Navigation per role lives in `components/navigation.js`.
- The logo is `components/BrandMark.jsx`: `<BrandMark withName />` shows the full HQ AS Tech logo with
  the "Inventory & POS" subtitle, and `<BrandMark />` shows only the square HQ mark. The images are
  transparent PNGs in `src/assets/brand/`, and the favicon is `public/favicon.png`.
- The sidebar remembers whether it is collapsed and starts collapsed below 1280px. On phones it becomes
  a drawer.

## 5. Accessibility checklist for new UI
- Everything interactive is reachable by keyboard and shows the `focusRing`.
  `ButtonBase`/`Button` add it for you.
- Icon-only buttons have a `label`.
- Inputs sit in a `Field` or have `aria-label`.
- Status is never shown by colour alone: pills carry text and an icon.
- Live changes (toasts, cart, change due) use `aria-live="polite"`.
- Check the page at 375px: no horizontal scroll, and POS targets ≥ 44px.
