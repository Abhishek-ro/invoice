import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsFilterProvider } from '../context/AnalyticsFilterContext';
import GlobalFilterBar from '../components/analytics/GlobalFilterBar';
import OperationalOverviewTab from '../components/analytics/OperationalOverviewTab';
import CfoDashboardTab from '../components/analytics/CfoDashboardTab';
import ProcurementDashboardTab from '../components/analytics/ProcurementDashboardTab';
import InternalAuditDashboardTab from '../components/analytics/InternalAuditDashboardTab';

export default function AnalyticsReports() {
  const [activeTab, setActiveTab] = useState('Overview');

  const tabs = [
    { id: 'Overview', label: 'Operational Overview' },
    { id: 'CFO', label: 'CFO Dashboard' },
    { id: 'Procurement', label: 'Procurement Dashboard' },
    { id: 'Audit', label: 'Internal Audit Dashboard' }
  ];

  return (
    <AnalyticsFilterProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--gray-50)' }}>
        
        {/* Persistent Sticky Header */}
        <header className="topbar" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 className="topbar__title" style={{ fontSize: '20px' }}>Analytics & Control Tower</h1>
            <div style={{ background: 'var(--primary-50)', color: '#4338ca', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Demo Data</div>
          </div>
          <div className="topbar__right" style={{ gap: '1rem' }}>
            <button className="ir-link-btn" style={{ padding: '8px 16px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontWeight: 600 }}>
              Export Full Report (PDF)
            </button>
          </div>
        </header>

        {/* Global Filter Bar */}
        <GlobalFilterBar />

        <div className="ud-content" style={{ paddingBottom: '3rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0px' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === t.id ? '3px solid var(--primary-blue)' : '3px solid transparent',
                  color: activeTab === t.id ? 'var(--gray-800)' : 'var(--gray-500)',
                  fontWeight: activeTab === t.id ? 800 : 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <div style={{ position: 'relative' }}>
            <AnimatePresence mode="wait">
               {activeTab === 'Overview' && <OperationalOverviewTab key="Overview" />}
               {activeTab === 'CFO' && <CfoDashboardTab key="CFO" />}
               {activeTab === 'Procurement' && <ProcurementDashboardTab key="Procurement" />}
               {activeTab === 'Audit' && <InternalAuditDashboardTab key="Audit" />}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </AnalyticsFilterProvider>
  );
}
