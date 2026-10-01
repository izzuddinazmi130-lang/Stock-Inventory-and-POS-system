import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, QrCode } from 'lucide-react';
import { Badge, ButtonBase, cn, prefersReducedMotion } from '../ui';

const SLIDES = [
  { title: 'Every item accounted for', text: 'Receive, count and restock with QR labels.', card: 'receive' },
  { title: 'One stock, every site', text: 'Map products and keep stock in sync across all stores.', card: 'product' },
  { title: 'Never run out', text: 'Low-stock alerts before shelves go empty.', card: 'summary' },
];
const SLIDE_MS = 5000;

/**
 * Left half of the sign-in screen: a simplified preview of the system (decorative mock cards with
 * sample figures) and a rotating feature caption. Each slide highlights the card it talks about.
 */
export default function AuthPreview({ className }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setActive(a => (a + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused]);

  const focus = SLIDES[active].card;

  return (
    <aside
      className={cn('relative flex-col bg-subtle border-r border-line overflow-hidden', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Faint dot grid, fading towards the edges */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgb(var(--line-strong)) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      <div className="relative flex flex-1 flex-col justify-center px-8 py-16 xl:px-12">
        {/* System preview (decorative) */}
        <div aria-hidden="true" className="relative mx-auto w-full max-w-[26rem] h-[20rem]">
          <PreviewCard highlighted={focus === 'summary'} className="left-0 top-0 w-[50%]">
            <SummaryCard />
          </PreviewCard>
          <PreviewCard highlighted={focus === 'product'} className="right-0 bottom-0 w-[66%]">
            <ProductCard />
          </PreviewCard>
          <PreviewCard highlighted={focus === 'receive'} className="right-0 top-12 w-[47%] p-3.5">
            <ReceiveCard />
          </PreviewCard>
        </div>

        {/* Feature carousel */}
        <section aria-roledescription="carousel" aria-label="HQ Inventory features" className="mx-auto mt-12 w-full max-w-[26rem]">
          <div className="relative h-[3.75rem]">
            {SLIDES.map((s, i) => (
              <div
                key={s.title}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDES.length}`}
                aria-hidden={i !== active}
                className={cn(
                  'absolute inset-0 transition-opacity duration-base ease-out',
                  i === active ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
              >
                <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{s.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            {SLIDES.map((s, i) => (
              <ButtonBase
                key={s.title}
                onClick={() => setActive(i)}
                aria-label={`Show slide ${i + 1} of ${SLIDES.length}: ${s.title}`}
                aria-current={i === active ? 'true' : undefined}
                className="group rounded-full px-0.5 py-2"
              >
                <span className={cn(
                  'block h-1.5 rounded-full transition-all duration-base ease-out',
                  i === active ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong group-hover:bg-ink-subtle'
                )} />
              </ButtonBase>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function PreviewCard({ highlighted, className, children }) {
  return (
    <div
      className={cn(
        'absolute rounded-xl border bg-surface p-4 shadow-soft transition-[transform,border-color,box-shadow] duration-base ease-out',
        highlighted ? 'border-accent-line ring-[3px] ring-accent/10 -translate-y-1' : 'border-line',
        className
      )}
    >
      {children}
    </div>
  );
}

function SummaryCard() {
  const rows = [
    ['In stock', '1,220', 'bg-success'],
    ['Low stock', '23', 'bg-warning'],
    ['Out of stock', '5', 'bg-danger'],
  ];
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink">Stock summary</span>
        <span className="text-[11px] text-ink-muted">All sites</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink">1,248</div>
      <div className="text-caption text-ink-muted">Total SKUs</div>
      <ul className="mt-3 space-y-1.5 border-t border-line-soft pt-3">
        {rows.map(([label, value, dot]) => (
          <li key={label} className="flex items-center gap-2 text-caption">
            <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
            <span className="text-ink-secondary">{label}</span>
            <span className="ml-auto font-medium text-ink">{value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProductCard() {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-secondary">
        <Package className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-ink">Cotton Kaftan</span>
          <Badge tone="success" size="sm" dot>Synced</Badge>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-muted"><span className="font-mono">KA-1042</span> · Sage green</div>
        <div className="mt-2.5 flex gap-1.5">
          <Badge size="sm">Site A</Badge>
          <Badge size="sm">Site B</Badge>
        </div>
      </div>
    </div>
  );
}

function ReceiveCard() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
        <QrCode className="h-4 w-4" />
        <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-surface text-success" />
      </span>
      <div className="min-w-0">
        <div className="whitespace-nowrap text-[13px] font-medium text-ink">Received 24 units</div>
        <div className="whitespace-nowrap text-[11px] text-ink-muted">KA-1042 · Site A</div>
      </div>
    </div>
  );
}
