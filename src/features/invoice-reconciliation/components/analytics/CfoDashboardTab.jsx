import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from './KpiTileAnimated';
import { MOCK_CFO } from '../../data/mockAnalyticsData';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

export default function CfoDashboardTab() {
  const { filters, isUpdating } = useAnalyticsFilters();
  
  // Create a deep copy to apply dummy filters
  let d = JSON.parse(JSON.stringify(MOCK_CFO));

  const dateScale = filters.dateRange === 'Today' ? 0.05 : filters.dateRange === 'Last 7 Days' ? 0.25 : filters.dateRange === 'Last 30 Days' ? 0.8 : filters.dateRange === 'This Year' ? 3.5 : 1;
  const statusScale = filters.status.length > 0 ? filters.status.length / 4 : 1;
  const totalScale = dateScale * statusScale;

  // Apply scale to KPIs
  Object.keys(d.financialKpis).forEach(k => {
    if (k !== 'dpo') d.financialKpis[k] = Math.round(d.financialKpis[k] * totalScale);
  });

  d.cashForecast90Day = d.cashForecast90Day.map(row => ({
    ...row, dueApproved: Math.round(row.dueApproved * totalScale), duePending: Math.round(row.duePending * totalScale)
  }));
  return (
    <motion.div initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={containerVariants} style={{ opacity: isUpdating ? 0.4 : 1, transition: 'opacity 0.15s', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Row 1: KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Total Payables Outstanding" value={d.financialKpis.totalPayablesOutstanding} prefix="$" />
        <KpiTileAnimated label="Days Payable Outstanding (DPO)" value={d.financialKpis.dpo.value} suffix=" days" target={`${d.financialKpis.dpo.benchmark} days`} />
        <KpiTileAnimated label="Cash Preserved via DPO" value={d.financialKpis.cashPreservedDpo} prefix="$" />
        <KpiTileAnimated label="Early Payment Discounts" value={d.financialKpis.earlyPaymentDiscountsCaptured} prefix="$" />
        <KpiTileAnimated label="Est. Automation Savings" value={d.financialKpis.estCostSavings} prefix="$" />
        <KpiTileAnimated label="Working Capital Impact" value={d.financialKpis.workingCapitalImpact} prefix="+$" />
      </div>

      {/* Row 2: Forecast */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>90-Day Cash Outflow Forecast</div>
            <div style={{ flex: 1, minHeight: 0 }}>
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={d.cashForecast90Day}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}k`} />
                   <Tooltip formatter={v => `$${v.toLocaleString()}`} />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                   <Area type="monotone" dataKey="dueApproved" stackId="1" stroke="var(--primary-blue)" fill="var(--primary-blue)" name="Due & Approved" />
                   <Area type="monotone" dataKey="duePending" stackId="1" stroke="var(--gray-400)" fill="var(--gray-300)" strokeDasharray="5 5" name="Due & Pending Review" />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
         </motion.div>

         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>DPO Trend (12 Mo)</div>
            <div style={{ flex: 1, minHeight: 0 }}>
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={d.dpoTrend}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                   <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                   <Tooltip />
                   <Line type="monotone" dataKey="dpo" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} />
                 </LineChart>
               </ResponsiveContainer>
            </div>
         </motion.div>
      </div>

    </motion.div>
  );
}
