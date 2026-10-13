import React, { useEffect, useState } from 'react';
import { ButtonBase, cn, prefersReducedMotion } from '../ui';
import BrandMark from '../BrandMark';
import gradientImg from '../../assets/auth/gradient.jpg';
import { t as tr } from '../../i18n';

const SLIDES = [
  { eyebrow: tr('Receiving & stock counts'), title: tr('Every item accounted for'), text: tr('Receive, count and restock with QR labels.') },
  { eyebrow: tr('Multi-site'), title: tr('One stock, every site'), text: tr('Map products and keep stock in sync across all stores.') },
  { eyebrow: tr('Low-stock alerts'), title: tr('Never run out'), text: tr('Low-stock alerts before shelves go empty.') },
];
const SLIDE_MS = 5000;

// Fine film grain over the photo so it reads as a printed texture rather than a flat image
const GRAIN = {
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
};

/** The gradient artwork, turned so its dark corner sits behind the text (bottom-left). */
export function AuthArtwork({ className }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      <img src={gradientImg} alt="" draggable="false" className="h-full w-full rotate-180 object-cover" />
      <div className="absolute inset-0 opacity-[0.14] mix-blend-overlay" style={GRAIN} />
      {/* Deepen the bottom so the white headline always has contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent" />
    </div>
  );
}

/**
 * Left panel of the sign-in card: the gradient artwork with the HQ mark (top) and a rotating headline (bottom).
 * Rotates every 5s; pauses on hover, on focus and for reduced motion.
 */
export default function AuthPreview({ className }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setActive(a => (a + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused]);

  return (
    <aside
      className={cn('relative flex-col justify-between overflow-hidden rounded-[22px] text-white', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AuthArtwork />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/10" />

      <div className="relative p-9 xl:p-10">
        <BrandMark size="lg" className="[&_img]:brightness-0 [&_img]:invert" />
      </div>

      <section aria-roledescription="carousel" aria-label={tr('HQ Inventory features')} className="relative p-9 xl:p-10">
        <div className="relative h-[9.5rem]">
          {SLIDES.map((s, i) => (
            <div
              key={s.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              aria-hidden={i !== active}
              className={cn(
                'absolute inset-x-0 bottom-0 transition-[opacity,transform] duration-slow ease-out',
                i === active ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
              )}
            >
              <p className="text-sm font-medium text-white/80">{s.eyebrow}</p>
              <h2 className="mt-2 max-w-[20rem] text-[32px] font-semibold leading-[1.15] tracking-[-0.02em]">{s.title}</h2>
              <p className="mt-3 max-w-[22rem] text-sm leading-relaxed text-white/75">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <ButtonBase
              key={s.title}
              onClick={() => setActive(i)}
              aria-label={tr('Show slide {value} of {length}: {title}', { value: i + 1, length: SLIDES.length, title: s.title })}
              aria-current={i === active ? 'true' : undefined}
              className="group rounded-full px-0.5 py-2 focus-visible:ring-white/70 focus-visible:ring-offset-0"
            >
              <span className={cn(
                'block h-1.5 rounded-full transition-all duration-base ease-out',
                i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/40 group-hover:bg-white/70'
              )} />
            </ButtonBase>
          ))}
        </div>
      </section>
    </aside>
  );
}
