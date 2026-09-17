// In-memory datastore. Resets every time the server restarts — that's fine,
// it's a mock. Shapes here are copied field-for-field from
// 04-API-CONTRACT.md; nothing here is a real database, it's a couple of
// Maps standing in for `documents` / `reconciliations` / `settings`.

import { randomUUID } from 'node:crypto';

export const documents = new Map(); // id -> document
export const reconciliations = new Map(); // id -> reconciliation

// hash (sha256 hex, client-computed over raw file bytes) -> record of the
// document it was first seen on. Scoped to invoice uploads only (that's
// the duplicate-invoice-detection feature) — see routes/documents.js
// POST /documents/check-hash and the hash recorded at the bottom of
// POST /documents when document_type === 'invoice'.
export const documentHashes = new Map(); // hash -> { document_id, original_filename, processed_at }

export const genId = () => randomUUID();
export const nowISO = () => new Date().toISOString();

// §B.2.1 shape, minus updated_at/updated_by which get server-set.
export let settings = {
  tolerance_price_pct: 2.0,
  tolerance_quantity_units: 0,
  tolerance_date_days: 5,
  tolerance_tax_pct: 1.0,
  auto_approve_confidence: 90,
  auto_escalate_variance: 500.0,
  default_match_doc_types: ['po', 'grn'],
  updated_at: '2026-08-02T11:41:09.220Z',
  updated_by: 'P. Sharma',
};

export function setSettings(next) {
  settings = next;
}

// ---- seed helpers -----------------------------------------------------

function seedDocument(overrides) {
  const id = overrides.id || genId();
  const doc = {
    id,
    document_type: 'invoice',
    source: 'upload',
    original_filename: 'seed.pdf',
    mime_type: 'application/pdf',
    byte_size: 184320,
    page_count: 1,
    extraction_status: 'extracted',
    extraction_confidence: 91,
    extraction_error: null,
    extracted_at: nowISO(),
    confirmed_at: nowISO(),
    fields: {
      vendor_name: null,
      doc_number: null,
      doc_date: null,
      po_ref: null,
      subtotal: null,
      tax_amount: null,
      total: null,
      currency: 'USD',
    },
    line_items: [],
    warnings: [],
    created_at: nowISO(),
    ...overrides,
  };
  documents.set(id, doc);
  return doc;
}

function seedReconciliation(r) {
  reconciliations.set(r.id, r);
  return r;
}

// ---- seed data ----------------------------------------------------------
// Record #1 is 04-API-CONTRACT.md §B.3.1's own worked example, reproduced
// verbatim (same ids abbreviated to full uuids) so the contract's sample
// response is literally what this server returns for it.

const invMeridian = seedDocument({
  id: '9f4c1a2e-6b30-4f7a-9c11-2d8e5a7b0c33',
  document_type: 'invoice',
  original_filename: 'meridian-inv-1001.pdf',
  page_count: 2,
  fields: {
    vendor_name: 'Meridian Components Ltd',
    doc_number: 'INV-1001',
    doc_date: '2026-08-14',
    po_ref: 'PO-88213',
    subtotal: 11500.0,
    tax_amount: 850.0,
    total: 12350.0,
    currency: 'USD',
  },
  line_items: [
    { id: genId(), line_no: 1, description: 'Hex bolt M8x40, zinc', sku: 'HB-M8-40Z', quantity: 200.0, uom: 'EA', unit_price: 61.05, line_total: 12210.0 },
  ],
});

const poMeridian = seedDocument({
  document_type: 'po',
  original_filename: 'meridian-po-88213.pdf',
  fields: { vendor_name: 'Meridian Components Ltd', doc_number: 'PO-88213', doc_date: '2026-08-10', po_ref: null, subtotal: 11500.0, tax_amount: 850.0, total: 12350.0, currency: 'USD' },
  line_items: [
    { id: genId(), line_no: 1, description: 'Hex bolt M8x40, zinc', sku: 'HB-M8-40Z', quantity: 200.0, uom: 'EA', unit_price: 61.05, line_total: 12210.0 },
  ],
});

const grnMeridian = seedDocument({
  document_type: 'grn',
  original_filename: 'meridian-grn-4471.pdf',
  fields: { vendor_name: 'Meridian Components Ltd', doc_number: 'GRN-4471', doc_date: '2026-08-13', po_ref: 'PO-88213', subtotal: null, tax_amount: null, total: null, currency: 'USD' },
  line_items: [
    { id: genId(), line_no: 3, description: 'Hex bolt M8x40, zinc', sku: 'HB-M8-40Z', quantity: 198.0, uom: 'EA', unit_price: 61.05, line_total: 12087.9 },
  ],
});

seedReconciliation({
  id: '7a1c1111-0000-4000-8000-000000000001',
  invoice_number: 'INV-1001',
  vendor_name: 'Meridian Components Ltd',
  status: 'human_review',
  confidence: 74,
  confidence_driver_stage: 'grn_match',
  invoice_total: 12350.0,
  expected_payable: 12260.0,
  total_variance: 90.0,
  currency: 'USD',
  tax_rate: 8.5,
  actual_sla: 97.2,
  match_mode: { n: 3, document_types: ['invoice', 'po', 'grn'] },
  tolerance_snapshot: { tolerance_price_pct: 2.0, tolerance_quantity_units: 0, tolerance_date_days: 5, tolerance_tax_pct: 1.0, auto_approve_confidence: 90, auto_escalate_variance: 500.0 },
  human_summary: 'Billed quantity exceeds received quantity on line 1 (200 vs 198 EA). Unit prices and tax reconcile cleanly against the PO. Recommend confirming the short receipt with the vendor before approving.',
  vendor_message: "Hi Meridian — we've held INV-1001 pending a GRN discrepancy. Our goods receipt shows 198 EA received on line 1 versus 200 EA billed. Could you confirm the shipped quantity?",
  duplicate_check: { flagged: false, matches: [] },
  documents: [invMeridian, poMeridian, grnMeridian],
  stages: [
    { stage_key: 'po_match', status: 'passed', confidence: 96, sort_order: 1, detail: '1 of 1 lines matched within tolerance' },
    { stage_key: 'grn_match', status: 'warning', confidence: 74, sort_order: 2, detail: 'Billed 200 EA, received 198 EA on line 1' },
    { stage_key: 'price_validation', status: 'passed', confidence: 98, sort_order: 3, detail: 'Unit prices within ±2% of PO' },
    { stage_key: 'duplicate_scan', status: 'passed', confidence: 100, sort_order: 4, detail: 'No exact match on vendor + invoice number' },
    { stage_key: 'decision', status: 'passed', confidence: 74, sort_order: 5, detail: 'Confidence 74 below auto-approve threshold 90' },
  ],
  mismatches: [
    {
      id: genId(), stage_key: 'grn_match', scope: 'line', field: 'quantity',
      invoice: { document_id: invMeridian.id, line_no: 1, value_num: 200.0, value_text: null },
      expected: { document_id: grnMeridian.id, line_no: 3, value_num: 198.0, value_text: null },
      variance: 2.0, variance_pct: 1.0101, tolerance: { type: 'units', value: 0 }, within_tolerance: false,
    },
  ],
  audit_log: [
    { id: genId(), kind: 'system', action: null, from_status: null, to_status: 'human_review', body: 'Matcher set status from confidence rollup', actor_id: 'system', actor_name: 'system', created_at: '2026-08-14T09:14:02.771Z' },
  ],
  created_at: '2026-08-14T09:13:58.004Z',
  matched_at: '2026-08-14T09:14:02.771Z',
  decided_at: null,
});

// Record #2 — clean touchless approval, no PO/GRN issues.
const invTech = seedDocument({
  document_type: 'invoice', original_filename: 'techcorp-inv-2044.pdf',
  fields: { vendor_name: 'TechCorp Inc.', doc_number: 'INV-2044', doc_date: '2026-08-20', po_ref: 'PO-91004', subtotal: 4200.0, tax_amount: 300.0, total: 4500.0, currency: 'USD' },
  line_items: [{ id: genId(), line_no: 1, description: 'Annual SaaS license — Tier 2', sku: 'SVC-T2', quantity: 1.0, uom: 'EA', unit_price: 4200.0, line_total: 4200.0 }],
});
const poTech = seedDocument({
  document_type: 'po', original_filename: 'techcorp-po-91004.pdf',
  fields: { vendor_name: 'TechCorp Inc.', doc_number: 'PO-91004', doc_date: '2026-08-15', po_ref: null, subtotal: 4200.0, tax_amount: 300.0, total: 4500.0, currency: 'USD' },
  line_items: [{ id: genId(), line_no: 1, description: 'Annual SaaS license — Tier 2', sku: 'SVC-T2', quantity: 1.0, uom: 'EA', unit_price: 4200.0, line_total: 4200.0 }],
});
seedReconciliation({
  id: '7a1c1111-0000-4000-8000-000000000002',
  invoice_number: 'INV-2044', vendor_name: 'TechCorp Inc.', status: 'touchless_approved',
  confidence: 97, confidence_driver_stage: 'decision',
  invoice_total: 4500.0, expected_payable: 4500.0, total_variance: 0.0, currency: 'USD',
  tax_rate: 8.5, actual_sla: 99.1,
  match_mode: { n: 2, document_types: ['invoice', 'po'] },
  tolerance_snapshot: { tolerance_price_pct: 2.0, tolerance_quantity_units: 0, tolerance_date_days: 5, tolerance_tax_pct: 1.0, auto_approve_confidence: 90, auto_escalate_variance: 500.0 },
  human_summary: 'Invoice matches PO exactly on price, quantity and tax. No variances detected.',
  vendor_message: null,
  duplicate_check: { flagged: false, matches: [] },
  documents: [invTech, poTech],
  stages: [
    { stage_key: 'po_match', status: 'passed', confidence: 100, sort_order: 1, detail: '1 of 1 lines matched within tolerance' },
    { stage_key: 'price_validation', status: 'passed', confidence: 100, sort_order: 2, detail: 'Unit prices within ±2% of PO' },
    { stage_key: 'duplicate_scan', status: 'passed', confidence: 100, sort_order: 3, detail: 'No exact match on vendor + invoice number' },
    { stage_key: 'decision', status: 'passed', confidence: 97, sort_order: 4, detail: 'Confidence 97 meets auto-approve threshold 90' },
  ],
  mismatches: [],
  audit_log: [
    { id: genId(), kind: 'system', action: null, from_status: null, to_status: 'touchless_approved', body: 'Matcher set status from confidence rollup', actor_id: 'system', actor_name: 'system', created_at: '2026-08-20T08:12:40.000Z' },
  ],
  created_at: '2026-08-20T08:12:31.000Z', matched_at: '2026-08-20T08:12:40.000Z', decided_at: null,
});

// Record #3 — escalated on a big variance.
const invNorth = seedDocument({
  document_type: 'invoice', original_filename: 'northpeak-inv-3390.pdf',
  fields: { vendor_name: 'NorthPeak Logistics', doc_number: 'INV-3390', doc_date: '2026-08-22', po_ref: 'PO-77120', subtotal: 8200.0, tax_amount: 690.0, total: 8890.0, currency: 'USD' },
  line_items: [{ id: genId(), line_no: 1, description: 'Freight — Zone A, August', sku: 'FRT-A', quantity: 1.0, uom: 'EA', unit_price: 8200.0, line_total: 8200.0 }],
});
seedReconciliation({
  id: '7a1c1111-0000-4000-8000-000000000003',
  invoice_number: 'INV-3390', vendor_name: 'NorthPeak Logistics', status: 'escalated',
  confidence: 42, confidence_driver_stage: 'price_validation',
  invoice_total: 8890.0, expected_payable: 8010.0, total_variance: 880.0, currency: 'USD',
  tax_rate: 8.5, actual_sla: 81.4,
  match_mode: { n: 1, document_types: ['invoice'] },
  tolerance_snapshot: { tolerance_price_pct: 2.0, tolerance_quantity_units: 0, tolerance_date_days: 5, tolerance_tax_pct: 1.0, auto_approve_confidence: 90, auto_escalate_variance: 500.0 },
  human_summary: 'No PO or GRN was attached to this run, so line-level matching could not be performed. Total variance of $880.00 exceeds the auto-escalate threshold.',
  vendor_message: "Hi NorthPeak — INV-3390 has been escalated pending a purchase order reference. Could you send the associated PO number?",
  duplicate_check: { flagged: false, matches: [] },
  documents: [invNorth],
  stages: [
    { stage_key: 'price_validation', status: 'warning', confidence: 60, sort_order: 1, detail: 'line comparison skipped: no PO attached' },
    { stage_key: 'duplicate_scan', status: 'passed', confidence: 100, sort_order: 2, detail: 'No exact match on vendor + invoice number' },
    { stage_key: 'decision', status: 'warning', confidence: 42, sort_order: 3, detail: 'Total variance $880.00 exceeds auto-escalate threshold $500.00' },
  ],
  mismatches: [
    {
      id: genId(), stage_key: 'price_validation', scope: 'header', field: 'total',
      invoice: { document_id: invNorth.id, line_no: null, value_num: 8890.0, value_text: null },
      expected: { document_id: invNorth.id, line_no: null, value_num: 8010.0, value_text: null },
      variance: 880.0, variance_pct: 10.99, tolerance: { type: 'percent', value: 2.0 }, within_tolerance: false,
    },
  ],
  audit_log: [
    { id: genId(), kind: 'system', action: null, from_status: null, to_status: 'escalated', body: 'Matcher set status from confidence rollup', actor_id: 'system', actor_name: 'system', created_at: '2026-08-22T14:02:10.000Z' },
  ],
  created_at: '2026-08-22T14:01:58.000Z', matched_at: '2026-08-22T14:02:10.000Z', decided_at: null,
});

// Record #4 — already rejected (terminal), shows a decision audit row.
const invApex = seedDocument({
  document_type: 'invoice', original_filename: 'apex-inv-1044.pdf',
  fields: { vendor_name: 'Apex Manufacturing', doc_number: 'INV-1044', doc_date: '2026-08-05', po_ref: 'PO-55010', subtotal: 8200.0, tax_amount: 690.0, total: 8890.0, currency: 'USD' },
  line_items: [{ id: genId(), line_no: 1, description: 'Steel brackets, powder-coat', sku: 'SB-PC-12', quantity: 400.0, uom: 'EA', unit_price: 20.5, line_total: 8200.0 }],
});
const grnApex = seedDocument({
  document_type: 'grn', original_filename: 'apex-grn-2201.pdf',
  fields: { vendor_name: 'Apex Manufacturing', doc_number: 'GRN-2201', doc_date: '2026-08-04', po_ref: 'PO-55010', subtotal: null, tax_amount: null, total: null, currency: 'USD' },
  line_items: [{ id: genId(), line_no: 1, description: 'Steel brackets, powder-coat', sku: 'SB-PC-12', quantity: 340.0, uom: 'EA', unit_price: 20.5, line_total: 6970.0 }],
});
seedReconciliation({
  id: '7a1c1111-0000-4000-8000-000000000004',
  invoice_number: 'INV-1044', vendor_name: 'Apex Manufacturing', status: 'rejected',
  confidence: 38, confidence_driver_stage: 'grn_match',
  invoice_total: 8890.0, expected_payable: 6970.0, total_variance: 1920.0, currency: 'USD',
  tax_rate: 8.5, actual_sla: 74.0,
  match_mode: { n: 2, document_types: ['invoice', 'grn'] },
  tolerance_snapshot: { tolerance_price_pct: 2.0, tolerance_quantity_units: 0, tolerance_date_days: 5, tolerance_tax_pct: 1.0, auto_approve_confidence: 90, auto_escalate_variance: 500.0 },
  human_summary: 'Quantity mismatch exceeds tolerance: 400 EA billed vs 340 EA received on line 1 (60 unit shortfall).',
  vendor_message: 'Hi Apex — INV-1044 has been rejected. Our GRN shows 340 EA received against a bill for 400 EA on line 1.',
  duplicate_check: { flagged: false, matches: [] },
  documents: [invApex, grnApex],
  stages: [
    { stage_key: 'grn_match', status: 'warning', confidence: 38, sort_order: 1, detail: 'Billed 400 EA, received 340 EA on line 1' },
    { stage_key: 'price_validation', status: 'passed', confidence: 100, sort_order: 2, detail: 'Unit prices within ±2% of PO' },
    { stage_key: 'duplicate_scan', status: 'passed', confidence: 100, sort_order: 3, detail: 'No exact match on vendor + invoice number' },
    { stage_key: 'decision', status: 'warning', confidence: 38, sort_order: 4, detail: 'Confidence 38 below auto-approve threshold 90' },
  ],
  mismatches: [
    {
      id: genId(), stage_key: 'grn_match', scope: 'line', field: 'quantity',
      invoice: { document_id: invApex.id, line_no: 1, value_num: 400.0, value_text: null },
      expected: { document_id: grnApex.id, line_no: 1, value_num: 340.0, value_text: null },
      variance: 60.0, variance_pct: 17.65, tolerance: { type: 'units', value: 0 }, within_tolerance: false,
    },
  ],
  audit_log: [
    { id: genId(), kind: 'system', action: null, from_status: null, to_status: 'human_review', body: 'Matcher set status from confidence rollup', actor_id: 'system', actor_name: 'system', created_at: '2026-08-05T10:00:00.000Z' },
    { id: genId(), kind: 'decision', action: 'reject', from_status: 'human_review', to_status: 'rejected', body: 'Quantity mismatch exceeds tolerance.', actor_id: 'u_dev_stub', actor_name: 'P. Sharma', created_at: '2026-08-05T14:30:00.000Z' },
  ],
  created_at: '2026-08-05T10:00:00.000Z', matched_at: '2026-08-05T10:00:00.000Z', decided_at: '2026-08-05T14:30:00.000Z',
});

// Record #5 — duplicate_flagged, decidable per §C note 3.
const invGlobalDup = seedDocument({
  document_type: 'invoice', original_filename: 'global-inv-1007.pdf',
  fields: { vendor_name: 'Global Supplies Ltd', doc_number: 'INV-1007', doc_date: '2026-08-29', po_ref: 'PO-60031', subtotal: 2880.0, tax_amount: 240.0, total: 3120.0, currency: 'USD' },
  line_items: [{ id: genId(), line_no: 1, description: 'Office chairs, ergonomic', sku: 'CHR-ERG', quantity: 20.0, uom: 'EA', unit_price: 144.0, line_total: 2880.0 }],
});
seedReconciliation({
  id: '7a1c1111-0000-4000-8000-000000000005',
  invoice_number: 'INV-1007', vendor_name: 'Global Supplies Ltd', status: 'duplicate_flagged',
  confidence: 55, confidence_driver_stage: 'duplicate_scan',
  invoice_total: 3120.0, expected_payable: 3120.0, total_variance: 0.0, currency: 'USD',
  tax_rate: 8.5, actual_sla: 95.0,
  match_mode: { n: 1, document_types: ['invoice'] },
  tolerance_snapshot: { tolerance_price_pct: 2.0, tolerance_quantity_units: 0, tolerance_date_days: 5, tolerance_tax_pct: 1.0, auto_approve_confidence: 90, auto_escalate_variance: 500.0 },
  human_summary: '94% similarity to INV-0991 (same vendor, same amount, invoice number pattern shifted). Held pending manual review.',
  vendor_message: null,
  duplicate_check: { flagged: true, matches: [{ id: '7a1c1111-0000-4000-8000-00000000dup1', invoice_number: 'INV-0991', vendor_name: 'Global Supplies Ltd', invoice_total: 3120.0, created_at: '2026-06-18T09:00:00.000Z' }] },
  documents: [invGlobalDup],
  stages: [
    { stage_key: 'duplicate_scan', status: 'warning', confidence: 55, sort_order: 1, detail: '94% similarity to INV-0991 on vendor + amount' },
    { stage_key: 'decision', status: 'warning', confidence: 55, sort_order: 2, detail: 'Confidence 55 below auto-approve threshold 90' },
  ],
  mismatches: [],
  audit_log: [
    { id: genId(), kind: 'system', action: null, from_status: null, to_status: 'duplicate_flagged', body: 'Matcher set status from confidence rollup', actor_id: 'system', actor_name: 'system', created_at: '2026-08-29T10:05:00.000Z' },
  ],
  created_at: '2026-08-29T10:04:50.000Z', matched_at: '2026-08-29T10:05:00.000Z', decided_at: null,
});
