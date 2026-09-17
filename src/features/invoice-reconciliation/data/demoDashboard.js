// ---------------------------------------------------------------------
// Demo dataset for the Dashboard.
//
// Shapes here match 04-API-CONTRACT.md exactly — §B.5.1 (kpis),
// §B.5.3 (charts) and §B.5.2 (reconciliation list rows) — so the
// Dashboard renders from one code path whether the numbers came from
// the backend or from this file. Nothing here is random: the values are
// fixed and only the *dates* are computed relative to today, so a reload
// doesn't reshuffle the charts and the demo always looks current.
//
// Used whenever the backend has fewer than MIN_REAL_ROWS records in the
// selected range — see Dashboard.jsx. The backend's seed data is 4
// reconciliations, nowhere near enough to fill a 30-day chart, so this
// set is deliberately busy: real invoice-processing volume for a
// mid-size AP team, not a token handful of rows.
// ---------------------------------------------------------------------

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoTimeDaysAgo(n, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

// 30 buckets, oldest → newest, ~60-165/day on weekdays with a real dip
// every weekend — busy enough that the chart reads as a live system
// instead of a handful of test invoices.
const VOLUME_SHAPE = [
  98, 112, 126, 104, 38, 24, 108,
  131, 142, 138, 119, 45, 29, 124,
  149, 158, 136, 145, 52, 33, 133,
  154, 167, 159, 148, 58, 37, 141,
  163, 172,
];

// Same 30 buckets — net variance per day, scaled up to match the higher
// volume. Mixed sign on purpose: a variance trend that only ever goes up
// isn't a real one.
const VARIANCE_SHAPE = [
  980, 640, -220, 1290, 290, 145, 925,
  1670, 1085, -430, 1455, 335, 210, 1180,
  1980, 1460, 810, -570, 420, 230, 1400,
  1775, 2160, 1240, 950, 505, 280, 1525,
  1935, 1350,
];

export const DEMO_CHARTS = {
  processing_volume: VOLUME_SHAPE.map((count, i) => ({
    date: isoDaysAgo(VOLUME_SHAPE.length - 1 - i),
    count,
  })),
  variance_trend: VARIANCE_SHAPE.map((total_variance, i) => ({
    date: isoDaysAgo(VARIANCE_SHAPE.length - 1 - i),
    total_variance,
  })),
  // Sums to 168 — the same number as open_exceptions below, because the
  // backend derives both from the same population (§B.5.3). Keeping them
  // consistent here too means the donut centre label never contradicts
  // the summary card.
  exception_breakdown: [
    { stage_key: 'po_match', count: 61 },
    { stage_key: 'price_validation', count: 44 },
    { stage_key: 'grn_match', count: 35 },
    { stage_key: 'duplicate_scan', count: 18 },
    { stage_key: 'decision', count: 10 },
  ],
};

export const DEMO_KPIS = {
  total_payable: { value: 4832610.75, unit: 'currency' },
  touchless_rate: { value: 78.4, unit: 'percent', target: 85, target_direction: 'at_least' },
  avg_processing_time: { value: 1.8, unit: 'minutes', target: 2, target_direction: 'at_most' },
  open_exceptions: { value: 168, unit: 'count' },
  total_variance: { value: 71340.6, unit: 'currency' },
};

// The equivalent window immediately before the selected one. Only used
// to render the trend arrows on the summary cards; against a live
// backend this comes from a second /dashboard/kpis call with shifted
// dates, not from here.
export const DEMO_KPIS_PREV = {
  total_payable: { value: 4380950.2, unit: 'currency' },
  touchless_rate: { value: 74.1, unit: 'percent' },
  avg_processing_time: { value: 2.3, unit: 'minutes' },
  open_exceptions: { value: 191, unit: 'count' },
  total_variance: { value: 84120.4, unit: 'currency' },
};

const VENDORS = [
  'Global Supplies Ltd',
  'TechCorp Inc.',
  'NorthPeak Logistics',
  'Meridian Industrial',
  'Bluewave Packaging',
  'Sterling Components',
  'Apex Freight Services',
  'Cedar Office Supply',
  'Vantage Chemicals',
  'Harborline Electronics',
  'Redmoor Fabrication',
  'Kestrel Instruments',
  'Ashfield Materials',
  'Continental Hardware',
  'Prairie Wind Energy',
  'Solace Medical Supply',
  'Lumen Data Systems',
  'Bramwell Textiles',
  'Ironclad Security Co.',
  'Northgate Realty Services',
];

// 24 rows spread over the last 9 days — status mix skews touchless (the
// KPI says 78.4%) with a realistic spread of review/escalation/rejection
// so every filter chip on the table has something to show.
const ROW_SHAPE = [
  { status: 'human_review', confidence: 61, invoice_total: 128450.0, day: 0, h: 14, m: 12 },
  { status: 'touchless_approved', confidence: 97, invoice_total: 42980.0, day: 0, h: 11, m: 48 },
  { status: 'escalated', confidence: 44, invoice_total: 316200.0, day: 0, h: 9, m: 30 },
  { status: 'touchless_approved', confidence: 95, invoice_total: 21150.0, day: 0, h: 8, m: 15 },
  { status: 'touchless_approved', confidence: 94, invoice_total: 18760.5, day: 1, h: 17, m: 5 },
  { status: 'duplicate_flagged', confidence: 52, invoice_total: 64300.0, day: 1, h: 13, m: 22 },
  { status: 'touchless_approved', confidence: 99, invoice_total: 8940.0, day: 1, h: 10, m: 3 },
  { status: 'touchless_approved', confidence: 91, invoice_total: 37620.0, day: 1, h: 9, m: 40 },
  { status: 'human_review', confidence: 73, invoice_total: 92150.75, day: 2, h: 16, m: 40 },
  { status: 'rejected', confidence: 31, invoice_total: 27400.0, day: 2, h: 12, m: 18 },
  { status: 'touchless_approved', confidence: 96, invoice_total: 55620.0, day: 2, h: 9, m: 55 },
  { status: 'touchless_approved', confidence: 93, invoice_total: 14280.0, day: 2, h: 8, m: 47 },
  { status: 'human_review', confidence: 68, invoice_total: 147900.0, day: 3, h: 15, m: 26 },
  { status: 'touchless_approved', confidence: 92, invoice_total: 33180.25, day: 3, h: 11, m: 9 },
  { status: 'touchless_approved', confidence: 98, invoice_total: 9860.0, day: 3, h: 10, m: 2 },
  { status: 'escalated', confidence: 39, invoice_total: 208750.0, day: 4, h: 14, m: 44 },
  { status: 'touchless_approved', confidence: 90, invoice_total: 46320.0, day: 4, h: 12, m: 31 },
  { status: 'touchless_approved', confidence: 97, invoice_total: 15900.0, day: 4, h: 9, m: 18 },
  { status: 'human_review', confidence: 65, invoice_total: 76540.0, day: 5, h: 16, m: 8 },
  { status: 'touchless_approved', confidence: 94, invoice_total: 28870.5, day: 5, h: 11, m: 52 },
  { status: 'duplicate_flagged', confidence: 48, invoice_total: 39900.0, day: 6, h: 13, m: 36 },
  { status: 'touchless_approved', confidence: 96, invoice_total: 61450.0, day: 6, h: 10, m: 21 },
  { status: 'rejected', confidence: 27, invoice_total: 18200.0, day: 7, h: 15, m: 53 },
  { status: 'touchless_approved', confidence: 99, invoice_total: 11340.0, day: 8, h: 9, m: 5 },
];

export const DEMO_ROWS = ROW_SHAPE.map((r, i) => ({
  id: `demo-${1000 + i}`,
  invoice_number: `INV-2${(4820 + i * 7).toString().padStart(4, '0')}`,
  vendor_name: VENDORS[i % VENDORS.length],
  status: r.status,
  confidence: r.confidence,
  confidence_driver_stage: null,
  invoice_total: r.invoice_total,
  created_at: isoTimeDaysAgo(r.day, r.h, r.m),
}));

// Not every invoice in the period shows up in the table — the summary
// card's "N invoices" reads this, the table shows the most recent slice.
export const DEMO_TOTAL = 2846;

// The table only shows the most recent slice, so these can't be counted
// off DEMO_ROWS — they describe the whole period, and together they add
// up to open_exceptions (168).
export const DEMO_EXCEPTION_SPLIT = { human_review: 121, escalated: 47 };
