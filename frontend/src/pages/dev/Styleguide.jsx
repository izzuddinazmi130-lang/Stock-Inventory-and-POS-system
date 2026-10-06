import React, { useState } from 'react';
import {
  Plus, Pencil, Trash2, Download, Package, PackageSearch, FileText, TrendingUp, PackageCheck, PackageMinus, Receipt, Save,
} from 'lucide-react';
import Layout from '../../components/Layout';
import {
  Button, IconButton, Input, Select, Textarea, SearchInput, MoneyInput, Checkbox, Field, FormSection, ChoiceCards, Alert,
  Card, CardHeader, CardBody, Badge, StatusPill, BusinessDot, Tabs, SegmentedControl, Table, THead, TBody, TH, TR, TD,
  TableState, Pagination, Skeleton, SkeletonKpi, EmptyState, ErrorState, Tooltip, PageHeader, KpiCard, FilterBar, ScopeBadge,
  Menu, Modal, Drawer, useConfirm, useToast,
} from '../../components/ui';

// Dev-only gallery of the UI kit (route /styleguide exists only in `npm run dev`). See DESIGN.md for the rules.

function Section({ title, code, children }) {
  return (
    <Card className="mb-6">
      <CardHeader title={title} />
      <CardBody className="space-y-4">
        {children}
        {code && <pre className="text-caption bg-subtle border border-line-soft rounded-lg p-3 overflow-x-auto text-ink-secondary"><code>{code.trim()}</code></pre>}
      </CardBody>
    </Card>
  );
}

const TOKENS = [
  ['page', 'bg-page'], ['surface', 'bg-surface'], ['subtle', 'bg-subtle'], ['sunken', 'bg-sunken'], ['line', 'bg-line'],
  ['ink', 'bg-ink'], ['ink-muted', 'bg-ink-muted'], ['accent', 'bg-accent'], ['success', 'bg-success'], ['warning', 'bg-warning'],
  ['danger', 'bg-danger'], ['info', 'bg-info'], ['violet', 'bg-violet'],
];

export default function Styleguide() {
  const [tab, setTab] = useState('all');
  const [seg, setSeg] = useState('sell');
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const [choice, setChoice] = useState('in');
  const [page, setPage] = useState(2);
  const confirm = useConfirm();
  const { toast } = useToast();

  return (
    <Layout>
      <PageHeader
        title="Styleguide"
        description="Every shared component in one place. Only available in development."
        breadcrumbs={[{ label: 'Dev', to: '/styleguide' }, { label: 'Styleguide' }]}
        actions={<><ScopeBadge /><Button icon={Plus}>Primary action</Button></>}
      />

      <Section title="Colour tokens">
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {TOKENS.map(([name, cls]) => (
            <div key={name} className="text-caption">
              <div className={`h-10 rounded-lg border border-line ${cls}`} />
              <div className="mt-1 text-ink-secondary">{name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons" code={`<Button icon={Plus}>Add product</Button>
<Button variant="secondary" loading={saving} type="submit">Save</Button>
<IconButton icon={Pencil} label="Edit product" />`}>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={Plus}>Primary</Button>
          <Button variant="secondary" icon={Download}>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={Trash2}>Danger</Button>
          <Button variant="danger-soft">Danger soft</Button>
          <Button variant="success">Success</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button><Button>Medium</Button><Button size="lg">Large</Button><Button size="xl" icon={Receipt}>Charge RM 45.00</Button>
          <IconButton icon={Pencil} label="Edit" /><IconButton icon={Trash2} label="Delete" variant="danger-soft" />
        </div>
      </Section>

      <Section title="Form controls" code={`<Field label="Product name" required hint="As printed on the label.">
  <Input value={name} onChange={…} />
</Field>`}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Product name" required hint="As printed on the label."><Input placeholder="Kaftan Safira" /></Field>
          <Field label="Category" error="Choose a category"><Select defaultValue=""><option value="">Choose…</option><option>Kaftan</option></Select></Field>
          <Field label="Customer price"><MoneyInput /></Field>
          <Field label="Search"><SearchInput value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" /></Field>
          <Field label="Note" optional className="sm:col-span-2"><Textarea placeholder="Anything to remember" /></Field>
          <Checkbox label="Mark as new arrival" description="Shows a NEW badge for 7 days." />
        </div>
        <FormSection title="Choice cards" description="For 2–4 options instead of a dropdown.">
          <ChoiceCards value={choice} onChange={setChoice} columns={3} options={[
            { value: 'in', label: 'Stock in', description: 'New stock arrived.' },
            { value: 'out', label: 'Stock out', description: 'Sold or taken out.' },
            { value: 'adjust', label: 'Set count', description: 'After a stock take.' },
          ]} />
        </FormSection>
        <div className="grid sm:grid-cols-2 gap-3">
          <Alert tone="info" title="Heads up">Informational message.</Alert>
          <Alert tone="success">Saved.</Alert>
          <Alert tone="warning">Some items have no price.</Alert>
          <Alert tone="danger" onClose={() => {}}>Could not save.</Alert>
        </div>
      </Section>

      <Section title="Badges and status" code={`<StatusPill kind="stock" value="low" />
<Badge tone="success" dot>Active</Badge>
<BusinessDot business={business} />`}>
        <div className="flex flex-wrap gap-2">
          {['neutral', 'accent', 'success', 'warning', 'danger', 'info', 'violet'].map(t => <Badge key={t} tone={t} dot>{t}</Badge>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill kind="stock" value="ok" /><StatusPill kind="stock" value="low" /><StatusPill kind="stock" value="out" />
          <StatusPill kind="movement" value="in" /><StatusPill kind="movement" value="out" /><StatusPill kind="movement" value="adjust" /><StatusPill kind="movement" value="damage" />
          <StatusPill kind="user" value="pending" /><StatusPill kind="store" value="active" /><StatusPill kind="store" value="upcoming" />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2"><BusinessDot business={{ name: 'Kaftanasia' }} />Kaftanasia</span>
          <span className="flex items-center gap-2"><BusinessDot business={{ name: 'As Tech' }} />As Tech</span>
          <span className="flex items-center gap-2"><BusinessDot business={{ id: 3, name: 'Turbo Print' }} />Turbo Print</span>
        </div>
      </Section>

      <Section title="KPI cards">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Revenue" value={1404.7} format={v => `RM ${v.toFixed(2)}`} icon={TrendingUp} tone="success" meta="Last 30 days" delta={12.4} />
          <KpiCard label="Products" value={128} icon={Package} meta="Across 3 branches" />
          <KpiCard label="Low stock" value={4} icon={PackageMinus} tone="warning" meta="Needs attention" metaTone="warning" to="/low-stock" />
          <SkeletonKpi />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All', count: 24 }, { value: 'low', label: 'Running low', count: 3 }, { value: 'out', label: 'Out of stock', count: 1 }]} />
        <SegmentedControl value={seg} onChange={setSeg} tabs={[{ value: 'sell', label: 'Sell' }, { value: 'receive', label: 'Receive stock' }]} />
      </Section>

      <Section title="Table, filters and pagination" code={`<Table>
  <THead><TR><TH>Product</TH><TH numeric>Qty</TH></TR></THead>
  <TBody>
    <TableState colSpan={2} loading={loading} error={error} empty={!rows.length} />
    {rows.map((r, i) => <TR key={r.id} index={i}>…</TR>)}
  </TBody>
</Table>`}>
        <FilterBar onReset={() => setQ('')}>
          <SearchInput value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" wrapperClassName="md:flex-1 md:min-w-[14rem]" />
          <Select wrapperClassName="md:w-44"><option>All categories</option></Select>
        </FilterBar>
        <Card className="overflow-hidden">
          <Table>
            <THead><TR><TH>Product</TH><TH>Status</TH><TH numeric>Qty</TH><TH numeric>Price</TH><TH className="w-12" /></TR></THead>
            <TBody>
              {[['Kaftan Safira', 'ok', 42, 130], ['Kaftan Aira', 'low', 3, 95], ['Abaya Zehra', 'out', 0, 150]].map(([n, s, qty, p], i) => (
                <TR key={n} index={i} highlight={i === 1}>
                  <TD><div className="font-medium">{n}</div><div className="text-caption text-ink-muted font-mono">KA-KA00{i + 1}</div></TD>
                  <TD><StatusPill kind="stock" value={s} /></TD>
                  <TD numeric>{qty}</TD>
                  <TD numeric>RM {p.toFixed(2)}</TD>
                  <TD><Menu label={`Actions for ${n}`} items={[{ label: 'Edit', icon: Pencil, onClick: () => {} }, { label: 'View report', icon: FileText, onClick: () => {} }, { divider: true }, { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => {} }]} /></TD>
                </TR>
              ))}
              <TableState colSpan={5} loading={false} empty={false} />
            </TBody>
          </Table>
          <Pagination page={page} totalPages={5} onChange={setPage} />
        </Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card><EmptyState icon={PackageSearch} title="No products yet" description="Add your first product to start selling." action={<Button icon={Plus} size="sm">Add product</Button>} /></Card>
          <Card><ErrorState description="The server didn't respond." onRetry={() => {}} /></Card>
        </div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3" /></div>
      </Section>

      <Section title="Overlays and feedback" code={`const confirm = useConfirm();
if (!(await confirm({ title: 'Delete product?', message: '…', confirmLabel: 'Delete', tone: 'danger' }))) return;
const { toast } = useToast(); toast.success('Saved');`}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button>
          <Button variant="secondary" onClick={async () => toast.info((await confirm({ title: 'Delete product?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' })) ? 'Confirmed' : 'Cancelled')}>Confirm dialog</Button>
          <Button variant="secondary" onClick={() => toast.success('Product saved')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not reach the server', { title: 'Save failed' })}>Error toast</Button>
          <Tooltip content="I'm a tooltip"><Button variant="ghost">Hover me</Button></Tooltip>
        </div>
      </Section>

      <Modal open={modal} title="Edit product" description="SKU KA-KA001" icon={Pencil} onClose={() => setModal(false)}
        onSubmit={e => { e.preventDefault(); setModal(false); toast.success('Saved'); }}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" icon={Save}>Save changes</Button></>}>
        <Field label="Product name" required><Input defaultValue="Kaftan Safira" /></Field>
        <Field label="Low-stock alert at" hint="Flagged when a branch has this many or fewer."><Input type="number" defaultValue={5} /></Field>
      </Modal>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Drawer">
        <div className="p-5 text-sm text-ink-secondary">Side panel content. <PackageCheck className="inline w-4 h-4" /></div>
      </Drawer>
    </Layout>
  );
}
