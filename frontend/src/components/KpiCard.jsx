import React from 'react';

const META_COLORS = {
  emerald: 'text-success-fg',
  rose:    'text-danger-fg',
  amber:   'text-warning-fg',
  gray:    'text-ink-muted',
  blue:    'text-info-fg',
  indigo:  'text-accent',
};

export default function KpiCard({ title, value, meta, metaColor = 'gray', icon: Icon, color = 'indigo', trend }) {
  const iconBg = {
    indigo: 'bg-accent-soft text-accent',
    green:  'bg-success-soft text-success-fg',
    amber:  'bg-warning-soft text-warning-fg',
    rose:   'bg-danger-soft text-danger-fg',
    purple: 'bg-violet-soft text-violet-fg',
    blue:   'bg-info-soft text-info-fg',
  };

  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-ink-muted block">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg[color] || iconBg.indigo}`}>
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold text-ink block tracking-tight">{value ?? '—'}</span>
        {meta && (
          <span className={`text-xs mt-1 block ${META_COLORS[metaColor] || META_COLORS.gray}`}>
            {meta}
          </span>
        )}
      </div>
    </div>
  );
}
