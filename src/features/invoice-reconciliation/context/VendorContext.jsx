import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { MOCK_VENDOR_DIRECTORY } from '../data/mockVendorData';

// No `vendors` table exists yet (03-DATA-MODEL §Decisions #6) — this context
// just holds the vendor directory in memory for the session so a vendor
// created via the New Vendor form shows up immediately in the directory grid
// and doesn't disappear the moment you navigate away. Refreshing the page
// resets it back to the seed mock data, same as every other mock screen in
// this app.
const VendorContext = createContext(null);

export function VendorProvider({ children }) {
  const [vendors, setVendors] = useState(MOCK_VENDOR_DIRECTORY.vendorGrid);
  const idCounter = useRef(
    MOCK_VENDOR_DIRECTORY.vendorGrid.reduce((max, v) => {
      const n = parseInt(String(v.vendorId).replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0)
  );

  const addVendor = useCallback((form) => {
    idCounter.current += 1;
    const vendorId = `VEND-${String(idCounter.current).padStart(4, '0')}`;
    const record = {
      vendorId,
      name: form.displayName || form.companyName,
      companyName: form.companyName,
      displayName: form.displayName || form.companyName,
      category: form.category || 'Uncategorized',
      email: form.email || '',
      phone: form.phone || '',
      language: form.language || 'English',
      pan: form.pan || '',
      gstin: form.gstin || '',
      msmeRegistered: !!form.msmeRegistered,
      currency: form.currency || 'INR',
      openingBalance: Number(form.openingBalance) || 0,
      paymentTerms: form.paymentTerms || 'Due on Receipt',
      tds: form.tds || 'None',
      portalEnabled: !!form.portalEnabled,
      billingAddress: form.billingAddress || {},
      shippingAddress: form.shippingAddress || {},
      contactPersons: (form.contactPersons || []).filter(c => c.firstName || c.email),
      bankDetails: form.bankDetails || {},
      customFields: (form.customFields || []).filter(f => f.label),
      reportingTags: form.reportingTags || [],
      remarks: form.remarks || '',
      // Brand-new vendor — no invoice history yet, so the analytics columns
      // the directory grid renders start at zero rather than being faked.
      totalSpend: 0, invoiceCount: 0, mismatchRate: 0, avgCycleTime: 0,
      onTimeDeliveryPct: 0, contractCompliancePct: 0, riskTier: 'Low',
      openDisputes: 0, lastInvoiceDate: null, trend: 'flat'
    };
    setVendors(prev => [record, ...prev]);
    return record;
  }, []);

  return (
    <VendorContext.Provider value={{ vendors, addVendor }}>
      {children}
    </VendorContext.Provider>
  );
}

export function useVendors() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendors must be used within a VendorProvider');
  return ctx;
}
