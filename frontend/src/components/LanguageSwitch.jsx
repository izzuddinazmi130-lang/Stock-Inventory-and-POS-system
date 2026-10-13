import React from 'react';
import { Languages } from 'lucide-react';
import { cn } from './ui/cn';
import { LANGUAGES, lang, setLanguage, t } from '../i18n';

/** EN | BM switch. The choice is remembered on this device; the page reloads in the chosen language. */
export default function LanguageSwitch({ className }) {
  return (
    <div
      role="group"
      aria-label={t('Language')}
      title="Language / Bahasa"
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-xs', className)}
    >
      <Languages className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={lang === l.code}
          aria-label={l.label}
          onClick={() => setLanguage(l.code)}
          className={cn(
            'h-7 min-w-[2.25rem] rounded-full px-2 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            lang === l.code ? 'bg-ink text-white' : 'text-ink-secondary hover:bg-sunken hover:text-ink'
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
