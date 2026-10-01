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
6. **Radius:** controls and chips use `rounded-lg` (10px), cards/modals/panels use `rounded-xl` (12px),
   and pills/avatars use `rounded-full`.
8. **Spacing** follows the 4/8px scale (`gap-2`, `p-4`, `mb-6`, `space-y-8`…). Avoid odd values.
9. **The primary colour is an accent, not a fill:** keep it to roughly 10% of a screen (one primary
   button, links, focus, the active tab). Everything else is neutral.
7. **Touch targets:** at least 40px everywhere, and at least **44px on the point of sale** (use `size="lg"`).

## 2. Tokens

Tokens are CSS variables in `src/index.css`, stored as RGB channels so alpha works (`bg-accent/10`).
`tailwind.config.js` maps them to utilities.

| Group | Utilities | Use |
|---|---|---|
| Surfaces | `bg-page`, `bg-surface`, `bg-subtle`, `bg-sunken` | Page background, cards, table headers/hover, tracks/chips |
| Borders | `border-line`, `border-line-soft`, `border-line-strong` | Default borders, dividers inside cards, hovered inputs |
| Text | `text-ink`, `text-ink-secondary`, `text-ink-muted`, `text-ink-subtle` | Body, strong secondary, secondary/captions, placeholders and icons only (not AA for text) |
| Accent | `accent`, `accent-hover`, `accent-fg`, `accent-soft`, `accent-muted`, `accent-line` | The one brand violet (`#6D4AFF`): primary actions, links, active nav and tabs, focus rings, indicators. Don't add a second purple/indigo/blue for UI chrome |
| Status | `success` #16A34A, `warning` #D97706, `danger` #DC2626, `info` #2563EB, `violet`, each with the same 6 steps | In stock, low stock, out of stock, syncing/info, adjustments |
| Business | `bg-brand-kaftanasia`, `bg-brand-astech` | Small identity dots only (`BusinessDot`) |

Neutrals: `surface` #FFFFFF, `page` #FAFAFB, `subtle` #F7F7F9, `line` #E5E7EB, `ink` #111827,
`ink-muted` #6B7280, `ink-subtle` #9CA3AF (placeholders).

**Dark mode.** The same tokens are redefined under `[data-theme="dark"]` (opt in on any element) and
under `.theme-system` when the OS is in dark mode. Nothing opts in yet: the whole system, sign-in
included, is light. When a screen does opt in, add `logo-adaptive` to logo images so the logo turns white.

Each status family follows one pattern: `soft` is the tinted background, `fg` is the text on it and
`line` is the border. The bare name is the solid fill.

```jsx
<div className="rounded-lg bg-warning-soft text-warning-fg border border-warning-line">…</div>
```

**What each status colour means:**
- success: in stock, stock in, synced, healthy, active.
- warning: low stock, pending.
- danger: out of stock, damage, destructive actions.
- info: syncing, stock out/sales movement.
- violet: manual adjustment.

### Type

| | Class | Notes |
|---|---|---|
| Page title | `font-display text-2xl font-semibold tracking-tight` | Inter (`font-display` is an alias). Rendered by `PageHeader` |
| Section title | `text-sm font-semibold text-ink` | Rendered by `CardHeader` |
| Body | `text-sm text-ink` | Inter |
| Caption | `text-caption text-ink-muted` | 12/16 |
| Table header | `text-table-head uppercase` | 11px, tracked. Rendered by `TH` |
| Numbers | (global) | `body` sets `tabular-nums`, so all figures line up. `font-mono` for SKUs and receipt numbers |

One family everywhere: **Inter**. Labels are 13–14px medium, body 14px and helper text 12–13px.

### Spacing and layout
- Page content is padded by the shell. Sections are separated with `space-y-6` / `mb-6`.
- Inside cards, use `px-5 py-4` for headers and `p-5` for bodies (`CardHeader` / `CardBody`).
- Grids: KPIs use `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`, and forms use `grid gap-4 sm:grid-cols-2`.
- Breakpoints checked: **375, 768, 1024, 1440**. No page may scroll horizontally. Wide tables scroll
  inside their card (`Table minWidth`).

### Elevation
`shadow-xs` for controls, `shadow-card` for cards, `shadow-popover` for menus and popovers,
`shadow-modal` for dialogs, and `shadow-elevated` for large floating surfaces such as the sign-in card.

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
<PasswordInput value={pw} onChange={…} autoComplete="current-password" />   // show/hide eye inside the field
{submitError && <FormAlert>{submitError}</FormAlert>}
```
- `Field` wires up `id`, `aria-describedby` and `aria-invalid` for its child. `hideRequiredMark` drops
  the red asterisk when every field on a form is required (the sign-in page), and `labelClassName`
  adjusts the label.
- Focus: the border turns `accent` and a 3px `accent/20` ring appears. Browser autofill keeps the
  field's own colours (see `index.css`).
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

### Sign-in page
`pages/Login.jsx` plus `components/auth/AuthPreview.jsx`. This is a full-height split screen on white,
with no floating card:
- **Left (45%, from 900px up):** `AuthPreview` on `bg-subtle` with a faint dot grid and a `border-r`.
  It holds three decorative mini cards (`rounded-xl border-line shadow-soft`) with sample figures:
  - a stock summary with status dots;
  - a product row with site badges and a "Synced" chip;
  - a QR receiving confirmation.

  Below the cards is a 3-slide caption carousel. It rotates every 5s, pauses on hover, on focus and for
  reduced motion, and crossfades. The active slide outlines its matching card, and the active dot is an
  `accent` pill.
- **Right:**
  - the logo and "HQ Inventory" wordmark at the top-left;
  - a form column of max 400px, vertically centred, with a 28px heading at -0.02em;
  - `SegmentedControl` tabs;
  - fields `h-11` with 10px radius, 13px labels, no asterisks and inline errors (a wrong password shows
    under the password field);
  - "Remember me" and "Forgot password?" on one row;
  - a full-width 44px button with the lock note under it;
  - the footer at the bottom.
- **Below 900px:** only the form column shows, with the logo centred above it.

## 5. Accessibility checklist for new UI
- Everything interactive is reachable by keyboard and shows the `focusRing`.
  `ButtonBase`/`Button` add it for you.
- Icon-only buttons have a `label`.
- Inputs sit in a `Field` or have `aria-label`.
- Status is never shown by colour alone: pills carry text and an icon.
- Live changes (toasts, cart, change due) use `aria-live="polite"`.
- Check the page at 375px: no horizontal scroll, and POS targets ≥ 44px.
