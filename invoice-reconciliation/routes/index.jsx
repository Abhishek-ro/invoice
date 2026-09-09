import React from 'react';
import { Routes, Route } from 'react-router-dom';
import IRSidebar from '../components/layout/IRSidebar';
import ModuleShell from '../components/layout/ModuleShell';
import Dashboard from '../pages/Dashboard';
import NewReconciliation from '../pages/NewReconciliation';
import ReconciliationDetail from '../pages/ReconciliationDetail';
import ReconciliationHistory from '../pages/ReconciliationHistory';
import ExceptionsQueue from '../pages/ExceptionsQueue';
import VendorIntelligence from '../pages/VendorIntelligence';
import DuplicateDetection from '../pages/DuplicateDetection';
import AnalyticsReports from '../pages/AnalyticsReports';
import MatchingRulesSettings from '../pages/MatchingRulesSettings';
import ErpConfig from '../pages/ErpConfig';
import VendorProfile from '../pages/VendorProfile';
import '../styles/invoice-reconciliation.css';

export default function InvoiceReconApp() {
  return (
    <div className="ud-shell">
      <IRSidebar />
      <div className="ud-main" style={{ display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route element={<ModuleShell />}>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/new"         element={<NewReconciliation />} />
            <Route path="/history"     element={<ReconciliationHistory />} />
            <Route path="/exceptions"  element={<ExceptionsQueue />} />
            <Route path="/vendors"     element={<VendorIntelligence />} />
            <Route path="/vendors/:vendorId" element={<VendorProfile />} />
            <Route path="/duplicates"  element={<DuplicateDetection />} />
            <Route path="/analytics"   element={<AnalyticsReports />} />
            <Route path="/settings/rules" element={<MatchingRulesSettings />} />
            <Route path="/settings/erp"   element={<ErpConfig />} />
            <Route path="/:id"         element={<ReconciliationDetail />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}
