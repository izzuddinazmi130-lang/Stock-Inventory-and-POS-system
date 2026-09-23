import React from 'react';

const STATUS_MAP = {
  // Stock status
  healthy:  { bg: '#ECFDF5', text: '#059669', label: 'Healthy' },
  low:      { bg: '#FFFBEB', text: '#D97706', label: 'Low' },
  critical: { bg: '#FEF2F2', text: '#DC2626', label: 'Critical' },
  // Movement
  in:       { bg: '#ECFDF5', text: '#059669', label: 'STOCK IN' },
  out:      { bg: '#FEF2F2', text: '#DC2626', label: 'STOCK OUT' },
  damage:   { bg: '#FEF2F2', text: '#DC2626', label: 'DAMAGE' },
  adjust:   { bg: '#F5F3FF', text: '#7C3AED', label: 'ADJUST' },
  // User status
  active:   { bg: '#ECFDF5', text: '#059669', label: 'Active' },
  pending:  { bg: '#FFFBEB', text: '#D97706', label: 'Pending' },
  declined: { bg: '#FEF2F2', text: '#DC2626', label: 'Declined' },
  // Store status
  upcoming: { bg: '#EFF6FF', text: '#2563EB', label: 'Upcoming' },
  ended:    { bg: '#F1F5F9', text: '#475569', label: 'Ended' },
  // Neutral
  neutral:  { bg: '#F1F5F9', text: '#475569', label: '' },
  blue:     { bg: '#EFF6FF', text: '#2563EB', label: '' },
  purple:   { bg: '#F5F3FF', text: '#7C3AED', label: '' },
  amber:    { bg: '#FFFBEB', text: '#D97706', label: '' },
  indigo:   { bg: '#EEF2FF', text: '#4F46E5', label: '' },
  pink:     { bg: '#FDF2F8', text: '#BE185D', label: '' },
};

export default function Badge({ status = 'neutral', label, children, className = '' }) {
  const style = STATUS_MAP[status] || STATUS_MAP.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {children || label || style.label}
    </span>
  );
}
