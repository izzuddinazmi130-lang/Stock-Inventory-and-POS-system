/** @type {import('tailwindcss').Config} */

// All colours come from CSS variables in src/index.css (RGB channels, so `/alpha` works: bg-accent/10).
// Pages use these semantic names only; see DESIGN.md.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

// A semantic colour family: DEFAULT (solid), hover, fg (readable text on white/soft), soft (tint bg), muted (stronger tint), line (border)
const family = (name) => ({
  DEFAULT: token(`${name}`),
  hover: token(`${name}-hover`),
  fg: token(`${name}-fg`),
  soft: token(`${name}-soft`),
  muted: token(`${name}-muted`),
  line: token(`${name}-line`),
});

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: token('page'),
        surface: token('surface'),
        subtle: token('subtle'),
        sunken: token('sunken'),
        line: {
          DEFAULT: token('line'),
          soft: token('line-soft'),
          strong: token('line-strong'),
        },
        ink: {
          DEFAULT: token('ink'),
          hover: token('ink-hover'),
          secondary: token('ink-secondary'),
          muted: token('ink-muted'),
          subtle: token('ink-subtle'),
        },
        accent: family('accent'),
        success: family('success'),
        warning: family('warning'),
        danger: family('danger'),
        info: family('info'),
        violet: family('violet'),
        // Business identity accents: dots/chips next to a business name only
        brand: {
          kaftanasia: token('brand-kaftanasia'),
          astech: token('brand-astech'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      fontSize: {
        // Type scale (see DESIGN.md)
        caption: ['0.75rem', { lineHeight: '1rem' }],          // 12px
        'table-head': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '600' }], // 11px
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.03)',
        popover: '0 10px 30px -8px rgb(15 23 42 / 0.18), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
        modal: '0 24px 48px -12px rgb(15 23 42 / 0.25)',
      },
      ringColor: { DEFAULT: token('accent') },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scale-in': { from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'scale-out': { from: { opacity: '1', transform: 'none' }, to: { opacity: '0', transform: 'translateY(4px) scale(0.98)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'toast-in': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
        progress: { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'row-flash': { '0%': { backgroundColor: 'rgb(var(--accent-soft))' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.2, 0, 0, 1) both',
        'fade-out': 'fade-out 150ms cubic-bezier(0.2, 0, 0, 1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.2, 0, 0, 1) both',
        'scale-out': 'scale-out 150ms cubic-bezier(0.2, 0, 0, 1) both',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2, 0, 0, 1) both',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.2, 0, 0, 1) both',
        'slide-in-left': 'slide-in-left 300ms cubic-bezier(0.2, 0, 0, 1) both',
        'toast-in': 'toast-in 200ms cubic-bezier(0.2, 0, 0, 1) both',
        progress: 'progress linear both',
        shimmer: 'shimmer 1.4s linear infinite',
        'row-flash': 'row-flash 1.6s cubic-bezier(0.2, 0, 0, 1) both',
      },
    },
  },
  plugins: [],
};
