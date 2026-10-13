import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import Button from './Button';
import { t } from '../../i18n';

const ConfirmContext = createContext(null);

/**
 * App-wide confirmation dialog (replaces window.confirm).
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete product?', message: '…', confirmLabel: 'Delete', tone: 'danger' }))) return;
 * A plain string works too: await confirm('Suspend this user?')
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} });
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options || {};
    return new Promise(resolve => {
      resolver.current = resolve;
      setState({ open: true, options: opts });
    });
  }, []);

  const finish = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(s => ({ ...s, open: false }));
  };

  const { title = t('Are you sure?'), message, confirmLabel = t('Confirm'), cancelLabel = t('Cancel'), tone = 'default' } = state.options;
  const danger = tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state.open}
        size="sm"
        title={title}
        icon={danger ? AlertTriangle : HelpCircle}
        iconTone={danger ? 'danger' : 'accent'}
        onClose={() => finish(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => finish(false)}>{cancelLabel}</Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => finish(true)} data-autofocus>
              {confirmLabel}
            </Button>
          </>
        }
      >
        {message && <p className="text-sm text-ink-secondary whitespace-pre-line leading-relaxed">{message}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  // Outside the provider (shouldn't happen) fall back to the browser dialog rather than silently proceeding
  return confirm || ((o) => Promise.resolve(window.confirm(typeof o === 'string' ? o : o?.message || t('Are you sure?'))));
}

export default ConfirmProvider;
