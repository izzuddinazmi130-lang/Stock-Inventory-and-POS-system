import React from 'react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover border border-accent',
  outline: 'bg-surface text-ink-secondary hover:bg-subtle border border-line',
  danger:  'bg-danger-soft text-danger-fg hover:bg-danger-muted border border-danger-line',
  ghost:   'bg-transparent text-ink-muted hover:text-ink hover:bg-sunken border border-transparent',
  success: 'bg-success text-white hover:bg-success-hover border border-success',
};

export default function Button({ variant = 'primary', children, to, href, className = '', size = 'md', disabled = false, onClick, type = 'button', ...props }) {
  const base = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };
  const cls = `${base} ${sizes[size]} ${VARIANTS[variant] || VARIANTS.primary} ${className}`;

  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...props}>{children}</a>;
  return <button type={type} className={cls} disabled={disabled} onClick={onClick} {...props}>{children}</button>;
}
