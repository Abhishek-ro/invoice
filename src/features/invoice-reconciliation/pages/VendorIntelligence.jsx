import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ComposedChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MOCK_VENDOR_DIRECTORY } from '../data/mockVendorData';
import DataGridViewer from '../components/shared/DataGridViewer';

export default function VendorIntelligence() {
  const navigate = useNavigate();
  const d = MOCK_VENDOR_DIRECTORY;
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'Strategic (Top 20% Spend)', 'High Risk', 'New (<90 days)', 'Inactive (No invoices 90+ days)', 'Disputed'];

  // Table columns definition
  const columns = [
    { key: 'vendorId', label: 'Vendor ID', sortable: true },
    { key: 'name', label: 'Vendor Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'totalSpend', label: 'Total Spend ($)', sortable: true, render: (val) => `$${val.toLocaleString()}` },
    { key: 'mismatchRate', label: 'Mismatch Rate', sortable: true },
    { key: 'avgCycleTime', label: 'Avg Cycle (d)', sortable: true },
    { key: 'contractCompliancePct', label: 'Compliance (%)', sortable: true, render: (val) => `${val}%` },
    { key: 'openDisputes', label: 'Disputes', sortable: true },
    { 
      key: 'riskTier', 
      label: 'Risk Tier', 
      sortable: true,
      render: (val) => (
        <span style={{ 
          background: val === 'High' ? 'var(--tint-danger-bg)' : val === 'Medium' ? 'var(--tint-warning-bg)' : 'var(--tint-success-bg)', 
          color: val === 'High' ? '#dc2626' : val === 'Medium' ? '#d97706' : '#16a34a',
          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
        }}>
          {val}
        </span>
      )
    },
    { 
      key: 'actions', 
      label: '',
      render: (_, row) => (
        <button 
          onClick={() => navigate(`/invoice-reconciliation/vendors/${row.vendorId}`)}
          style={{ background: 'var(--primary-blue)', color: 'white', padding: '4px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
        >
          View 360° Profile
        </button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--gray-50)' }}>
      
      <header className="topbar" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="topbar__title" style={{ fontSize: '20px' }}>Vendor Intelligence Directory</h1>
        </div>
      </header>

      <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Row 1: Summary Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.25rem' }}>
          <div className="ir-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>Total Active Vendors</div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{d.summary.totalActiveVendors}</div>
          </div>
          <div className="ir-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>Total Spend (Period)</div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{d.summary.totalSpendPeriod}</div>
          </div>
          <div className="ir-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>Avg Mismatch Rate</div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{d.summary.avgMismatchRate}</div>
          </div>
          <div className="ir-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>High-Risk Vendors</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{d.summary.highRiskVendors}</div>
          </div>
          <div className="ir-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>Open Disputes</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{d.summary.vendorsWithOpenDisputes}</div>
          </div>
        </div>

        {/* Row 2: Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          
          <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Spend Concentration (Pareto)</div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.spendConcentration} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="vendor" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tickFormatter={v => `$${v/1000}k`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="spend" fill="var(--primary-blue)" name="Spend" />
                <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Cumulative %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Risk Tier Distribution</div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.riskTierDistribution} dataKey="count" nameKey="tier" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%">
                  {d.riskTierDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.tier === 'Critical' ? 'var(--tint-danger-text)' : entry.tier === 'High' ? '#ef4444' : entry.tier === 'Medium' ? '#f59e0b' : '#10b981'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Vendor Onboarding Trend</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.onboardingTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 3: Filter Chips & Data Grid */}
        <div className="ir-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {filters.map(f => (
              <button 
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: activeFilter === f ? 'var(--primary-50)' : 'var(--gray-50)',
                  color: activeFilter === f ? 'var(--primary-blue)' : 'var(--gray-500)',
                  border: activeFilter === f ? '1px solid var(--primary-blue)' : '1px solid var(--gray-200)'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid var(--gray-200)', borderRadius: '8px', overflow: 'hidden' }}>
            {/* Using DataGridViewer to render the vendorGrid array */}
            <DataGridViewer 
              rows={d.vendorGrid} 
              columns={columns} 
              exportFilename="Vendor_Directory_Export" 
            />
          </div>
        </div>

      </div>
    </div>
  );
}
