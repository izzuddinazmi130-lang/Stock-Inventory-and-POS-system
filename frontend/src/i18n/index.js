import { createElement, Fragment, isValidElement } from 'react';
import ms, { msPatterns } from './ms';

/**
 * Two languages: English (the text written in the code) and Bahasa Malaysia (src/i18n/ms.js).
 *
 *   t('Save')                                   → "Simpan"
 *   t('Only {stock} in stock.', { stock: 3 })    → "Hanya 3 dalam stok."
 *
 * The English sentence is the key, so anything without a translation simply shows in English.
 * The language is chosen once per device (header menu or sign-in page) and the page reloads,
 * so every label — including lists built when the app starts — switches together.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ms', label: 'Bahasa Malaysia', short: 'BM' },
];
const STORAGE_KEY = 'hq-language';

const read = () => {
  try { const v = localStorage.getItem(STORAGE_KEY); if (v === 'en' || v === 'ms') return v; } catch {}
  return 'en';
};

export const lang = read();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** Locale for dates and numbers (month and day names follow the language). */
export const locale = lang === 'ms' ? 'ms-MY' : 'en-MY';

export function setLanguage(code) {
  if (code === lang) return;
  try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  window.location.reload();
}

// {name} → the value; {name|one|other} → "one" when the value is 1, otherwise "other" (English plurals;
// Malay sentences simply leave the word out or use one form).
const fill = (text, vars) => {
  if (!vars) return text;
  const parts = text.split(/\{(\w+(?:\|[^|{}]*\|[^|{}]*)?)\}/g); // [text, placeholder, text, placeholder, …]
  const value = (p) => {
    const [name, one, other] = p.split('|');
    if (!(name in vars)) return `{${p}}`;
    if (one !== undefined) return Number(vars[name]) === 1 ? one : other;
    return vars[name];
  };
  // Plain strings and numbers → one string. React elements → an array React can render.
  const hasElement = Object.values(vars).some(v => isValidElement(v));
  if (!hasElement) return parts.map((p, i) => (i % 2 ? String(value(p) ?? '') : p)).join('');
  return createElement(Fragment, null, ...parts.map((p, i) => (i % 2 ? value(p) : p)));
};

function translate(text) {
  if (lang !== 'ms' || typeof text !== 'string') return text;
  const hit = ms[text];
  if (hit !== undefined) return hit;
  // Messages that carry names or numbers (mostly from the server)
  for (const [re, out] of msPatterns) {
    const m = text.match(re);
    if (m) return typeof out === 'function' ? out(m.slice(1), translate) : text.replace(re, out);
  }
  return text;
}

/** Translate an English sentence (and fill in {placeholders}). */
export function t(text, vars) {
  return fill(translate(text), vars);
}
