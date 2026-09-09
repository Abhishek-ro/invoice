import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReconciliation, addNote, postDecision, ApiError } from '../api';
import StatusBadge from '../components/shared/StatusBadge';
import DataGridViewer from '../components/shared/DataGridViewer';
import DocumentComparisonViewer from '../components/shared/DocumentComparisonViewer';
import ActivityTimeline from '../components/shared/ActivityTimeline';

const STAGE_LABELS = { po_match: 'PO Match', grn_match: 'GRN Match', price_validation: 'Price Validation', duplicate_scan: 'Duplicate Scan', decision: 'AI Decision' };

function formatTolerance(t) {
  if (!t) return '—';
  if (t.type === 'percent') return `±${t.value}%`;
  if (t.type === 'units') return `±${t.value} units`;
  return `${t.type}: ${t.value}`;
}

// DocumentComparisonViewer's prop shape (vendor/date/invoice_id/amount +
// lineItems: {desc,qty,price}) predates the API contract and is also used
// by DuplicateDetection.jsx (out of scope, stays on its own mock shape) —
// so rather than change the shared component, adapt real documents into
// it here.
function toViewerDoc(doc) {
  if (!doc) return undefined;
  return {
    vendor: doc.fields.vendor_name,
    date: doc.fields.doc_date,
    invoice_id: doc.fields.doc_number,
    amount: doc.fields.total,
    lineItems: (doc.line_items || []).map((li) => ({ desc: li.description, qty: li.quantity, price: li.unit_price })),
  };
}

export default function ReconciliationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deciding, setDeciding] = useState(false);

  // TODO(04 §B.3.1): one GET, the whole screen — this fixes the exact bug
  // 04 calls out ("the page currently calls useParams() and ignores the
  // id"; every deep link was unverified until this endpoint existed).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setD(await getReconciliation(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this reconciliation.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // TODO(04 §B.3.4 / §B.4.2, §C transition table): note is required for
  // reject/escalate. A prompt() is a stopgap for a proper modal — the
  // original buttons had no handlers at all before this, so this is
  // still a net improvement, just not the final UI.
  const handleDecision = async (action) => {
    let note;
    if (action === 'reject' || action === 'escalate') {
      note = window.prompt(`Note required to ${action} this record:`);
      if (note === null) return; // cancelled
      if (!note.trim()) return setError('A note is required for this action.');
    }
    setDeciding(true);
    setError(null);
    try {
      await postDecision(id, action, note);
      await load(); // §B.4.2: response is deliberately partial — re-fetch the full record
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action} this record.`);
    } finally {
      setDeciding(false);
    }
  };

  const handleAddNote = async (body) => {
    await addNote(id, body);
    await load();
  };

  if (loading && !d) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div>;
  }
  if (!d) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--tint-danger-text)' }}>⚠ {error || 'Not found.'}</div>;
  }

  const invoiceDoc = d.documents.find((doc) => doc.document_type === 'invoice');
  const otherDoc = d.documents.find((doc) => doc.document_type === 'po') || d.documents.find((doc) => doc.document_type === 'grn');

  const mismatchCols = [
    { key: 'stage_key', label: 'STAGE', render: (val) => <span style={{ background: 'var(--primary-50)', color: 'var(--primary-blue)', border: '1px solid var(--primary-200)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>{STAGE_LABELS[val] || val}</span> },
    { key: 'field', label: 'FIELD', render: (val) => <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>{val}</span> },
    { key: '_invoiceVal', label: 'INVOICE VAL', sortable: false, render: (_, row) => row.invoice.value_num ?? row.invoice.value_text ?? '—' },
    { key: '_expectedVal', label: 'EXPECTED VAL', sortable: false, render: (_, row) => row.expected.value_num ?? row.expected.value_text ?? '—' },
    { key: 'variance', label: 'VARIANCE', render: (val) => <span style={{ color: val > 0 ? '#dc2626' : (val < 0 ? '#16a34a' : 'inherit'), fontWeight: 700 }}>{val > 0 ? '+' : ''}{val}</span> },
    { key: '_lines', label: 'LINE (INV / EXP)', sortable: false, render: (_, row) => `${row.invoice.line_no ?? '—'} / ${row.expected.line_no ?? '—'}` },
    { key: 'tolerance', label: 'TOLERANCE', sortable: false, render: (val) => <span style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{formatTolerance(val)}</span> }
  ];

  const mismatchFormatting = (key, row) => {
    if (key === 'variance' && Math.abs(row.variance) > 0) return { background: 'var(--tint-danger-bg)' };
    return {};
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '1.5rem', padding: '1.5rem', alignItems: 'start' }}>

      {/* Left Column (Primary Content) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>⚠ {error}</div>
        )}

        {/* Header (Sticky) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-white)', padding: '16px', borderRadius: '8px', border: '1px solid var(--gray-200)', position: 'sticky', top: '0', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{d.invoice_number}</h1>
            <StatusBadge status={d.status} />
            <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>|</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-700)' }}>{d.vendor_name}</span>
            <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{new Date(d.created_at).toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="ir-action-btn ir-action-escalate" disabled={deciding} onClick={() => handleDecision('escalate')}>Escalate</button>
            <button className="ir-action-btn ir-action-reject" disabled={deciding} onClick={() => handleDecision('reject')}>Reject</button>
            <button className="ir-action-btn ir-action-approve" disabled={deciding} onClick={() => handleDecision('approve')}>Approve Override</button>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="ir-variance-row">
          <div className="ir-variance-card">
            <div className="ir-var-label">Invoice Total</div>
            <div className="ir-var-val">${d.invoice_total.toFixed(2)}</div>
          </div>
          <div className="ir-variance-card">
            <div className="ir-var-label">Expected Payable</div>
            <div className="ir-var-val">${d.expected_payable.toFixed(2)}</div>
          </div>
          <div className="ir-variance-card" style={{ borderLeft: `3px solid ${d.total_variance > 0 ? '#dc2626' : '#10b981'}` }}>
            <div className="ir-var-label">Total Variance</div>
            <div className="ir-var-val" style={{ color: d.total_variance > 0 ? '#dc2626' : '#16a34a' }}>
              {d.total_variance > 0 ? '+' : ''}${d.total_variance.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Document Comparison Viewer */}
        <div className="ir-card" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
          <div className="ir-card-head"><span className="ir-card-title">Document Comparison Viewer</span></div>
          <div style={{ flex: 1, minHeight: 0, padding: '1rem', background: 'var(--gray-100)' }}>
            {/* TODO(04 §B.3.1): documents[].fields + .line_items are Python's
                /extract output, arrived via Node — see toViewerDoc() above
                for the shape adapter. */}
            <DocumentComparisonViewer type="invoice_vs_po" docA={toViewerDoc(invoiceDoc)} docB={toViewerDoc(otherDoc)} />
          </div>
        </div>

        {/* Line-Item Mismatches Grid */}
        <div className="ir-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div className="ir-card-head"><span className="ir-card-title">Line-Item Mismatches</span></div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DataGridViewer
              columns={mismatchCols}
              rows={d.mismatches}
              conditionalFormatting={mismatchFormatting}
              enableExport={true}
              filename={`Mismatches_${d.invoice_number}.xlsx`}
            />
          </div>
        </div>

        {/* Matching Pipeline Timeline */}
        <div className="ir-card">
          <div className="ir-card-head"><span className="ir-card-title">Matching Pipeline</span></div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* TODO(04 §B.3.1): stages is an ordered array with sort_order —
                no fixed stage list assumed (a 3-way run has no
                quality_match/service_entry_match row at all). */}
            {d.stages.map((stage, i, arr) => {
              const ok = stage.status === 'passed';
              return (
                <div key={stage.stage_key} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: ok ? '#10b981' : '#f59e0b', color: 'white'
                    }}>
                      {ok ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>}
                    </div>
                    {i < arr.length - 1 && <div style={{ width: '2px', flex: 1, background: ok ? '#10b981' : 'var(--gray-300)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? '1.5rem' : '0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>{STAGE_LABELS[stage.stage_key] || stage.stage_key}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: stage.confidence > 90 ? '#10b981' : '#f59e0b', background: 'var(--gray-50)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--gray-200)' }}>{stage.confidence}% Conf.</span>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>{stage.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Output Summaries */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="ir-card" style={{ borderTop: '4px solid #8b5cf6' }}>
            <div className="ir-card-head"><span className="ir-card-title">AI Summary</span></div>
            <p style={{ padding: '1.5rem', fontSize: '13px', lineHeight: 1.6, color: 'var(--gray-700)', margin: 0 }}>{d.human_summary}</p>
          </div>
          <div className="ir-card" style={{ borderTop: '4px solid var(--primary-blue)' }}>
            <div className="ir-card-head">
              <span className="ir-card-title">Vendor Message Draft</span>
              {d.vendor_message && <button className="ir-link-btn" onClick={() => navigator.clipboard.writeText(d.vendor_message)}>Copy</button>}
            </div>
            <p style={{ padding: '1.5rem', fontSize: '13px', lineHeight: 1.6, color: 'var(--gray-600)', fontStyle: 'italic', margin: 0 }}>
              {d.vendor_message ? `"${d.vendor_message}"` : 'No vendor message needed — this record auto-approved.'}
            </p>
          </div>
        </div>

      </div>

      {/* Right Column (Contextual Sidebar) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '1.5rem' }}>

        {/* Vendor Snapshot — TODO(04 §B.3.1 / §F.5): no `vendors` table
            exists. This card can only render vendor_name and this
            invoice's own numbers — risk score, historical spend and the
            "View Full Profile" link are all gaps with no data source,
            so they're gone rather than faked. */}
        <div className="ir-card">
          <div className="ir-card-head"><span className="ir-card-title">Vendor Snapshot</span></div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary-50), var(--primary-50))', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
              {d.vendor_name.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>{d.vendor_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>This invoice: ${d.invoice_total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Duplicate Check */}
        <div className="ir-card">
          <div className="ir-card-head"><span className="ir-card-title">Duplicate Scan</span></div>
          <div style={{ padding: '1rem' }}>
            {d.duplicate_check.flagged ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-text)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Possible match: {d.duplicate_check.matches[0]?.invoice_number}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--tint-success-bg)', color: 'var(--tint-success-text)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                No matches found
              </div>
            )}
          </div>
        </div>

        {/* Internal Notes — kind === 'note' rows from the unified audit_log */}
        <div className="ir-card">
          <div className="ir-card-head"><span className="ir-card-title">Internal Notes</span></div>
          <div style={{ padding: '1rem' }}>
            <ActivityTimeline entries={d.audit_log.filter((a) => a.kind === 'note')} type="informal" onAddNote={handleAddNote} />
          </div>
        </div>

        {/* Audit Log — kind in ('system', 'decision') from the same array */}
        <div className="ir-card">
          <div className="ir-card-head"><span className="ir-card-title">Audit Log</span></div>
          <div style={{ padding: '1rem' }}>
            <ActivityTimeline entries={d.audit_log.filter((a) => a.kind !== 'note')} type="formal" />
          </div>
        </div>

        {/* Quick Actions — Download Source Docs / Flag for Audit have no
            handler in 04 either (§D: "no handlers, no endpoints"), left
            as-is */}
        <div className="ir-card">
          <div className="ir-card-head"><span className="ir-card-title">Quick Actions</span></div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button style={{ padding: '8px 12px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>⬇ Download Source Docs (.zip)</button>
            <button style={{ padding: '8px 12px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }} onClick={() => window.print()}>🖨 Print Summary (PDF)</button>
            <button style={{ padding: '8px 12px', background: 'var(--tint-escalated-bg)', border: '1px solid var(--tint-warning-border)', color: 'var(--tint-escalated-text)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>🚩 Flag for Audit</button>
          </div>
        </div>

      </div>
    </div>
  );
}
