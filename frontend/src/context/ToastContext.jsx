import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container - top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2" style={{maxWidth: 360}}>
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
            t.type === 'success' ? 'bg-success-soft text-success-fg border-success-line' :
            t.type === 'error'   ? 'bg-danger-soft text-danger-fg border-danger-line' :
                                   'bg-warning-soft text-warning-fg border-warning-line'
          }`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-current opacity-50 hover:opacity-100 ml-2">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
