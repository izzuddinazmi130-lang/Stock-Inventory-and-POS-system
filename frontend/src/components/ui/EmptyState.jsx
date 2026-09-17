import React from 'react';
import Button from './Button';

export default function EmptyState({ icon: Icon, message = 'No data found', action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-12 h-12 text-slate-300 mb-4" strokeWidth={1.5} />}
      <p className="text-sm text-slate-500 mb-4">{message}</p>
      {action && actionLabel && (
        <Button variant="outline" onClick={action} size="sm">{actionLabel}</Button>
      )}
    </div>
  );
}
