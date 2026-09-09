// ---------------------------------------------------------------------
// MOCK matching engine. This is NOT 05-MATCHING-RULES.md implemented —
// it's a simplified approximation that produces contract-shaped,
// internally-consistent, plausibly-varied results so the frontend has
// something real to render (different confidences, some passing stages,
// some failing, occasional escalation/duplicate) instead of one static
// fixture. When the real Node backend implements 05's actual rules, this
// whole file is what gets replaced — routes/reconciliations.js is the
// only caller, and it only needs runMatch() to keep returning this same
// shape.
// ---------------------------------------------------------------------

function pairLines(a, b) {
  const byLineNo = new Map(b.map((l) => [l.line_no, l]));
  return a.map((line, i) => ({ invoiceLine: line, otherLine: byLineNo.get(line.line_no) || b[i] || null }));
}

function pctDiff(a, b) {
  if (!a && !b) return 0;
  const base = Math.abs(a) || 1;
  return (Math.abs(a - b) / base) * 100;
}

/**
 * @param {object[]} docs - the documents attached to this run (full doc objects from db.js)
 * @param {object} settings - current tolerance/threshold settings (db.js `settings`)
 * @param {object[]} existingReconciliations - already-stored reconciliations, for the duplicate scan
 */
export function runMatch({ docs, settings, existingReconciliations }) {
  const byType = Object.fromEntries(docs.map((d) => [d.document_type, d]));
  const invoice = byType.invoice;
  const po = byType.po;
  const grn = byType.grn;

  // contract documents are stored + linked but excluded from the n-way
  // count and never matched against (04 §B.1.3, 01 cut #1).
  const matchedDocs = docs.filter((d) => d.document_type !== 'contract');
  const match_mode = { n: matchedDocs.length, document_types: matchedDocs.map((d) => d.document_type) };

  const stages = [];
  const mismatches = [];
  let sortOrder = 1;

  // ---- po_match --------------------------------------------------------
  if (po) {
    const pairs = pairLines(invoice.line_items, po.line_items);
    let worst = 100;
    for (const { invoiceLine, otherLine } of pairs) {
      if (!otherLine) continue;
      const qtyDiff = Math.abs(invoiceLine.quantity - otherLine.quantity);
      const priceDiffPct = pctDiff(invoiceLine.unit_price, otherLine.unit_price);
      if (qtyDiff > settings.tolerance_quantity_units) {
        mismatches.push({
          id: undefined, stage_key: 'po_match', scope: 'line', field: 'quantity',
          invoice: { document_id: invoice.id, line_no: invoiceLine.line_no, value_num: invoiceLine.quantity, value_text: null },
          expected: { document_id: po.id, line_no: otherLine.line_no, value_num: otherLine.quantity, value_text: null },
          variance: qtyDiff, variance_pct: pctDiff(invoiceLine.quantity, otherLine.quantity),
          tolerance: { type: 'units', value: settings.tolerance_quantity_units }, within_tolerance: false,
        });
        worst = Math.min(worst, 65);
      }
      if (priceDiffPct > settings.tolerance_price_pct) {
        mismatches.push({
          id: undefined, stage_key: 'po_match', scope: 'line', field: 'unit_price',
          invoice: { document_id: invoice.id, line_no: invoiceLine.line_no, value_num: invoiceLine.unit_price, value_text: null },
          expected: { document_id: po.id, line_no: otherLine.line_no, value_num: otherLine.unit_price, value_text: null },
          variance: Math.round((invoiceLine.unit_price - otherLine.unit_price) * 100) / 100, variance_pct: priceDiffPct,
          tolerance: { type: 'percent', value: settings.tolerance_price_pct }, within_tolerance: false,
        });
        worst = Math.min(worst, 70);
      }
    }
    stages.push({
      stage_key: 'po_match', status: worst === 100 ? 'passed' : 'warning', confidence: worst, sort_order: sortOrder++,
      detail: worst === 100 ? `${pairs.length} of ${pairs.length} lines matched within tolerance` : 'One or more lines outside price/quantity tolerance vs PO',
    });
  }

  // ---- grn_match ---------------------------------------------------------
  if (grn) {
    const pairs = pairLines(invoice.line_items, grn.line_items);
    let worst = 100;
    for (const { invoiceLine, otherLine } of pairs) {
      if (!otherLine) continue;
      const qtyDiff = Math.abs(invoiceLine.quantity - otherLine.quantity);
      if (qtyDiff > settings.tolerance_quantity_units) {
        mismatches.push({
          id: undefined, stage_key: 'grn_match', scope: 'line', field: 'quantity',
          invoice: { document_id: invoice.id, line_no: invoiceLine.line_no, value_num: invoiceLine.quantity, value_text: null },
          expected: { document_id: grn.id, line_no: otherLine.line_no, value_num: otherLine.quantity, value_text: null },
          variance: qtyDiff, variance_pct: pctDiff(invoiceLine.quantity, otherLine.quantity),
          tolerance: { type: 'units', value: settings.tolerance_quantity_units }, within_tolerance: false,
        });
        worst = Math.min(worst, 74);
      }
    }
    stages.push({
      stage_key: 'grn_match', status: worst === 100 ? 'passed' : 'warning', confidence: worst, sort_order: sortOrder++,
      detail: worst === 100 ? `${pairs.length} of ${pairs.length} lines matched within tolerance` : 'Billed quantity differs from received quantity on one or more lines',
    });
  }

  // ---- price_validation ---------------------------------------------------
  // §A.5: if neither PO nor GRN is attached, line-scoped comparison can't
  // run at all — the stage still runs (header-only degrade), capped at 60
  // so it structurally can't clear auto-approve.
  if (!po && !grn) {
    stages.push({ stage_key: 'price_validation', status: 'warning', confidence: 60, sort_order: sortOrder++, detail: 'line comparison skipped: no PO or GRN attached' });
  } else {
    const reference = po || grn;
    const refTotal = reference.fields.total ?? invoice.fields.total;
    const totalDiffPct = pctDiff(invoice.fields.total, refTotal);
    const passed = totalDiffPct <= settings.tolerance_price_pct;
    stages.push({
      stage_key: 'price_validation', status: passed ? 'passed' : 'warning', confidence: passed ? 98 : 72, sort_order: sortOrder++,
      detail: passed ? `Unit prices within ±${settings.tolerance_price_pct}% of PO` : `Invoice total differs from PO by ${totalDiffPct.toFixed(1)}%`,
    });
  }

  // ---- duplicate_scan ------------------------------------------------------
  const dupMatch = existingReconciliations.find(
    (r) => r.vendor_name === invoice.fields.vendor_name && Math.abs(r.invoice_total - invoice.fields.total) < 0.01
  );
  stages.push({
    stage_key: 'duplicate_scan', status: dupMatch ? 'warning' : 'passed', confidence: dupMatch ? 55 : 100, sort_order: sortOrder++,
    detail: dupMatch ? `Same vendor + amount as ${dupMatch.invoice_number}` : 'No exact match on vendor + invoice number',
  });
  const duplicate_check = dupMatch
    ? { flagged: true, matches: [{ id: dupMatch.id, invoice_number: dupMatch.invoice_number, vendor_name: dupMatch.vendor_name, invoice_total: dupMatch.invoice_total, created_at: dupMatch.created_at }] }
    : { flagged: false, matches: [] };

  // ---- expected_payable / variance -----------------------------------------
  let expected_payable = (po ? po.fields.total : invoice.fields.total) ?? invoice.fields.total;
  const qtyShortfallValue = mismatches
    .filter((m) => m.stage_key === 'grn_match' && m.field === 'quantity')
    .reduce((sum, m) => {
      const line = invoice.line_items.find((l) => l.line_no === m.invoice.line_no);
      return sum + m.variance * (line ? line.unit_price : 0);
    }, 0);
  expected_payable = Math.round((expected_payable - qtyShortfallValue) * 100) / 100;
  const invoice_total = invoice.fields.total;
  const total_variance = Math.round((invoice_total - expected_payable) * 100) / 100;

  // ---- decision (always last) ----------------------------------------------
  const rollupConfidence = Math.min(...stages.map((s) => s.confidence));
  const driverStage = stages.find((s) => s.confidence === rollupConfidence)?.stage_key ?? null;
  stages.push({
    stage_key: 'decision', status: rollupConfidence >= settings.auto_approve_confidence ? 'passed' : 'warning', confidence: rollupConfidence, sort_order: sortOrder++,
    detail: rollupConfidence >= settings.auto_approve_confidence
      ? `Confidence ${rollupConfidence} meets auto-approve threshold ${settings.auto_approve_confidence}`
      : `Confidence ${rollupConfidence} below auto-approve threshold ${settings.auto_approve_confidence}`,
  });

  // Priority: duplicate > escalate-on-variance > touchless > human_review.
  // Touchless requires both a high rollup confidence AND zero open
  // mismatches (every mismatch we construct above is already
  // within_tolerance:false, so any mismatch at all blocks touchless).
  let status;
  if (dupMatch) status = 'duplicate_flagged';
  else if (Math.abs(total_variance) > settings.auto_escalate_variance) status = 'escalated';
  else if (rollupConfidence >= settings.auto_approve_confidence && mismatches.length === 0) status = 'touchless_approved';
  else status = 'human_review';

  const human_summary = mismatches.length === 0
    ? `Invoice ${invoice.fields.doc_number} matches ${match_mode.document_types.filter((t) => t !== 'invoice').join(' and ') || 'no supporting documents'} within tolerance. No variances detected.`
    : `${mismatches.length} field${mismatches.length > 1 ? 's' : ''} outside tolerance: ${mismatches.map((m) => `${m.field} on line ${m.invoice.line_no ?? '—'}`).join(', ')}. Total variance $${Math.abs(total_variance).toFixed(2)}.`;
  const vendor_message = status === 'touchless_approved' ? null
    : `Hi ${invoice.fields.vendor_name} — we're reviewing ${invoice.fields.doc_number} and wanted to flag a discrepancy before processing payment. We'll follow up with specifics shortly.`;

  return {
    match_mode, stages, mismatches, confidence: rollupConfidence, confidence_driver_stage: driverStage,
    expected_payable, invoice_total, total_variance, status, duplicate_check, human_summary, vendor_message,
  };
}
