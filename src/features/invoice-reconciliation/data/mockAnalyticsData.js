export const MOCK_OPERATIONAL = {
  headlineKpis: {
    totalProcessed: { value: 3842, delta: 6.4, sparkline: [120,135,128,142,150,138,161] },
    touchlessRate: { value: 42.3, target: 85, delta: 1.8 },
    totalInvoiceValue: { value: 8214900, delta: 3.1 },
    totalVarianceDetected: { value: 142380, delta: -9.6, deltaIsGood: true },
    avgProcessingTime: { value: 5.4, target: 2, delta: -0.6 },
    exceptionsOpen: { value: 47 },
    duplicateDollarsBlocked: { value: 61200, delta: 14.2 },
    avgConfidenceScore: { value: 86.7 }
  },
  volumeStatusOverTime: [
    { date: "2026-06-06", touchless: 32, humanReview: 14, escalated: 4, rejected: 3, duplicate: 1 },
    { date: "2026-06-07", touchless: 40, humanReview: 12, escalated: 3, rejected: 2, duplicate: 2 },
    { date: "2026-06-08", touchless: 35, humanReview: 18, escalated: 5, rejected: 4, duplicate: 1 }
  ],
  matchTypeBreakdown: [
    { type: "3-Way", count: 1420 },
    { type: "4-Way", count: 1680 },
    { type: "5-Way", count: 742 }
  ],
  exceptionReasonBreakdown: [
    { reason: "Price Variance", count: 84, color: "#f59e0b" },
    { reason: "Quantity Mismatch", count: 52, color: "#3b82f6" },
    { reason: "Tax Error", count: 28, color: "#ef4444" },
    { reason: "SLA Breach", count: 36, color: "#8b5cf6" },
    { reason: "Duplicate Suspected", count: 19, color: "#ec4899" }
  ],
  processingTimeDistribution: [
    { bucket: "<1min", count: 980 },
    { bucket: "1-3min", count: 1240 },
    { bucket: "3-5min", count: 890 },
    { bucket: "5-10min", count: 520 },
    { bucket: ">10min", count: 212 }
  ],
  topExceptionVendors: [
    { vendor: "NorthPeak Logistics", mismatchCount: 26, risk: "High" },
    { vendor: "Global Supplies Ltd", mismatchCount: 18, risk: "Medium" },
    { vendor: "Apex Manufacturing", mismatchCount: 14, risk: "Medium" },
    { vendor: "Delta Industrial Co.", mismatchCount: 9, risk: "Low" },
    { vendor: "TechCorp Inc.", mismatchCount: 6, risk: "Low" }
  ],
  slaAging: [
    { bucket: "<4h", count: 18 },
    { bucket: "4-24h", count: 15 },
    { bucket: "1-3d", count: 9 },
    { bucket: ">3d", count: 5 }
  ],
  approvalFunnel: [
    { stage: "Ingested", count: 3842, pct: 100 },
    { stage: "Extracted", count: 3801, pct: 98.9 },
    { stage: "Matched", count: 3690, pct: 96.0 },
    { stage: "Pending Approval", count: 412, pct: 10.7 },
    { stage: "Approved", count: 3612, pct: 94.0 },
    { stage: "Rejected", count: 78, pct: 2.0 }
  ],
  recentActivity: [
    { event: "INV-1042 auto-approved — 96% confidence", type: "success", timestamp: "2026-07-06T11:42:00Z" },
    { event: "INV-1039 flagged as duplicate of INV-0991", type: "warning", timestamp: "2026-07-06T11:38:00Z" },
    { event: "P. Sharma escalated INV-1001 to procurement", type: "info", timestamp: "2026-07-06T11:20:00Z" },
    { event: "INV-1044 rejected — quantity mismatch exceeds tolerance", type: "error", timestamp: "2026-07-06T11:05:00Z" }
  ]
};

export const MOCK_CFO = {
  financialKpis: {
    totalPayablesOutstanding: 4120600,
    dpo: { value: 38.2, benchmark: 45 },
    cashPreservedDpo: 284000,
    earlyPaymentDiscountsCaptured: 18400,
    estCostSavings: 52900,
    workingCapitalImpact: 612000
  },
  cashForecast90Day: [
    { week: "W1", dueApproved: 210000, duePending: 45000 },
    { week: "W2", dueApproved: 185000, duePending: 62000 },
    { week: "W3", dueApproved: 240000, duePending: 30000 }
  ],
  dpoTrend: [
    { month: "Aug", dpo: 44 }, { month: "Sep", dpo: 42 }, { month: "Oct", dpo: 41 },
    { month: "Nov", dpo: 40 }, { month: "Dec", dpo: 39.5 }, { month: "Jan", dpo: 39 },
    { month: "Feb", dpo: 38.8 }, { month: "Mar", dpo: 38.5 }, { month: "Apr", dpo: 38.4 },
    { month: "May", dpo: 38.3 }, { month: "Jun", dpo: 38.2 }, { month: "Jul", dpo: 38.2 }
  ],
  payablesByDepartment: [
    { department: "Procurement", amount: 1620000 }, { department: "Engineering", amount: 980000 },
    { department: "Operations", amount: 890000 }, { department: "IT", amount: 410000 },
    { department: "Facilities", amount: 220600 }
  ],
  paymentTermsUtilization: [
    { term: "Net 30", count: 1840 }, { term: "Net 15", count: 620 },
    { term: "Net 45", count: 540 }, { term: "2/10 Net 30", count: 480 }, { term: "Net 60", count: 362 }
  ],
  payablesByCurrency: [
    { currency: "USD", amount: 3120000 }, { currency: "EUR", amount: 620000 },
    { currency: "INR", amount: 280600 }, { currency: "GBP", amount: 100000 }
  ],
  topOutstandingPayables: [
    { invoice_id: "INV-2201", vendor: "Apex Manufacturing", amount: 184200, dueDate: "2026-07-20", daysUntilDue: 14, status: "human_review", department: "Engineering" },
    { invoice_id: "INV-2198", vendor: "Global Supplies Ltd", amount: 152900, dueDate: "2026-07-15", daysUntilDue: 9, status: "touchless_approved", department: "Procurement" }
  ]
};

export const MOCK_PROCUREMENT = {
  procurementKpis: {
    activeSuppliers: 142, avgInvoiceCycleTime: 4.1, poComplianceRate: 88.4,
    contractComplianceRate: 91.2, openSupplierDisputes: 11, avgSupplierResponseTime: 1.8
  },
  supplierScorecard: [
    { vendor: "TechCorp Inc.", avgCycleTime: 2.1, mismatchRate: 4, totalSpend: 118200 },
    { vendor: "Global Supplies Ltd", avgCycleTime: 4.8, mismatchRate: 18, totalSpend: 284900 },
    { vendor: "NorthPeak Logistics", avgCycleTime: 6.2, mismatchRate: 26, totalSpend: 96450 },
    { vendor: "Apex Manufacturing", avgCycleTime: 5.0, mismatchRate: 14, totalSpend: 210300 }
  ],
  exceptionTrendByType: [
    { date: "2026-06-06", priceVariance: 8, quantityMismatch: 5, taxError: 2, slaBreach: 3, duplicate: 1 },
    { date: "2026-06-13", priceVariance: 10, quantityMismatch: 6, taxError: 3, slaBreach: 4, duplicate: 2 },
    { date: "2026-06-20", priceVariance: 7, quantityMismatch: 4, taxError: 1, slaBreach: 5, duplicate: 1 }
  ],
  cycleTimeByDepartment: [
    { department: "Procurement", days: 3.2 }, { department: "Engineering", days: 5.4 },
    { department: "Operations", days: 4.0 }, { department: "IT", days: 3.8 }, { department: "Facilities", days: 4.9 }
  ],
  matchComplianceByType: [
    { matchType: "3-Way", passRate: 94.2 }, { matchType: "4-Way", passRate: 88.1 }, { matchType: "5-Way", passRate: 79.6 }
  ],
  topContractBreaches: [
    { vendor: "NorthPeak Logistics", clause: "SLA Uptime Threshold", count: 6 },
    { vendor: "Apex Manufacturing", clause: "Rate Card - Line 2", count: 4 }
  ],
  supplierPerformanceTable: [
    { vendor: "Global Supplies Ltd", totalInvoices: 84, mismatchRate: "18%", avgCycleTime: 4.8, poCompliance: "86%", contractCompliance: "90%", openDisputes: 3, risk: "Medium" }
  ]
};

export const MOCK_AUDIT = {
  auditKpis: {
    complianceScore: 94.1, fraudRiskAlertsOpen: 6, duplicatePaymentsPrevented: 61200,
    policyViolations: 23, overrideRate: 9.8, auditFlaggedInvoices: 14
  },
  fraudRiskHeatmap: [
    { vendor: "NorthPeak Logistics", unusualPattern: "high", supplierAnomaly: "medium", paymentFrequency: "low", newBankDetails: "high", roundNumbers: "low" },
    { vendor: "Global Supplies Ltd", unusualPattern: "low", supplierAnomaly: "low", paymentFrequency: "low", newBankDetails: "low", roundNumbers: "medium" }
  ],
  overrideBreakdown: [
    { action: "Approve", count: 210 }, { action: "Reject", count: 34 }, { action: "Escalate", count: 58 }
  ],
  policyViolationsByType: [
    { type: "Missing Approval", count: 8 }, { type: "Tolerance Breach Approved Anyway", count: 6 },
    { type: "Segregation of Duties Conflict", count: 3 }, { type: "Late Documentation", count: 4 }, { type: "Unauthorized Vendor", count: 2 }
  ],
  complianceScoreTrend: [
    { month: "Aug", score: 91.2 }, { month: "Sep", score: 91.8 }, { month: "Oct", score: 92.4 },
    { month: "Nov", score: 92.9 }, { month: "Dec", score: 93.1 }, { month: "Jan", score: 93.4 },
    { month: "Feb", score: 93.6 }, { month: "Mar", score: 93.8 }, { month: "Apr", score: 93.9 },
    { month: "May", score: 94.0 }, { month: "Jun", score: 94.0 }, { month: "Jul", score: 94.1 }
  ],
  auditLog: [
    { timestamp: "2026-07-06T09:12:00Z", invoice_id: "INV-1001", vendor: "Global Supplies Ltd", action: "Escalate", actor: "system", note: "Routed to procurement for quantity confirmation.", priorStatus: "human_review", amount: 12350 },
    { timestamp: "2026-07-05T14:30:00Z", invoice_id: "INV-1044", vendor: "Apex Manufacturing", action: "Reject", actor: "P. Sharma", note: "Quantity mismatch exceeds tolerance.", priorStatus: "human_review", amount: 8890 }
  ]
};
