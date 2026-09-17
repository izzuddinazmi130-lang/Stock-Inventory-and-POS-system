import React from 'react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600',
  outline: 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200',
  danger:  'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200',
  ghost:   'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600',
};

export default function Button({ variant = 'primary', children, to, href, className = '', size = 'md', disabled = false, onClick, type = 'button', ...props }) {
  const base = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };
  const cls = `${base} ${sizes[size]} ${VARIANTS[variant] || VARIANTS.primary} ${className}`;

  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...props}>{children}</a>;
  return <button type={type} className={cls} disabled={disabled} onClick={onClick} {...props}>{children}</button>;
}
