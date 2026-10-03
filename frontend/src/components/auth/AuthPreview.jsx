import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { ButtonBase, cn, prefersReducedMotion } from '../ui';

const SLIDES = [
  { title: 'Every item accounted for', text: 'Receive, count and restock with QR labels.', focus: 'receive' },
  { title: 'One stock, every site', text: 'Map products and keep stock in sync across all stores.', focus: 'sync' },
  { title: 'Never run out', text: 'Low-stock alerts before shelves go empty.', focus: 'overview' },
];
const SLIDE_MS = 5000;

// Layered brand background: violet base, two soft colour fields and a deep fade at the bottom (tokens only)
const PANEL_BG = {
  backgroundImage: [
    'radial-gradient(70% 55% at 15% 10%, rgb(var(--accent-hover) / 0.9) 0%, transparent 70%)',
    'radial-gradient(60% 50% at 95% 85%, rgb(var(--violet) / 0.55) 0%, transparent 70%)',
    'linear-gradient(165deg, rgb(var(--accent)) 0%, rgb(var(--accent-hover)) 45%, rgb(var(--ink)) 135%)',
  ].join(', '),
};
// Fine film grain so the gradient doesn't band and the panel feels tactile
const GRAIN = {
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
};
const GRID = {
  backgroundImage: 'linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
  maskImage: 'radial-gradient(ellipse 65% 55% at 50% 42%, black 10%, transparent 75%)',
  WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 42%, black 10%, transparent 75%)',
};

/**
 * Left half of the sign-in screen: an inset brand panel with a frosted "stock overview" card and two floating
 * activity chips (decorative, sample figures), plus a rotating caption. Each slide lifts the element it describes.
 */
export default function AuthPreview({ className }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setActive(a => (a + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused]);

  const focus = SLIDES[active].focus;

  return (
    <aside className={cn('bg-surface p-3', className)}>
      <div
        className="relative flex flex-1 flex-col overflow-hidden rounded-[28px] text-white"
        style={PANEL_BG}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {/* Texture layers */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={GRID} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay" style={GRAIN} />
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-[-10%] h-80 w-80 rounded-full bg-white/10 blur-3xl animate-drift" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />

        <div className="relative flex flex-1 flex-col justify-center px-10 py-14 xl:px-14">
          {/* Product preview (decorative) */}
          <div aria-hidden="true" className="relative mx-auto w-full max-w-[24rem] pt-10 pb-16">
            <OverviewCard lifted={focus === 'overview'} />

            <FloatingChip lifted={focus === 'receive'} className="-right-6 top-0 xl:-right-10" delay="0s">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
                <QrCode className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-ink">
                  Received 24 units <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                </span>
                <span className="block whitespace-nowrap text-[11px] text-ink-muted">KA-1042 · Main Branch</span>
              </span>
            </FloatingChip>

            <FloatingChip lifted={focus === 'sync'} className="-left-6 bottom-0 xl:-left-10" delay="-3s">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-fg">
                <RefreshCw className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[13px] font-semibold text-ink">Synced across 3 sites</span>
                <span className="mt-1 flex gap-1">
                  {['KA', 'KB', 'AS'].map(s => (
                    <span key={s} className="rounded-md bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">{s}</span>
                  ))}
                </span>
              </span>
            </FloatingChip>
          </div>

          {/* Rotating caption */}
          <section aria-roledescription="carousel" aria-label="HQ Inventory features" className="mx-auto mt-6 w-full max-w-[24rem]">
            <div className="relative h-[4.25rem]">
              {SLIDES.map((s, i) => (
                <div
                  key={s.title}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${SLIDES.length}`}
                  aria-hidden={i !== active}
                  className={cn(
                    'absolute inset-0 transition-[opacity,transform] duration-slow ease-out',
                    i === active ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-1'
                  )}
                >
                  <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.02em]">{s.title}</h2>
                  <p className="mt-1.5 text-sm text-white/75">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {SLIDES.map((s, i) => (
                <ButtonBase
                  key={s.title}
                  onClick={() => setActive(i)}
                  aria-label={`Show slide ${i + 1} of ${SLIDES.length}: ${s.title}`}
                  aria-current={i === active ? 'true' : undefined}
                  className="group rounded-full px-0.5 py-2 focus-visible:ring-white/70 focus-visible:ring-offset-0"
                >
                  <span className={cn(
                    'block h-1.5 rounded-full transition-all duration-base ease-out',
                    i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/35 group-hover:bg-white/60'
                  )} />
                </ButtonBase>
              ))}
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}

/** Frosted glass card: stock total with a 30-day trend and the in / low / out split. */
function OverviewCard({ lifted }) {
  const rows = [
    ['In stock', '1,220', 'bg-success'],
    ['Low', '23', 'bg-warning'],
    ['Out', '5', 'bg-danger'],
  ];
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] backdrop-blur-xl',
        'transition-[transform,border-color] duration-slow ease-out',
        lifted ? '-translate-y-1.5 border-white/35' : ''
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/80">Stock overview</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">All sites</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">1,248</span>
        <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-medium">
          <ArrowUpRight className="h-3 w-3" /> 4.2%
        </span>
      </div>
      <div className="mt-1.5 text-caption text-white/60">SKUs tracked</div>

      {/* Trend line */}
      <svg viewBox="0 0 300 70" className="mt-4 h-16 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="auth-trend" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 52 C 30 50, 45 40, 70 42 S 115 30, 140 34 S 185 18, 210 24 S 255 10, 300 8 L 300 70 L 0 70 Z" fill="url(#auth-trend)" />
        <path d="M0 52 C 30 50, 45 40, 70 42 S 115 30, 140 34 S 185 18, 210 24 S 255 10, 300 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx="300" cy="8" r="3.5" fill="white" />
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {rows.map(([label, value, dot]) => (
          <div key={label}>
            <div className="flex items-center gap-1.5 text-[11px] text-white/65">
              <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />{label}
            </div>
            <div className="mt-0.5 text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FloatingChip({ lifted, className, delay, children }) {
  return (
    <div className={cn('absolute animate-float', className)} style={{ animationDelay: delay }}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.35)]',
          'transition-[transform,box-shadow] duration-slow ease-out',
          lifted ? 'scale-[1.04] ring-4 ring-white/25' : ''
        )}
      >
        {children}
      </div>
    </div>
  );
}
