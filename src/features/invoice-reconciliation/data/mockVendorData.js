export const MOCK_VENDOR_DIRECTORY = {
  summary: {
    totalActiveVendors: 142,
    totalSpendPeriod: "$8,214,900",
    avgMismatchRate: "14.2%",
    highRiskVendors: 11,
    vendorsWithOpenDisputes: 9
  },
  spendConcentration: [
    { vendor: "Global Supplies Ltd", spend: 284900, cumulativePct: 12.1 },
    { vendor: "Apex Manufacturing", spend: 210300, cumulativePct: 21.1 },
    { vendor: "NorthPeak Logistics", spend: 96450, cumulativePct: 25.2 },
    { vendor: "TechCorp Inc.", spend: 118200, cumulativePct: 30.2 }
  ],
  riskTierDistribution: [
    { tier: "Low", count: 88 }, { tier: "Medium", count: 43 },
    { tier: "High", count: 9 }, { tier: "Critical", count: 2 }
  ],
  onboardingTrend: [
    { month: "Aug", count: 3 }, { month: "Sep", count: 5 }, { month: "Oct", count: 2 },
    { month: "Nov", count: 4 }, { month: "Dec", count: 1 }, { month: "Jan", count: 6 }
  ],
  // vendorGrid carries both the analytics columns the directory table renders
  // (totalSpend, mismatchRate, riskTier, ...) AND the full "master record"
  // fields a Zoho-style New Vendor form collects (pan, gstin, bankDetails,
  // contactPersons, ...). No vendors table exists yet (03 Decisions #6) —
  // this is demo data shaped like the real thing will eventually look.
  vendorGrid: [
    {
      vendorId: "VEND-0042", name: "Global Supplies Ltd", companyName: "Global Supplies Ltd",
      displayName: "Global Supplies Ltd", category: "Raw Materials",
      totalSpend: 284900, invoiceCount: 84, mismatchRate: 18, avgCycleTime: 4.8,
      onTimeDeliveryPct: 91.2, contractCompliancePct: 90.0, riskTier: "Medium",
      openDisputes: 3, lastInvoiceDate: "2026-07-04", trend: "up",
      email: "accounts@globalsupplies.example", phone: "+91 98200 11234", language: "English",
      pan: "AACCG1234H", gstin: "27AACCG1234H1Z5", msmeRegistered: true,
      currency: "INR", paymentTerms: "Net 30", tds: "194C - Contractors", portalEnabled: true,
      openingBalance: 0,
      billingAddress: { attention: "Rakesh Mehta", addressLine1: "Plot 14, MIDC Industrial Area", addressLine2: "Andheri East", city: "Mumbai", state: "Maharashtra", pinCode: "400093", country: "India", phone: "+91 22 4021 5566" },
      contactPersons: [{ salutation: "Mr.", firstName: "Rakesh", lastName: "Mehta", email: "rakesh.mehta@globalsupplies.example", workPhone: "+91 22 4021 5566", mobile: "+91 98200 11234" }],
      bankDetails: { beneficiaryName: "Global Supplies Ltd", bankName: "HDFC Bank", accountNumber: "50100234567890", ifsc: "HDFC0001234", branch: "Andheri East" },
      customFields: [], reportingTags: ["Strategic"], remarks: ""
    },
    {
      vendorId: "VEND-0044", name: "NorthPeak Logistics", companyName: "NorthPeak Logistics",
      displayName: "NorthPeak Logistics", category: "Logistics & Freight",
      totalSpend: 96450, invoiceCount: 63, mismatchRate: 26, avgCycleTime: 6.2,
      onTimeDeliveryPct: 78.4, contractCompliancePct: 81.0, riskTier: "High",
      openDisputes: 4, lastInvoiceDate: "2026-07-05", trend: "up",
      email: "accounts@northpeaklogistics.example", phone: "+91 98110 44556", language: "English",
      pan: "AAECN5678L", gstin: "07AAECN5678L1ZQ", msmeRegistered: false,
      currency: "INR", paymentTerms: "Net 45", tds: "194C - Contractors", portalEnabled: false,
      openingBalance: 12500,
      billingAddress: { attention: "R. Alvarez", addressLine1: "44 Freight Yard Road", addressLine2: "Okhla Industrial Area", city: "New Delhi", state: "Delhi", pinCode: "110020", country: "India", phone: "+91 11 4956 7890" },
      contactPersons: [{ salutation: "Ms.", firstName: "R.", lastName: "Alvarez", email: "accounts@northpeaklogistics.example", workPhone: "+91 11 4956 7890", mobile: "+91 98110 44556" }],
      bankDetails: { beneficiaryName: "NorthPeak Logistics Pvt Ltd", bankName: "ICICI Bank", accountNumber: "003405006789", ifsc: "ICIC0000034", branch: "Okhla" },
      customFields: [], reportingTags: ["High Risk"], remarks: "Risk tier escalated Jun 2026 — see Vendor 360 profile."
    },
    {
      vendorId: "VEND-0043", name: "TechCorp Inc.", companyName: "TechCorp Inc.",
      displayName: "TechCorp Inc.", category: "IT Services",
      totalSpend: 118200, invoiceCount: 52, mismatchRate: 4, avgCycleTime: 2.1,
      onTimeDeliveryPct: 98.1, contractCompliancePct: 99.0, riskTier: "Low",
      openDisputes: 0, lastInvoiceDate: "2026-07-06", trend: "flat",
      email: "billing@techcorp.example", phone: "+91 80 4123 9900", language: "English",
      pan: "AABCT9012M", gstin: "29AABCT9012M1ZR", msmeRegistered: false,
      currency: "INR", paymentTerms: "Net 30", tds: "194J - Professional/Technical Services", portalEnabled: true,
      openingBalance: 0,
      billingAddress: { attention: "Finance Desk", addressLine1: "Tower B, Prestige Tech Park", addressLine2: "Kadubeesanahalli", city: "Bengaluru", state: "Karnataka", pinCode: "560103", country: "India", phone: "+91 80 4123 9900" },
      contactPersons: [{ salutation: "Mr.", firstName: "Arjun", lastName: "Rao", email: "arjun.rao@techcorp.example", workPhone: "+91 80 4123 9900", mobile: "+91 90080 12345" }],
      bankDetails: { beneficiaryName: "TechCorp Inc.", bankName: "Axis Bank", accountNumber: "917020098765", ifsc: "UTIB0001122", branch: "Kadubeesanahalli" },
      customFields: [], reportingTags: [], remarks: ""
    },
    {
      vendorId: "VEND-0045", name: "Sundar Fabricators Pvt Ltd", companyName: "Sundar Fabricators Pvt Ltd",
      displayName: "Sundar Fabricators", category: "Raw Materials",
      totalSpend: 54200, invoiceCount: 31, mismatchRate: 9, avgCycleTime: 3.4,
      onTimeDeliveryPct: 94.0, contractCompliancePct: 92.5, riskTier: "Low",
      openDisputes: 1, lastInvoiceDate: "2026-06-28", trend: "flat",
      email: "accounts@sundarfab.example", phone: "+91 98450 22110", language: "English",
      pan: "AAOFS3344K", gstin: "33AAOFS3344K1Z9", msmeRegistered: true,
      currency: "INR", paymentTerms: "Net 15", tds: "194C - Contractors", portalEnabled: false,
      openingBalance: 8000,
      billingAddress: { attention: "S. Sundar", addressLine1: "12/3 Ambattur Industrial Estate", addressLine2: "", city: "Chennai", state: "Tamil Nadu", pinCode: "600058", country: "India", phone: "+91 44 2625 1190" },
      contactPersons: [{ salutation: "Mr.", firstName: "S.", lastName: "Sundar", email: "s.sundar@sundarfab.example", workPhone: "+91 44 2625 1190", mobile: "+91 98450 22110" }],
      bankDetails: { beneficiaryName: "Sundar Fabricators Pvt Ltd", bankName: "State Bank of India", accountNumber: "31245678901", ifsc: "SBIN0001456", branch: "Ambattur" },
      customFields: [], reportingTags: ["MSME"], remarks: ""
    },
    {
      vendorId: "VEND-0046", name: "Bharat Cloud Services", companyName: "Bharat Cloud Services LLP",
      displayName: "Bharat Cloud Services", category: "IT Services",
      totalSpend: 39800, invoiceCount: 18, mismatchRate: 2, avgCycleTime: 1.6,
      onTimeDeliveryPct: 99.4, contractCompliancePct: 100.0, riskTier: "Low",
      openDisputes: 0, lastInvoiceDate: "2026-07-01", trend: "down",
      email: "finance@bharatcloud.example", phone: "+91 40 6789 1200", language: "English",
      pan: "AAPFB7788N", gstin: "36AAPFB7788N1ZC", msmeRegistered: false,
      currency: "INR", paymentTerms: "Due on Receipt", tds: "194J - Professional/Technical Services", portalEnabled: true,
      openingBalance: 0,
      billingAddress: { attention: "Priya Nair", addressLine1: "3rd Floor, Cyber Towers", addressLine2: "HITEC City", city: "Hyderabad", state: "Telangana", pinCode: "500081", country: "India", phone: "+91 40 6789 1200" },
      contactPersons: [{ salutation: "Ms.", firstName: "Priya", lastName: "Nair", email: "priya.nair@bharatcloud.example", workPhone: "+91 40 6789 1200", mobile: "+91 90000 55221" }],
      bankDetails: { beneficiaryName: "Bharat Cloud Services LLP", bankName: "Kotak Mahindra Bank", accountNumber: "8908001234567", ifsc: "KKBK0000456", branch: "HITEC City" },
      customFields: [], reportingTags: [], remarks: ""
    }
  ]
};

export const MOCK_VENDOR_PROFILE = {
  vendorId: "VEND-0044",
  name: "NorthPeak Logistics",
  category: "Logistics & Freight",
  activeSince: "2021-03-14",
  primaryContact: "R. Alvarez — accounts@northpeaklogistics.example",
  healthScore: 58,
  riskTier: "High",

  overview: {
    kpis: {
      totalSpend: 96450, invoiceCount: 63, avgInvoiceValue: 1531,
      mismatchRate: "26%", onTimeDeliveryPct: 78.4, contractCompliancePct: 81.0,
      openDisputes: 4, avgPaymentCycleTime: 6.2
    },
    spendTrend: [
      { month: "Aug", spend: 6200, projected: false }, { month: "Sep", spend: 7100, projected: false },
      { month: "Oct", spend: 6800, projected: false }, { month: "Nov", spend: 8400, projected: false },
      { month: "Dec", spend: 7900, projected: false }, { month: "Jan", spend: 9200, projected: false },
      { month: "Feb", spend: 8100, projected: false }, { month: "Mar", spend: 8800, projected: false },
      { month: "Apr", spend: 9400, projected: false }, { month: "May", spend: 8600, projected: false },
      { month: "Jun", spend: 9950, projected: false }, { month: "Jul", spend: 6000, projected: false },
      { month: "Aug (proj.)", spend: 7200, projected: true }, { month: "Sep (proj.)", spend: 7400, projected: true }
    ],
    categorySpendBreakdown: [
      { category: "Freight Charges", pct: 68 }, { category: "Warehousing", pct: 22 }, { category: "Fuel Surcharges", pct: 10 }
    ],
    relationshipTimeline: [
      { event: "Vendor Onboarded", date: "2021-03-14", type: "neutral" },
      { event: "Contract Renewed (2-yr term)", date: "2023-03-14", type: "neutral" },
      { event: "Risk Tier Changed: Low → Medium", date: "2025-11-02", type: "warning" },
      { event: "Dispute Opened — Invoice INV-0891 SLA Breach", date: "2026-04-18", type: "negative" },
      { event: "Risk Tier Changed: Medium → High", date: "2026-06-01", type: "negative" }
    ]
  },

  performance: {
    kpis: {
      onTimeDeliveryPct: 78.4, avgGrnToInvoiceLagDays: 3.8,
      avgInvoiceCycleTime: 6.2, firstPassMatchRate: "61%"
    },
    cycleTimeTrend: [
      { month: "Feb", vendor: 5.1, companyAvg: 4.6 }, { month: "Mar", vendor: 5.6, companyAvg: 4.5 },
      { month: "Apr", vendor: 6.0, companyAvg: 4.4 }, { month: "May", vendor: 6.4, companyAvg: 4.3 },
      { month: "Jun", vendor: 6.2, companyAvg: 4.2 }
    ],
    radarProfile: [
      { axis: "On-Time Delivery", value: 78 }, { axis: "Quantity Accuracy", value: 66 },
      { axis: "Price Accuracy", value: 82 }, { axis: "Documentation Completeness", value: 74 },
      { axis: "Response Time", value: 60 }
    ],
    benchmarkComparison: [
      { metric: "Mismatch Rate", vendor: "26%", categoryAvg: "15%", companyAvg: "14.2%", betterThanBenchmark: false },
      { metric: "On-Time Delivery", vendor: "78.4%", categoryAvg: "89%", companyAvg: "91%", betterThanBenchmark: false },
      { metric: "Avg Cycle Time", vendor: "6.2d", categoryAvg: "4.9d", companyAvg: "4.1d", betterThanBenchmark: false }
    ]
  },

  financialImpact: {
    kpis: {
      totalVarianceLifetime: 18420, totalVariancePeriod: 3120, avgVariancePerInvoice: 49.5,
      overbilledRecovered: 6100, underbilledMissed: 1200, duplicatePaymentsBlocked: 2400
    },
    varianceWaterfall: [
      { label: "Expected Payable", value: 96450, type: "total" },
      { label: "Price Variance", value: 1840, type: "delta" },
      { label: "Quantity Variance", value: 980, type: "delta" },
      { label: "Tax Variance", value: 300, type: "delta" },
      { label: "Actual Invoiced", value: 99570, type: "total" }
    ],
    varianceByLineCategory: [
      { category: "Freight Charges", variance: 2400 }, { category: "Warehousing", variance: 620 }, { category: "Fuel Surcharges", variance: 100 }
    ],
    historicalVarianceTable: [
      { invoice_id: "INV-0891", date: "2026-04-18", field: "line.quantity", invoiceValue: 120, expectedValue: 112, varianceAmount: 480, variancePct: "6.7%", resolution: "Disputed" },
      { invoice_id: "INV-0955", date: "2026-05-22", field: "line.unit_price", invoiceValue: 42.5, expectedValue: 41.0, varianceAmount: 210, variancePct: "3.6%", resolution: "Corrected" }
    ]
  },

  contractSla: {
    kpis: { contractComplianceScore: 81.0, slaBreachesPeriod: 3, rateCardDeviations: 5, penaltyClausesTriggered: 2 },
    activeContract: { contractId: "CTR-2023-0044", effectiveDate: "2023-03-14", renewalDate: "2027-03-14", rateCardVersion: "v3.2", clauseCount: 14 },
    slaPerformanceTrend: [
      { month: "Feb", actual: 92, threshold: 95 }, { month: "Mar", actual: 89, threshold: 95 },
      { month: "Apr", actual: 85, threshold: 95 }, { month: "May", actual: 91, threshold: 95 }, { month: "Jun", actual: 88, threshold: 95 }
    ],
    rateCardDeviationTable: [
      { lineItem: "Standard Freight - Zone A", contractedRate: 41.0, recentInvoicedRate: 42.5, deviationPct: "3.6%", status: "Minor Deviation" }
    ],
    penaltyClauseTracker: [
      { clause: "Late Delivery Penalty (>48h)", triggeredCount: 2, estRecoverable: 900 }
    ]
  },

  riskFraud: {
    kpis: { overallRiskScore: 68, duplicateAttemptsLifetime: 3, bankDetailChangeEvents: 1, anomalyAlertsOpen: 2 },
    riskSignals: [
      { signal: "Invoice Pattern Consistency", status: "amber", detail: "Two invoice numbers issued out of sequence in June." },
      { signal: "Payment Frequency Anomaly", status: "red", detail: "3 invoices submitted within 48 hours this month, vs historical norm of 1." },
      { signal: "Round-Number Bias", status: "green", detail: "9% of invoices are round amounts — within normal range." },
      { signal: "Bank/Payment Detail Stability", status: "amber", detail: "Payment details changed once in the last 12 months (Feb 2026)." },
      { signal: "New/Unverified Vendor Flag", status: "green", detail: "Vendor verified, onboarded 5+ years ago." }
    ],
    anomalyTimeline: [
      { event: "Duplicate attempt blocked — INV-0991 vs INV-1007 (94% similarity)", severity: "high", timestamp: "2026-06-29T10:00:00Z" },
      { event: "Bank details updated by vendor portal", severity: "medium", timestamp: "2026-02-11T09:00:00Z" }
    ],
    duplicateAttemptHistory: [
      { invoiceA: "INV-0991", invoiceB: "INV-1007", similarity: 94, date: "2026-06-29", outcome: "Blocked" }
    ]
  },

  trendsActions: {
    compositeTrend: [
      { month: "Feb", mismatchRateInverted: 82, onTimeDelivery: 84, contractCompliance: 88 },
      { month: "Mar", mismatchRateInverted: 78, onTimeDelivery: 82, contractCompliance: 86 },
      { month: "Apr", mismatchRateInverted: 72, onTimeDelivery: 80, contractCompliance: 83 },
      { month: "May", mismatchRateInverted: 76, onTimeDelivery: 79, contractCompliance: 82 },
      { month: "Jun", mismatchRateInverted: 74, onTimeDelivery: 78, contractCompliance: 81 }
    ],
    aiNarrative: "NorthPeak Logistics shows a rising mismatch rate over the last quarter (18% -> 26%), concentrated in quantity variances on freight line items. On-time delivery has also declined 9 points in the same period. Recommend a vendor performance review call and consideration of a tighter quantity tolerance rule specifically for this vendor's GRN matching.",
    recommendedActions: [
      { priority: "High", action: "Schedule vendor performance review", actionable: true, actionType: "draftEmail" },
      { priority: "Medium", action: "Tighten quantity tolerance rule for this vendor", actionable: true, actionType: "goToMatchingRules" },
      { priority: "Low", action: "Monitor next 3 invoices before further action", actionable: false }
    ],
    peerComparison: { vendorHealthScore: 58, categoryAvgHealthScore: 76 }
  }
};
