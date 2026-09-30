import React from 'react';
import UiKpiCard from './ui/KpiCard';

// Older KPI card API (title / meta / metaColor / color) mapped onto the UI kit's KpiCard.
const TONE = { indigo: 'accent', green: 'success', amber: 'warning', rose: 'danger', purple: 'violet', blue: 'info' };
const META_TONE = { emerald: 'success', rose: 'danger', amber: 'warning', gray: 'neutral', blue: 'info', indigo: 'accent' };

export default function KpiCard({ title, value, meta, metaColor = 'gray', icon, color = 'indigo', ...rest }) {
  return (
    <UiKpiCard
      label={title}
      value={value}
      meta={meta}
      metaTone={META_TONE[metaColor] || 'neutral'}
      icon={icon}
      tone={TONE[color] || 'accent'}
      {...rest}
    />
  );
}
