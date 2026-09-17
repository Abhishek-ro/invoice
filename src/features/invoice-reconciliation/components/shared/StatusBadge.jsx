import React from 'react';

const STATUS_MAP = {
  touchless_approved: { label: 'Auto-Approved',     className: 'ir-badge-success' },
  human_review:       { label: 'Needs Review',      className: 'ir-badge-warning' },
  escalated:          { label: 'Escalated',         className: 'ir-badge-escalated' },
  rejected:           { label: 'Rejected',          className: 'ir-badge-danger' },
  duplicate_flagged:  { label: 'Duplicate Flagged', className: 'ir-badge-purple' },
};

export default function StatusBadge({ status, compact = false }) {
  const s = STATUS_MAP[status] || { label: 'Unknown', className: 'ir-badge-neutral' };
  return <span className={`ir-badge ${s.className}${compact ? ' ir-badge--compact' : ''}`}>{s.label}</span>;
}
