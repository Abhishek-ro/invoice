import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExceptions, ApiError } from '../api';
import DataGridViewer from '../components/shared/DataGridViewer';
import StatusBadge from '../components/shared/StatusBadge';
import { usePendingExceptionsCount } from '../hooks/usePendingExceptionsCount';

// TODO(04 §B.4.1 / §F.6): `reason` used to be a free-text string
// ("Unit price variance on line item 1", "SLA score below threshold")
// hand-authored per mock row. The real endpoint returns
// `{ stage_key, field } | null` — derived server-side from the worst
// out-of-tolerance mismatch (lib/derive.js#deriveReason, shared verbatim
// with GET /dashboard/charts's exception_breakdown so the two can't
// disagree). Two of the old filter categories — "Tax Error" and
// "SLA Breach" — don't correspond to any stage_key the matching engine
// (05-MATCHING-RULES.md) produces, so they've been dropped. Filter chips
// below are the real reason_stage_key values instead. Note the mock's
// *live* matcher (invoice-backend/lib/matcher.js, used by POST
// /reconciliations) only ever pushes po_match/grn_match mismatches —
// price_validation only shows up as a reason on hand-authored seed rows
// (invoice-backend/lib/db.js) that pre-date the matcher. All four chips are
// real, queryable values either way.
const STAGE_LABELS = { po_match: 'PO Match', grn_match: 'GRN Match', price_validation: 'Price Validation', duplicate_scan: 'Duplicate Suspected' };
const REASON_FILTERS = ['All', 'po_match', 'grn_match', 'price_validation', 'duplicate_scan'];

function formatReason(reason) {
  if (!reason) return '—';
  const stage = STAGE_LABELS[reason.stage_key] || reason.stage_key;
  return reason.field ? `${stage} — ${reason.field.replace(/_/g, ' ')}` : stage;
}

// TODO(04 has no age/aging-bucket field anywhere in the contract): this
// was, and stays, a purely presentational derivation off `created_at` —
// nothing a backend needs to own. Bucket edges match the heatmap strip
// below (<4h / 4-24h / 1-3d / >3d) that was already hardcoded in the
// original mock UI.
function ageInfo(createdAtISO) {
  const hours = (Date.now() - new Date(createdAtISO).getTime()) / 3600000;
  if (hours < 4) return { label: `${Math.max(1, Math.round(hours))}h`, bucket: '<4h', old: false };
  if (hours < 24) return { label: `${Math.round(hours)}h`, bucket: '4-24h', old: false };
  const days = hours / 24;
  if (days < 3) return { label: `${Math.round(days)}d`, bucket: '1-3d', old: true };
  return { label: `${Math.round(days)}d`, bucket: '>3d', old: true };
}

function confidenceColor(pct) {
  if (pct == null) return 'var(--gray-400)';
  if (pct >= 90) return 'var(--tint-success-text)';
  if (pct >= 70) return 'var(--tint-warning-text)';
  return 'var(--tint-danger-text)';
}

const AGE_TIERS = [
  { bucket: '<4h', label: 'Fresh · Under 4h', accent: '#10b981', icon: 'check' },
  { bucket: '4-24h', label: 'Same Day · 4–24h', accent: '#f59e0b', icon: 'clock' },
  { bucket: '1-3d', label: 'Aging · 1–3 Days', accent: '#f97316', icon: 'alert' },
  { bucket: '>3d', label: 'Overdue · 3+ Days', accent: '#dc2626', icon: 'flame' },
];

function TierIcon({ type }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (type === 'check') return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  if (type === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
  if (type === 'alert') return <svg {...common}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
  return <svg {...common}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" /></svg>;
}

export default function ExceptionsQueue() {
  const navigate = useNavigate();
  const totalPending = usePendingExceptionsCount();
  const [filter, setFilter] = useState('All');
  const [ageFilter, setAgeFilter] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 04 §B.4.1: status isn't passed here — the endpoint already scopes
      // itself to human_review + escalated, which is exactly "pending
      // exceptions." reason_stage_key does the chip filtering server-side.
      const res = await listExceptions({ reason_stage_key: filter === 'All' ? undefined : filter });
      setRows(res.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the exceptions queue.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const ages = rows.map((r) => ageInfo(r.created_at));
  const bucketCounts = { '<4h': 0, '4-24h': 0, '1-3d': 0, '>3d': 0 };
  ages.forEach((a) => { bucketCounts[a.bucket]++; });
  const visibleRows = ageFilter ? rows.filter((r) => ageInfo(r.created_at).bucket === ageFilter) : rows;

  const conditionalFormatting = (key, row) => {
    if (key !== 'created_at') return {};
    const a = ageInfo(row.created_at);
    if (a.bucket === '>3d') return { borderLeft: '3px solid #dc2626' };
    if (a.bucket === '1-3d') return { borderLeft: '3px solid #f97316' };
    return { borderLeft: '3px solid transparent' };
  };

  const columns = [
    {
      key: 'created_at', label: 'AGE',
      render: (val) => { const a = ageInfo(val); return <span style={{ fontWeight: 800, fontSize: '12px', color: a.old ? '#dc2626' : '#f59e0b' }}>{a.label}</span>; }
    },
    { key: 'status', label: 'STATUS', sortable: false, render: (val) => <StatusBadge status={val} compact /> },
    { key: 'invoice_number', label: 'INVOICE ID', render: (val) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{val}</span> },
    { key: 'vendor_name', label: 'VENDOR' },
    { key: 'invoice_total', label: 'AMOUNT', render: (val) => `$${val.toLocaleString()}` },
    { key: 'total_variance', label: 'VARIANCE', render: (val) => <span style={{ color: val !== 0 ? '#dc2626' : 'inherit', fontWeight: 700 }}>{val > 0 ? '+' : ''}${val.toFixed(2)}</span> },
    { key: 'confidence', label: 'CONFIDENCE', render: (val) => val == null ? '—' : <span style={{ fontWeight: 700, color: confidenceColor(val) }}>{Math.round(val)}%</span> },
    { key: 'reason', label: 'EXCEPTION REASON', render: (val) => <span style={{ color: 'var(--gray-600)', fontWeight: 600 }}>{formatReason(val)}</span> },
    // TODO(04 §B.3.1 / §B.4.2): was `row.invoice_id.replace('INV-', '6650a')`
    // — a hardcoded string hack that only worked by coincidence for
    // whatever one fixture id looked like. The real row carries its own
    // `id`, so route straight to it.
    { key: 'action', label: '', render: (val, row) => <button className="ir-row-btn" onClick={() => navigate(`/invoice-reconciliation/${row.id}`)}>Review →</button>, sortable: false }
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="topbar__title">Exceptions Queue</h1>
            <span style={{
              background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-text)', border: '1px solid var(--tint-warning-border)',
              padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700
            }}>
              {totalPending ?? rows.length} Pending
            </span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '2px' }}>
            Invoices the matching engine couldn't auto-approve — sorted newest first
          </div>
        </div>
      </header>

      <div className="ud-content">

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-text)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '13px', fontWeight: 600 }}>⚠ {error}</div>
        )}

        <div className="ir-card-head" style={{ marginBottom: '0.75rem' }}>
          <div className="ir-card-title">Aging Breakdown</div>
        </div>
        <div className="ir-variance-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {AGE_TIERS.map((tier) => (
            <div
              key={tier.bucket}
              className="ir-variance-card"
              onClick={() => setAgeFilter(ageFilter === tier.bucket ? null : tier.bucket)}
              style={{
                borderLeft: `4px solid ${tier.accent}`, display: 'flex', flexDirection: 'column', gap: '0.6rem',
                cursor: 'pointer', outline: ageFilter === tier.bucket ? `2px solid ${tier.accent}` : 'none', outlineOffset: '-1px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="ir-var-label" style={{ marginBottom: 0 }}>{tier.label}</span>
                <span style={{ color: tier.accent, display: 'flex' }}><TierIcon type={tier.icon} /></span>
              </div>
              <span className="ir-var-val">{bucketCounts[tier.bucket]}</span>
            </div>
          ))}
        </div>
        {ageFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem', fontSize: '12.5px', color: 'var(--gray-500)', fontWeight: 600 }}>
            Showing only "{AGE_TIERS.find((t) => t.bucket === ageFilter)?.label}"
            <button className="ir-link-btn" onClick={() => setAgeFilter(null)}>Clear</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 1rem' }}>
          <div className="ir-filter-row" style={{ marginBottom: 0 }}>
            {REASON_FILTERS.map(f => (
              <div
                key={f}
                onClick={() => setFilter(f)}
                className={`ir-filter-chip ${filter === f ? 'ir-filter-active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                {f === 'All' ? 'All' : (STAGE_LABELS[f] || f)}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* TODO(04): no bulk-decision endpoint exists — §B.3.4/§B.4.2 only
                cover one reconciliation id per decision call. These stay
                disabled placeholders exactly as in the original mock. */}
            <button className="ir-action-btn ir-action-escalate" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }} title="Bulk decisions aren't supported yet — review exceptions one at a time">Approve Selected</button>
            <button className="ir-action-btn ir-action-escalate" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }} title="Bulk decisions aren't supported yet — review exceptions one at a time">Escalate Selected</button>
          </div>
        </div>

        <div className="ir-card" style={{ padding: 0, height: '500px', display: 'flex', flexDirection: 'column' }}>
          {loading && rows.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--gray-400)' }}>
              <span className="ir-spinner" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Loading exceptions…</span>
            </div>
          ) : (
            <DataGridViewer columns={columns} rows={visibleRows} conditionalFormatting={conditionalFormatting} />
          )}
        </div>

      </div>
    </>
  );
}
