import React from 'react';

const META_COLORS = {
  emerald: 'text-emerald-600',
  rose:    'text-rose-600',
  amber:   'text-amber-600',
  gray:    'text-slate-500',
  blue:    'text-blue-600',
  indigo:  'text-indigo-600',
};

export default function KpiCard({ title, value, meta, metaColor = 'gray', icon: Icon, color = 'indigo', trend }) {
  const iconBg = {
    indigo: 'bg-indigo-50 text-indigo-500',
    green:  'bg-emerald-50 text-emerald-500',
    amber:  'bg-amber-50 text-amber-500',
    rose:   'bg-rose-50 text-rose-500',
    purple: 'bg-violet-50 text-violet-500',
    blue:   'bg-blue-50 text-blue-500',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 block">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg[color] || iconBg.indigo}`}>
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold text-slate-900 block tracking-tight">{value ?? '—'}</span>
        {meta && (
          <span className={`text-xs mt-1 block ${META_COLORS[metaColor] || META_COLORS.gray}`}>
            {meta}
          </span>
        )}
      </div>
    </div>
  );
}
