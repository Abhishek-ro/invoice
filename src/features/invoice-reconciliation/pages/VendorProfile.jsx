import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { MOCK_VENDOR_PROFILE } from '../data/mockVendorData';
import VendorHeader from '../components/vendors/VendorHeader';
import VendorOverviewTab from '../components/vendors/tabs/VendorOverviewTab';
import VendorPerformanceTab from '../components/vendors/tabs/VendorPerformanceTab';
import VendorFinancialTab from '../components/vendors/tabs/VendorFinancialTab';
import VendorContractTab from '../components/vendors/tabs/VendorContractTab';
import VendorRiskTab from '../components/vendors/tabs/VendorRiskTab';
import VendorTrendsTab from '../components/vendors/tabs/VendorTrendsTab';

export default function VendorProfile() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  // Using the static mock data for demo purposes. In reality, you'd fetch by vendorId.
  const data = MOCK_VENDOR_PROFILE; 
  
  const [activeTab, setActiveTab] = useState('Overview');

  const tabs = [
    { id: 'Overview', label: 'Overview' },
    { id: 'Performance', label: 'Performance' },
    { id: 'Financial', label: 'Financial Impact' },
    { id: 'Contract', label: 'Contract & SLA' },
    { id: 'Risk', label: 'Risk & Fraud' },
    { id: 'Trends', label: 'Trends & Actions' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--gray-50)' }}>
      
      {/* Breadcrumb / Nav */}
      <div style={{ background: 'var(--primary-white)', padding: '12px 2rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => navigate('/invoice-reconciliation/vendors')} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Back to Vendors
        </button>
      </div>

      <VendorHeader vendor={data} />

      <div className="ud-content" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', borderBottom: '1px solid var(--gray-200)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 20px', background: 'none', border: 'none',
                borderBottom: activeTab === t.id ? '3px solid var(--primary-blue)' : '3px solid transparent',
                color: activeTab === t.id ? 'var(--gray-800)' : 'var(--gray-500)',
                fontWeight: activeTab === t.id ? 800 : 600,
                fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ position: 'relative' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'Overview' && <VendorOverviewTab key="Overview" data={data} />}
            {activeTab === 'Performance' && <VendorPerformanceTab key="Performance" data={data} />}
            {activeTab === 'Financial' && <VendorFinancialTab key="Financial" data={data} />}
            {activeTab === 'Contract' && <VendorContractTab key="Contract" data={data} />}
            {activeTab === 'Risk' && <VendorRiskTab key="Risk" data={data} />}
            {activeTab === 'Trends' && <VendorTrendsTab key="Trends" data={data} />}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
