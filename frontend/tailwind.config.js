/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#F1F3F9',
        surface: '#FFFFFF',
        subtle: '#F5F6FA',
        border: '#E5E7EF',
        primary: '#0F172A',
        secondary: '#64748B',
        muted: '#94A3B8',
        accent: '#4F46E5',
        kaftanasia: '#B4502E',
        astech: '#2563EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 0 0 1px rgba(15, 23, 42, 0.02)',
      },
    },
  },
  plugins: [],
};
