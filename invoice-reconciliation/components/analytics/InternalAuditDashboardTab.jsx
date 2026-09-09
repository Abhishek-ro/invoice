import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from './KpiTileAnimated';
import { MOCK_AUDIT } from '../../data/mockAnalyticsData';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

export default function InternalAuditDashboardTab() {
  const { isUpdating } = useAnalyticsFilters();
  const d = MOCK_AUDIT;

  return (
    <motion.div initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={containerVariants} style={{ opacity: isUpdating ? 0.4 : 1, transition: 'opacity 0.15s', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Row 1: KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Compliance Score" value={d.auditKpis.complianceScore} suffix="%" />
        <KpiTileAnimated label="Fraud Risk Alerts (Open)" value={d.auditKpis.fraudRiskAlertsOpen} deltaIsGood={false} />
        <KpiTileAnimated label="Duplicate Payments Prevented" value={d.auditKpis.duplicatePaymentsPrevented} prefix="$" />
        <KpiTileAnimated label="Policy Violations" value={d.auditKpis.policyViolations} />
        <KpiTileAnimated label="Override Rate" value={d.auditKpis.overrideRate} suffix="%" />
        <KpiTileAnimated label="Audit-Flagged Invoices" value={d.auditKpis.auditFlaggedInvoices} />
      </div>

      {/* Row 2: Fraud & Overrides */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Fraud Risk Heatmap</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowX: 'auto' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(5, 1fr)', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textAlign: 'center' }}>
                  <div style={{ textAlign: 'left' }}>Vendor</div>
                  <div>Unusual Pattern</div>
                  <div>Supplier Anomaly</div>
                  <div>Freq Anomaly</div>
                  <div>New Bank Details</div>
                  <div>Round Numbers</div>
               </div>
               
               {d.fraudRiskHeatmap.map(v => (
                 <div key={v.vendor} style={{ display: 'grid', gridTemplateColumns: '150px repeat(5, 1fr)', gap: '4px', alignItems: 'center', textAlign: 'center' }}>
                   <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-700)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.vendor}</div>
                   {[v.unusualPattern, v.supplierAnomaly, v.paymentFrequency, v.newBankDetails, v.roundNumbers].map((risk, i) => (
                     <div key={i} style={{ height: '28px', borderRadius: '4px', background: risk === 'high' ? 'var(--tint-danger-border)' : risk === 'medium' ? '#fef08a' : 'var(--tint-success-border)', border: `1px solid ${risk === 'high' ? '#ef4444' : risk === 'medium' ? '#eab308' : '#22c55e'}` }} title={risk.toUpperCase()} />
                   ))}
                 </div>
               ))}
            </div>
         </motion.div>

         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Override Actions Breakdown</div>
            <div style={{ flex: 1, minHeight: 0 }}>
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={d.overrideBreakdown} dataKey="count" nameKey="action" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%">
                     {d.overrideBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={['#10b981', '#ef4444', '#f59e0b'][index]} />)}
                   </Pie>
                   <Tooltip />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                 </PieChart>
               </ResponsiveContainer>
            </div>
         </motion.div>
      </div>

    </motion.div>
  );
}
