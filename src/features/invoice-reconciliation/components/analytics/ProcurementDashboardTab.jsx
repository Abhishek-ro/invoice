import React from 'react';
import { motion } from 'framer-motion';
import { ScatterChart, Scatter, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ZAxis } from 'recharts';
import KpiTileAnimated from './KpiTileAnimated';
import { MOCK_PROCUREMENT } from '../../data/mockAnalyticsData';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

export default function ProcurementDashboardTab() {
  const { isUpdating } = useAnalyticsFilters();
  const d = MOCK_PROCUREMENT;

  return (
    <motion.div initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={containerVariants} style={{ opacity: isUpdating ? 0.4 : 1, transition: 'opacity 0.15s', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Row 1: KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Active Suppliers" value={d.procurementKpis.activeSuppliers} />
        <KpiTileAnimated label="Avg Invoice Cycle Time" value={d.procurementKpis.avgInvoiceCycleTime} suffix=" days" />
        <KpiTileAnimated label="PO Compliance Rate" value={d.procurementKpis.poComplianceRate} suffix="%" />
        <KpiTileAnimated label="Contract Compliance Rate" value={d.procurementKpis.contractComplianceRate} suffix="%" />
        <KpiTileAnimated label="Open Supplier Disputes" value={d.procurementKpis.openSupplierDisputes} />
        <KpiTileAnimated label="Avg Supplier Response Time" value={d.procurementKpis.avgSupplierResponseTime} suffix=" days" />
      </div>

      {/* Row 2: Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Supplier Scorecard (Spend vs Mismatch vs Cycle Time)</div>
            <div style={{ flex: 1, minHeight: 0 }}>
               <ResponsiveContainer width="100%" height="100%">
                 <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis type="number" dataKey="avgCycleTime" name="Cycle Time" unit="d" tick={{ fontSize: 11 }} label={{ value: 'Avg Cycle Time (Days)', position: 'bottom', fontSize: 11 }} />
                   <YAxis type="number" dataKey="mismatchRate" name="Mismatch Rate" unit="%" tick={{ fontSize: 11 }} label={{ value: 'Mismatch Rate (%)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                   <ZAxis type="number" dataKey="totalSpend" range={[60, 400]} name="Total Spend" />
                   <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                   <Scatter name="Suppliers" data={d.supplierScorecard} fill="var(--primary-blue)" />
                 </ScatterChart>
               </ResponsiveContainer>
            </div>
         </motion.div>

         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Exception Trend by Type</div>
            <div style={{ flex: 1, minHeight: 0 }}>
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={d.exceptionTrendByType}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                   <Tooltip />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                   <Line type="monotone" dataKey="priceVariance" stroke="#f59e0b" dot={false} strokeWidth={2} name="Price" />
                   <Line type="monotone" dataKey="quantityMismatch" stroke="var(--primary-blue)" dot={false} strokeWidth={2} name="Qty" />
                   <Line type="monotone" dataKey="taxError" stroke="#ef4444" dot={false} strokeWidth={2} name="Tax" />
                   <Line type="monotone" dataKey="slaBreach" stroke="#8b5cf6" dot={false} strokeWidth={2} name="SLA" />
                 </LineChart>
               </ResponsiveContainer>
            </div>
         </motion.div>
      </div>

    </motion.div>
  );
}
