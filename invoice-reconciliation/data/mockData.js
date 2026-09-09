export const MOCK_DASHBOARD = {
  kpis: {
    totalProcessed: "1,245",
    touchlessRate: { current: "42%", target: "85%" },
    avgProcessingTime: { current: "5.2 min", target: "<2 min" },
    invoiceAccuracy: { current: "91%", target: "98%" },
    duplicatesBlocked: { current: "68%", target: "95%" },
    totalPayable: "$1,842,930",
    avgVariancePerInvoice: "$42.18",
    estCostSavings: "$18,400"
  },
  processingVolume: [
    { day: "Mon", count: 45, touchlessPct: 38 },
    { day: "Tue", count: 60, touchlessPct: 44 },
    { day: "Wed", count: 30, touchlessPct: 51 },
    { day: "Thu", count: 80, touchlessPct: 40 },
    { day: "Fri", count: 55, touchlessPct: 47 },
    { day: "Sat", count: 90, touchlessPct: 35 },
    { day: "Sun", count: 70, touchlessPct: 49 }
  ],
  exceptionBreakdown: [
    { type: "Price Variance", pct: 42, color: "#f59e0b" },
    { type: "Quantity Mismatch", pct: 26, color: "#3b82f6" },
    { type: "Tax Error", pct: 14, color: "#ef4444" },
    { type: "SLA/Contract Breach", pct: 18, color: "#8b5cf6" }
  ],
  totalAlerts: 24,
  varianceTrend: [
    { date: "2026-06-05", totalVariance: 210.4 },
    { date: "2026-06-06", totalVariance: -85.1 },
    { date: "2026-06-07", totalVariance: 340.0 }
  ],
  pipelineStatus: [
    { label: "Invoice Ingestion", status: "Operational", ok: true },
    { label: "PO Matching", status: "Operational", ok: true },
    { label: "GRN Matching", status: "Delayed", ok: false },
    { label: "Price Validation", status: "Operational", ok: true },
    { label: "AI Decision", status: "Operational", ok: true }
  ],
  topVendorRisk: [
    { vendor: "Global Supplies Ltd", mismatchCount: 9, trend: "up" },
    { vendor: "NorthPeak Logistics", mismatchCount: 6, trend: "flat" },
    { vendor: "TechCorp Inc.", mismatchCount: 4, trend: "down" }
  ],
  recentReconciliations: [
    { _id: "6650a1", invoice_id: "INV-1001", vendor: "Global Supplies Ltd", status: "human_review", invoice_total: 12350, confidence: 61, createdAt: "2026-07-01T09:45:00Z" },
    { _id: "6650a2", invoice_id: "INV-1002", vendor: "TechCorp Inc.", status: "touchless_approved", invoice_total: 4500, confidence: 97, createdAt: "2026-07-01T08:12:00Z" },
    { _id: "6650a3", invoice_id: "INV-1003", vendor: "NorthPeak Logistics", status: "rejected", invoice_total: 8890, confidence: 38, createdAt: "2026-06-30T17:03:00Z" }
  ]
};

export const MOCK_RECONCILIATION_DETAIL = {
  _id: "6650a1",
  invoice_id: "INV-1001",
  vendor: {
    name: "Global Supplies Ltd",
    riskScore: "Medium",
    totalHistoricalSpend: "$284,900",
    vendorId: "VEND-0042"
  },
  status: "human_review",
  createdAt: "2026-07-01T09:45:00Z",
  financialSummary: {
    invoice_total: 1053.45,
    expected_payable: 1053.0,
    total_variance: 0.45
  },
  mismatches: [
    { stage: "Layer 1", field: "line.unit_price", invoice_value: 61.5, expected_value: 61.05, variance: 0.45, source_doc: "Invoice vs PO", tolerance_applied: "±2%" },
    { stage: "Layer 2", field: "line.quantity", invoice_value: 100, expected_value: 98, variance: 2, source_doc: "Invoice vs GRN", tolerance_applied: "±0 units" }
  ],
  stageTraces: {
    "PO Match": { status: "Passed", detail: "All line items matched within tolerance.", ok: true, confidence: 96 },
    "GRN Match": { status: "Warning", detail: "Quantity variance of 2 units on line 1.", ok: false, confidence: 74 },
    "Price Validation": { status: "Warning", detail: "Unit price 0.75% above contracted rate.", ok: false, confidence: 81 },
    "SLA Compliance": { status: "Passed", detail: "Actual SLA 98.7% vs 95% threshold.", ok: true, confidence: 99 },
    "AI Decision": { status: "Warning", detail: "Routed to human review due to compounding minor variances.", ok: false, confidence: 61 }
  },
  humanSummary: "Invoice INV-1001 shows a $0.45 price variance on line item 1 (0.75% above the contracted rate, within general tolerance but flagged due to a concurrent quantity mismatch of 2 units against the GRN). Recommend manual review before approval; both variances are individually minor but compound to a pattern worth a second look.",
  vendorMessage: "Hi Global Supplies Ltd team — we're reviewing invoice INV-1001 and noticed a small quantity discrepancy (2 units) versus our goods receipt, alongside a minor unit price variance. Could you confirm the shipped quantity on line item 1? Happy to process payment once confirmed.",
  contractIntelligence: {
    clauses: [
      { clause: "Rate Card - Line 1", contractTerms: "$61.05/unit", observed: "$61.50/unit", status: "Minor Variance" },
      { clause: "SLA Threshold", contractTerms: "95% uptime", observed: "98.7%", status: "Compliant" }
    ]
  },
  duplicateCheck: { flagged: false, matches: [] },
  notes: [
    { author: "P. Sharma", text: "Called vendor, awaiting confirmation on quantity.", timestamp: "2026-07-01T10:15:00Z" }
  ],
  overrideLog: [
    { action: "escalate", note: "Routed to procurement for quantity confirmation.", actor: "system", timestamp: "2026-07-01T09:46:00Z" }
  ]
};

export const MOCK_EXCEPTIONS = [
  { ageLabel: "4h", ageOld: false, invoice_id: "INV-1001", vendor: "Global Supplies Ltd", invoice_total: 12350, total_variance: 45.20, reason: "Unit price variance on line item 1" },
  { ageLabel: "2d", ageOld: true, invoice_id: "INV-1004", vendor: "Apex Manufacturing", invoice_total: 8890, total_variance: -120.00, reason: "Quantity mismatch vs GRN" },
  { ageLabel: "6h", ageOld: false, invoice_id: "INV-1006", vendor: "NorthPeak Logistics", invoice_total: 5400, total_variance: 0.00, reason: "SLA score below threshold" },
  { ageLabel: "3d", ageOld: true, invoice_id: "INV-1007", vendor: "Global Supplies Ltd", invoice_total: 3120, total_variance: 3120.00, reason: "Duplicate suspected — 94% match to INV-0991" }
];

export const MOCK_VENDORS = {
  vendors: [
    { id: "VEND-0042", name: "Global Supplies Ltd", invoiceCount: 84, mismatchRate: "18%", risk: "Medium", totalSpend: "$284,900" },
    { id: "VEND-0043", name: "TechCorp Inc.", invoiceCount: 52, mismatchRate: "4%", risk: "Low", totalSpend: "$118,200" },
    { id: "VEND-0044", name: "NorthPeak Logistics", invoiceCount: 63, mismatchRate: "26%", risk: "High", totalSpend: "$96,450" }
  ],
  selectedVendorDetail: {
    id: "VEND-0042",
    spendTrend: [
      { month: "Feb", spend: 38000 }, { month: "Mar", spend: 41200 },
      { month: "Apr", spend: 39800 }, { month: "May", spend: 45600 },
      { month: "Jun", spend: 47100 }, { month: "Jul", spend: 43900 }
    ],
    mismatchPattern: [
      { type: "Price Variance", count: 9 }, { type: "Quantity Mismatch", count: 5 },
      { type: "Tax Error", count: 2 }, { type: "SLA Breach", count: 3 }
    ]
  }
};

export const MOCK_DUPLICATES = {
  summary: { exactMatchesBlocked: 12, fuzzyMatchesFlagged: 5, estSaved: "$41,200" },
  flaggedPairs: [
    {
      id: "DUP-001", similarity: 94,
      invoiceA: { invoice_id: "INV-0991", vendor: "Global Supplies Ltd", amount: 3120, date: "2026-06-18" },
      invoiceB: { invoice_id: "INV-1007", vendor: "Global Supplies Ltd", amount: 3120, date: "2026-06-29" },
      matchType: "Fuzzy — same amount, same vendor, invoice number pattern shifted"
    }
  ]
};

export const MOCK_ANALYTICS = {
  financialImpact: {
    cumulativeVariance: [ { date: "2026-06-01", value: 1200 }, { date: "2026-06-15", value: -400 }, { date: "2026-07-01", value: 2100 } ],
    costSavings: [ { month: "May", value: 12400 }, { month: "Jun", value: 15800 }, { month: "Jul", value: 18400 } ],
    paymentCycleTime: [ { month: "May", days: 9.2 }, { month: "Jun", days: 7.8 }, { month: "Jul", days: 6.1 } ]
  },
  operationalEfficiency: {
    touchlessRateTrend: [ { month: "May", pct: 31 }, { month: "Jun", pct: 37 }, { month: "Jul", pct: 42 } ]
  },
  compliance: {
    overrideBreakdown: [ { action: "Approve", count: 210 }, { action: "Reject", count: 34 }, { action: "Escalate", count: 58 } ]
  }
};

export const MOCK_SETTINGS = {
  tolerances: { price: 2, quantity: 0, tax: 1, dateDays: 5, currency: 0.5 },
  defaultMatchMode: "4-way",
  autoApproveConfidenceThreshold: 90,
  autoEscalateVarianceThreshold: 500
};
