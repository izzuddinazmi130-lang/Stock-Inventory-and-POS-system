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
            t.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            t.type === 'error'   ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                   'bg-amber-50 text-amber-800 border-amber-200'
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
