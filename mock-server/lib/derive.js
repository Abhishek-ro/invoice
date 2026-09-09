// Shared derivations that 04-API-CONTRACT.md requires stay IDENTICAL
// across the endpoints that use them — §B.4.1 and §B.5.3 both cite this
// exact rule and warn that changing one without the other makes the
// filter chips and the chart disagree.

// §F.6: stage_key + field of the highest-absolute-variance mismatch where
// within_tolerance === false; null when there are none.
export function deriveReason(reconciliation) {
  const candidates = (reconciliation.mismatches || []).filter((m) => m.within_tolerance === false);
  if (candidates.length === 0) return null;
  const worst = candidates.reduce((a, b) => (Math.abs(b.variance) > Math.abs(a.variance) ? b : a));
  return { stage_key: worst.stage_key, field: worst.field };
}

export function toListRow(r) {
  return {
    id: r.id,
    invoice_number: r.invoice_number,
    vendor_name: r.vendor_name,
    status: r.status,
    confidence: r.confidence,
    invoice_total: r.invoice_total,
    total_variance: r.total_variance,
    currency: r.currency,
    created_at: r.created_at,
    decided_at: r.decided_at,
  };
}

export function toExceptionRow(r) {
  return {
    id: r.id,
    invoice_number: r.invoice_number,
    vendor_name: r.vendor_name,
    status: r.status,
    confidence: r.confidence,
    invoice_total: r.invoice_total,
    total_variance: r.total_variance,
    currency: r.currency,
    reason: deriveReason(r),
    created_at: r.created_at,
  };
}

export function inDateRange(isoDate, dateFrom, dateTo) {
  const d = isoDate.slice(0, 10);
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}
