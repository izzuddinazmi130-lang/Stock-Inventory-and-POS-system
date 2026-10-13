import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { t } from '../../i18n';

// Same rules as the server: letters, numbers, spaces and - _ . / # + ( ), starting with a letter or number, max 50.
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._/#+()-]{0,49}$/;

export const SKU_HINT = t('Use the same SKU as on your other sales platforms so sales can be matched. Each SKU must be unique.');

export const normalizeSku = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export function skuFormatError(sku) {
  if (!sku) return t('Enter the SKU.');
  if (sku.length > 50) return t('SKU can be at most 50 characters.');
  if (!SKU_PATTERN.test(sku)) return t('Use letters, numbers, spaces and - _ . / # + ( ) only, starting with a letter or number.');
  return '';
}

/**
 * Live "is this SKU free?" check against existing products.
 * Returns lookup(sku) → { state: 'checking' | 'ok' | 'taken' | 'invalid', message } (or null for empty / untouched).
 * `excludeId` skips the product being edited.
 */
export function useSkuCheck(skus, excludeId) {
  const [results, setResults] = useState({});
  const pending = useRef(new Set());
  const key = skus.map(normalizeSku).join('\u0000');

  useEffect(() => {
    const wanted = [...new Set(key.split('\u0000').filter(s => s && !skuFormatError(s)))];
    const todo = wanted.filter(s => !results[s.toLowerCase()] && !pending.current.has(s.toLowerCase()));
    if (todo.length === 0) return undefined;
    const timer = setTimeout(() => {
      todo.forEach(sku => {
        const k = sku.toLowerCase();
        pending.current.add(k);
        setResults(r => ({ ...r, [k]: { state: 'checking' } }));
        api.get('/products/check-sku', { params: { sku, exclude_id: excludeId || undefined } })
          .then(res => setResults(r => ({ ...r, [k]: res.data.available ? { state: 'ok' } : { state: res.data.valid ? 'taken' : 'invalid', message: res.data.message } })))
          .catch(() => setResults(r => { const next = { ...r }; delete next[k]; return next; }))
          .finally(() => pending.current.delete(k));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [key, excludeId, results]);

  return useCallback((sku) => {
    const value = normalizeSku(sku);
    if (!value) return null;
    const formatError = skuFormatError(value);
    if (formatError) return { state: 'invalid', message: formatError };
    return results[value.toLowerCase()] || null;
  }, [results]);
}

/** Small line under a SKU box: "Checking…" or "Available". Errors are shown by the field itself. */
export function SkuStatus({ status }) {
  if (!status) return null;
  if (status.state === 'checking') return <p className="mt-1 flex items-center gap-1 text-caption text-ink-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t('Checking…')}</p>;
  if (status.state === 'ok') return <p className="mt-1 flex items-center gap-1 text-caption text-success-fg"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{t('Available')}</p>;
  return null;
}
