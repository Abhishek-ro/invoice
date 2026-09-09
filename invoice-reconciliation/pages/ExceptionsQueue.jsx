import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExceptions, ApiError } from '../api';
import DataGridViewer from '../components/shared/DataGridViewer';

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
// *live* matcher (mock-server/lib/matcher.js, used by POST
// /reconciliations) only ever pushes po_match/grn_match mismatches —
// price_validation only shows up as a reason on hand-authored seed rows
// (mock-server/lib/db.js) that pre-date the matcher. All four chips are
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

export default function ExceptionsQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
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

  const columns = [
    {
      key: 'created_at', label: 'AGE',
      render: (val) => { const a = ageInfo(val); return <span style={{ fontWeight: 800, fontSize: '12px', color: a.old ? '#dc2626' : '#f59e0b' }}>{a.label}</span>; }
    },
    { key: 'invoice_number', label: 'INVOICE ID', render: (val) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{val}</span> },
    { key: 'vendor_name', label: 'VENDOR' },
    { key: 'invoice_total', label: 'AMOUNT', render: (val) => `$${val.toLocaleString()}` },
    { key: 'total_variance', label: 'VARIANCE', render: (val) => <span style={{ color: val !== 0 ? '#dc2626' : 'inherit', fontWeight: 700 }}>{val > 0 ? '+' : ''}${val.toFixed(2)}</span> },
    { key: 'reason', label: 'EXCEPTION REASON', render: (val) => <span style={{ color: 'var(--gray-600)', fontWeight: 600 }}>{formatReason(val)}</span> },
    // TODO(04 §B.3.1 / §B.4.2): was `row.invoice_id.replace('INV-', '6650a')`
    // — a hardcoded string hack that only worked by coincidence for
    // whatever one fixture id looked like. The real row carries its own
    // `id`, so route straight to it.
    { key: 'action', label: 'ACTION', render: (val, row) => <button className="ir-row-btn" onClick={() => navigate(`/invoice-reconciliation/${row.id}`)}>Review</button>, sortable: false }
  ];

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 className="topbar__title">Exceptions Queue</h1>
          <span style={{
            background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-text)', border: '1px solid var(--tint-warning-border)',
            padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700
          }}>
            {rows.length} Pending
          </span>
        </div>
      </header>

      <div className="ud-content">

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-text)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '13px', fontWeight: 600 }}>⚠ {error}</div>
        )}

        {/* Aging Heatmap Strip — now real counts off created_at, not hardcoded 1/1/1/1 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', width: '100%' }}>
          <div style={{ flex: 1, padding: '12px', background: 'var(--tint-success-bg)', border: '1px solid #86efac', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tint-success-text)', textTransform: 'uppercase' }}>&lt; 4h</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--tint-success-text)' }}>{bucketCounts['<4h']}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-border)', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tint-warning-text)', textTransform: 'uppercase' }}>4–24h</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--tint-warning-text)' }}>{bucketCounts['4-24h']}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--tint-danger-bg)', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tint-danger-text)', textTransform: 'uppercase' }}>1–3d</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--tint-danger-text)' }}>{bucketCounts['1-3d']}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--tint-danger-border)', border: '1px solid #f87171', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tint-danger-text)', textTransform: 'uppercase' }}>&gt; 3d</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--tint-danger-text)' }}>{bucketCounts['>3d']}</div>
          </div>
        </div>

        {/* Filters and Bulk Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
            <button style={{ padding: '6px 12px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-400)', cursor: 'not-allowed' }}>Approve Selected</button>
            <button style={{ padding: '6px 12px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-400)', cursor: 'not-allowed' }}>Escalate Selected</button>
          </div>
        </div>

        {/* Exceptions Grid */}
        <div className="ir-card" style={{ padding: 0, height: '500px', display: 'flex', flexDirection: 'column' }}>
          {loading && rows.length === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--gray-400)', textAlign: 'center' }}>Loading exceptions…</div>
          ) : (
            <DataGridViewer columns={columns} rows={rows} />
          )}
        </div>

      </div>
    </>
  );
}
