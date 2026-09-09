import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

export default function VendorHeader({ vendor }) {
  return (
    <div style={{ background: 'var(--primary-white)', padding: '1.5rem 2rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        
        {/* Initials Avatar */}
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gray-100)', color: 'var(--primary-blue)', fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gray-300)' }}>
          {vendor.name.substring(0, 2).toUpperCase()}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', color: 'var(--gray-900)' }}>{vendor.name}</h1>
            <span style={{ 
              background: vendor.riskTier === 'High' ? 'var(--tint-danger-bg)' : vendor.riskTier === 'Medium' ? 'var(--tint-warning-bg)' : 'var(--tint-success-bg)', 
              color: vendor.riskTier === 'High' ? '#dc2626' : vendor.riskTier === 'Medium' ? '#d97706' : '#16a34a',
              padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 700 
            }}>
              {vendor.riskTier} Risk
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '6px', fontWeight: 500 }}>
            {vendor.category} &bull; Active Since {vendor.activeSince} &bull; Contact: {vendor.primaryContact}
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        
        {/* Health Score Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} title="Health Score (0-100) = (100-mismatchRate)*0.30 + onTimeDeliveryPct*0.25 + contractCompliancePct*0.25 + (100-normalizedRiskScore)*0.15 + (100-normalizedDisputeRate)*0.05">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)' }}>Health Score <span style={{ cursor: 'help' }}>ⓘ</span></div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)' }}>{vendor.healthScore}/100</div>
          </div>
          <div style={{ width: 60, height: 60 }}>
            <RadialBarChart width={60} height={60} cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={6} data={[{ value: vendor.healthScore, fill: vendor.healthScore > 80 ? '#10b981' : vendor.healthScore > 50 ? '#f59e0b' : '#ef4444' }]} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar minAngle={15} background clockWise dataKey="value" cornerRadius={10} />
            </RadialBarChart>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ background: 'var(--primary-white)', color: 'var(--gray-900)', padding: '8px 16px', border: '1px solid var(--gray-300)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Export PDF</button>
          <button style={{ background: 'var(--primary-blue)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Message Vendor</button>
        </div>

      </div>

    </div>
  );
}
