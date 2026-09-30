import React from 'react';

export default function Card({ children, className = '', noPad = false }) {
  return (
    <div className={`bg-surface border border-line rounded-xl overflow-hidden ${noPad ? '' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-b border-line-soft ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
