// ---------------------------------------------------------------------
// THIS FILE STANDS IN FOR PYTHON'S /extract ENDPOINT (04-API-CONTRACT.md
// Part A). The frontend never calls this — Node does, internally, when
// POST /documents runs (see routes/documents.js). The response shape here
// is exactly §A.3's `fields` + `line_items`, because that's what gets
// echoed back out of POST /documents' `fields`/`line_items` keys.
//
// When the real Python service exists, this file is what gets deleted —
// routes/documents.js makes an HTTP call to PYTHON_BASE/extract instead
// of calling fakeExtract() below. Nothing else changes.
//
// Node vs Python split per §A.1.2: CSV/XLSX are Node-parsed and never hit
// Python at all. That distinction doesn't change what the frontend sees
// (still `extraction_status: 'extracted'` with fields + line_items), so
// this mock collapses it — every non-contract upload goes through
// fakeExtract() regardless of extension.
// ---------------------------------------------------------------------

const VENDOR_POOL = [
  'Meridian Components Ltd',
  'Global Supplies Ltd',
  'TechCorp Inc.',
  'NorthPeak Logistics',
  'Apex Manufacturing',
  'Delta Industrial Co.',
];

// qtyRange keeps flat-fee style lines (a SaaS license, a freight charge) at
// quantity 1 instead of letting the generic 5-200 randomizer below multiply
// an $8,200 freight line into a million-dollar invoice.
const LINE_DESCRIPTIONS = [
  { description: 'Hex bolt M8x40, zinc', sku: 'HB-M8-40Z', unit_price: 61.05, uom: 'EA', qtyRange: [5, 200] },
  { description: 'Steel brackets, powder-coat', sku: 'SB-PC-12', unit_price: 20.5, uom: 'EA', qtyRange: [5, 200] },
  { description: 'Office chairs, ergonomic', sku: 'CHR-ERG', unit_price: 144.0, uom: 'EA', qtyRange: [2, 40] },
  { description: 'Annual SaaS license — Tier 2', sku: 'SVC-T2', unit_price: 4200.0, uom: 'EA', qtyRange: [1, 1] },
  { description: 'Freight — Zone A', sku: 'FRT-A', unit_price: 8200.0, uom: 'EA', qtyRange: [1, 1] },
];

const DOC_NUMBER_PREFIX = {
  invoice: 'INV',
  po: 'PO',
  grn: 'GRN',
  service_entry: 'SES',
  quality: 'QC',
};

// Cheap deterministic hash so the "same" filename extracts the "same" way
// across repeat uploads during a dev session — nicer than pure randomness
// when you're re-testing a flow. Not cryptographic, just a seed.
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulates Python's POST /extract for one document.
 * Mirrors §A.3's response shape (minus doc_id/document_type, which the
 * caller already knows and echoes per §A.1's "Python echoes it back
 * unchanged" rule).
 */
export function fakeExtract({ documentType, filename, poRefHint }) {
  const rand = mulberry32(seedFromString(filename || String(Math.random())));
  const vendor = VENDOR_POOL[Math.floor(rand() * VENDOR_POOL.length)];
  const prefix = DOC_NUMBER_PREFIX[documentType] || 'DOC';
  const docNumber = `${prefix}-${1000 + Math.floor(rand() * 9000)}`;

  const lineCount = 1 + Math.floor(rand() * 2); // 1-2 lines, keeps demo data readable
  const line_items = [];
  let subtotal = 0;
  for (let i = 0; i < lineCount; i++) {
    const pick = LINE_DESCRIPTIONS[Math.floor(rand() * LINE_DESCRIPTIONS.length)];
    const [qtyMin, qtyMax] = pick.qtyRange;
    const quantity = Math.round((qtyMin + rand() * (qtyMax - qtyMin)) * 100) / 100;
    const unit_price = pick.unit_price;
    const line_total = Math.round(quantity * unit_price * 100) / 100;
    subtotal += line_total;
    line_items.push({
      line_no: i + 1,
      description: pick.description,
      sku: pick.sku,
      quantity,
      uom: pick.uom,
      unit_price,
      line_total,
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const tax_amount = Math.round(subtotal * 0.085 * 100) / 100;
  const total = Math.round((subtotal + tax_amount) * 100) / 100;

  const daysAgo = Math.floor(rand() * 10);
  const doc_date = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

  // §A.5: line_items is required and may be empty — 'contract' never
  // reaches this function (routes/documents.js short-circuits it), and
  // every other type gets at least one line in this mock.
  return {
    confidence: 82 + Math.floor(rand() * 17), // 82-98, "extracted" range
    page_count: 1 + Math.floor(rand() * 2),
    fields: {
      vendor_name: vendor,
      doc_number: docNumber,
      doc_date,
      po_ref: documentType === 'invoice' ? poRefHint ?? `PO-${8000 + Math.floor(rand() * 900)}` : null,
      subtotal: documentType === 'grn' || documentType === 'quality' ? null : subtotal,
      tax_amount: documentType === 'grn' || documentType === 'quality' ? null : tax_amount,
      total: documentType === 'grn' || documentType === 'quality' ? null : total,
      currency: 'USD',
    },
    line_items,
    warnings: [],
  };
}
