import React, { useState, useEffect, useCallback } from 'react';
import { getTolerances, updateTolerances, ApiError } from '../api';

export default function MatchingRulesSettings() {
  // TODO(04 §B.1.4 / §B.2.1-2): one settings object now, not three
  // independent pieces of local state seeded from a static MOCK_SETTINGS.
  // `raw` holds the full 8-field record exactly as GET /settings/tolerances
  // returns it (including tolerance_tax_pct, default_match_doc_types,
  // updated_at, updated_by — none of which this screen has controls for).
  // The five fields below are the ones this screen actually edits; PUT is a
  // full replace (§B.2.2: "send all eight fields"), so Save spreads `raw`
  // and overrides only these five, rather than inventing UI for fields out
  // of scope for this pass.
  const [raw, setRaw] = useState(null);
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [dateDays, setDateDays] = useState(0);
  const [autoApprove, setAutoApprove] = useState(0);
  const [autoEscalate, setAutoEscalate] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getTolerances();
      setRaw(s);
      setPrice(s.tolerance_price_pct);
      setQuantity(s.tolerance_quantity_units);
      setDateDays(s.tolerance_date_days);
      setAutoApprove(s.auto_approve_confidence);
      setAutoEscalate(s.auto_escalate_variance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load matching rule settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!raw) return;
    setSaving(true);
    setError(null);
    setFieldErrors(null);
    setSavedAt(null);
    try {
      const updated = await updateTolerances({
        ...raw,
        tolerance_price_pct: price,
        tolerance_quantity_units: quantity,
        tolerance_date_days: dateDays,
        auto_approve_confidence: autoApprove,
        auto_escalate_variance: autoEscalate,
      });
      setRaw(updated);
      setSavedAt(updated.updated_at);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_failed') {
        setFieldErrors(err.details?.fields || null);
        setError('Some values are invalid — see below.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title">Matching Rules & Tolerances</h1>
        <div className="topbar__right">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{ padding: '8px 16px', background: 'var(--primary-blue)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: saving || loading ? 'not-allowed' : 'pointer', opacity: saving || loading ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </header>

      <div className="ud-content" style={{ paddingBottom: '3rem', maxWidth: '800px', margin: '0 auto' }}>

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-text)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '13px', fontWeight: 600 }}>⚠ {error}</div>
        )}
        {savedAt && !error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-success-bg)', color: 'var(--tint-success-text)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '13px', fontWeight: 600 }}>✓ Saved.</div>
        )}

        {/* Warning Banner — updated copy: this now really is a network
            round trip to the mock server's in-memory store (04 §B.2.2), so
            "local state only" would be inaccurate. It's still not a real
            database — a mock-server restart resets it to its seed values. */}
        <div style={{ padding: '12px 16px', background: 'var(--tint-escalated-bg)', border: '1px solid var(--tint-warning-border)', borderRadius: '6px', color: 'var(--tint-escalated-text)', fontSize: '13px', fontWeight: 600, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          Settings persist to the mock backend's in-memory store — restarting the mock server resets them to defaults.
        </div>

        {/* Tolerance Rules */}
        <div className="ir-card" style={{ marginBottom: '1.5rem', opacity: loading ? 0.5 : 1 }}>
          <div className="ir-card-head"><span className="ir-card-title">Tolerance Rules</span></div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>Price Tolerance (%)</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>A $100 line item can vary by up to ${(100 * price / 100).toFixed(2)}.</div>
              </div>
              <input type="range" min="0" max="10" step="0.5" value={price} disabled={loading} onChange={e => setPrice(parseFloat(e.target.value))} style={{ width: '100%' }} />
              <div style={{ gridColumn: '2 / -1', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>± {price}%</div>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-200)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>Quantity Tolerance (units)</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>Allow exact unit discrepancies.</div>
                {fieldErrors?.tolerance_quantity_units && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>{fieldErrors.tolerance_quantity_units}</div>}
              </div>
              <input type="number" min="0" value={quantity} disabled={loading} onChange={e => setQuantity(parseInt(e.target.value, 10))} style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', width: '100px' }} />
            </div>

            <div style={{ height: '1px', background: 'var(--gray-200)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>Date Tolerance (days)</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>Allow mismatch between invoice date and PO validity.</div>
                {fieldErrors?.tolerance_date_days && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>{fieldErrors.tolerance_date_days}</div>}
              </div>
              <input type="number" min="0" value={dateDays} disabled={loading} onChange={e => setDateDays(parseInt(e.target.value, 10))} style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', width: '100px' }} />
            </div>

          </div>
        </div>

        {/* Auto-Approval Thresholds */}
        <div className="ir-card" style={{ opacity: loading ? 0.5 : 1 }}>
          <div className="ir-card-head"><span className="ir-card-title">Auto-Approval Thresholds</span></div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>Auto-Approve Confidence</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>Invoices with AI confidence ≥ this value will skip human review.</div>
                {fieldErrors?.auto_approve_confidence && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>{fieldErrors.auto_approve_confidence}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" min="0" max="100" value={autoApprove} disabled={loading} onChange={e => setAutoApprove(parseInt(e.target.value, 10))} style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', width: '80px', textAlign: 'right' }} />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>%</span>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-200)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>Auto-Escalate Variance Amount</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>Invoices with total variance &gt; this value are immediately escalated.</div>
                {fieldErrors?.auto_escalate_variance && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>{fieldErrors.auto_escalate_variance}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>$</span>
                <input type="number" min="0" value={autoEscalate} disabled={loading} onChange={e => setAutoEscalate(parseInt(e.target.value, 10))} style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', width: '100px', textAlign: 'right' }} />
              </div>
            </div>

          </div>
        </div>

        {raw?.updated_by && (
          <div style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--gray-400)', textAlign: 'right' }}>
            Last saved by {raw.updated_by} · {new Date(raw.updated_at).toLocaleString()}
          </div>
        )}

      </div>
    </>
  );
}
