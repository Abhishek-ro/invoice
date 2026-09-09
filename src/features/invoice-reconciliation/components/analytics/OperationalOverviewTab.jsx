import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from './KpiTileAnimated';
import { MOCK_OPERATIONAL } from '../../data/mockAnalyticsData';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

export default function OperationalOverviewTab() {
  const { filters, isUpdating } = useAnalyticsFilters();
  
  // Create a deep copy to apply dummy filters
  let d = JSON.parse(JSON.stringify(MOCK_OPERATIONAL));

  // Dummy filter logic: Scale numbers based on filters
  const dateScale = filters.dateRange === 'Today' ? 0.05 : filters.dateRange === 'Last 7 Days' ? 0.25 : filters.dateRange === 'Last 30 Days' ? 0.8 : filters.dateRange === 'This Year' ? 3.5 : 1;
  const statusScale = filters.status.length > 0 ? filters.status.length / 4 : 1;
  const totalScale = dateScale * statusScale;

  // Apply scale to KPIs
  Object.keys(d.headlineKpis).forEach(k => {
    if (d.headlineKpis[k].value && !['touchlessRate', 'avgProcessingTime', 'avgConfidenceScore'].includes(k)) {
      d.headlineKpis[k].value = Math.round(d.headlineKpis[k].value * totalScale);
    }
  });

  // Apply scale to Charts
  d.volumeStatusOverTime = d.volumeStatusOverTime.map(row => {
    const newRow = { ...row };
    ['touchless', 'humanReview', 'escalated', 'rejected', 'duplicate'].forEach(key => {
      newRow[key] = Math.round(newRow[key] * totalScale);
    });
    return newRow;
  });

  d.approvalFunnel = d.approvalFunnel.map(row => ({
    ...row, count: Math.round(row.count * totalScale)
  }));

  return (
    <motion.div initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={containerVariants} style={{ opacity: isUpdating ? 0.4 : 1, transition: 'opacity 0.15s', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Row 1: KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Total Invoices Processed" value={d.headlineKpis.totalProcessed.value} delta={d.headlineKpis.totalProcessed.delta} />
        <KpiTileAnimated label="Touchless Rate" value={d.headlineKpis.touchlessRate.value} delta={d.headlineKpis.touchlessRate.delta} suffix="%" target="85%" />
        <KpiTileAnimated label="Total Invoice Value" value={d.headlineKpis.totalInvoiceValue.value} delta={d.headlineKpis.totalInvoiceValue.delta} prefix="$" />
        <KpiTileAnimated label="Total Variance Detected" value={d.headlineKpis.totalVarianceDetected.value} delta={d.headlineKpis.totalVarianceDetected.delta} deltaIsGood={d.headlineKpis.totalVarianceDetected.deltaIsGood} prefix="$" />
        <KpiTileAnimated label="Avg Processing Time" value={d.headlineKpis.avgProcessingTime.value} delta={d.headlineKpis.avgProcessingTime.delta} suffix=" min" target="2 min" />
        <KpiTileAnimated label="Exceptions Open (Live)" value={d.headlineKpis.exceptionsOpen.value} />
        <KpiTileAnimated label="Duplicate $ Blocked" value={d.headlineKpis.duplicateDollarsBlocked.value} delta={d.headlineKpis.duplicateDollarsBlocked.delta} prefix="$" />
        <KpiTileAnimated label="Avg Confidence Score" value={d.headlineKpis.avgConfidenceScore.value} suffix="%" />
      </div>

      {/* Row 2: Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '1.5rem' }}>
        
        {/* Invoice Volume & Status */}
        <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Volume & Status Over Time</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.volumeStatusOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="touchless" stackId="1" stroke="#10b981" fill="#10b981" />
                <Area type="monotone" dataKey="humanReview" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                <Area type="monotone" dataKey="escalated" stackId="1" stroke="var(--primary-blue)" fill="var(--primary-blue)" />
                <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ef4444" fill="#ef4444" />
                <Area type="monotone" dataKey="duplicate" stackId="1" stroke="#ec4899" fill="#ec4899" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Match Type */}
        <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
           <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Match-Type Breakdown</div>
           <div style={{ flex: 1, minHeight: 0 }}>
             <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="100%" barSize={16} data={d.matchTypeBreakdown.map((item, i) => ({ ...item, fill: ['var(--primary-blue)', '#8b5cf6', '#10b981'][i] }))}>
                  <RadialBar minAngle={15} background clockWise dataKey="count" cornerRadius={10} />
                  <Tooltip />
                  <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
                </RadialBarChart>
             </ResponsiveContainer>
           </div>
        </motion.div>

        {/* Exception Reason */}
        <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
           <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Exception Reason Breakdown</div>
           <div style={{ flex: 1, minHeight: 0 }}>
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={d.exceptionReasonBreakdown} dataKey="count" nameKey="reason" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5}>
                   {d.exceptionReasonBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                 </Pie>
                 <Tooltip />
               </PieChart>
             </ResponsiveContainer>
           </div>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
             {d.exceptionReasonBreakdown.map(e => (
                <div key={e.reason} style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, background: e.color, borderRadius: 2 }}/>{e.reason}</div>
             ))}
           </div>
        </motion.div>

      </div>

      {/* Row 3: Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>SLA Aging (Open Exceptions)</div>
            <div style={{ display: 'flex', height: '32px', borderRadius: '8px', overflow: 'hidden' }}>
              {d.slaAging.map((s, i) => (
                 <div key={s.bucket} style={{ flex: s.count, background: ['#10b981', '#f59e0b', '#f97316', '#ef4444'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 700 }} title={`${s.bucket}: ${s.count}`}>
                   {s.count}
                 </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600 }}>
              {d.slaAging.map((s, i) => <span key={s.bucket}>{s.bucket}</span>)}
            </div>
         </motion.div>

         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Approval Funnel</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
               {d.approvalFunnel.map((f, i) => (
                  <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '100px', fontWeight: 600, color: 'var(--gray-600)' }}>{f.stage}</div>
                    <div style={{ flex: 1, background: 'var(--gray-100)', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                       <div style={{ width: `${f.pct}%`, background: 'var(--primary-blue)', height: '100%' }} />
                    </div>
                    <div style={{ width: '40px', textAlign: 'right', fontWeight: 700 }}>{f.pct}%</div>
                  </div>
               ))}
            </div>
         </motion.div>

         <motion.div variants={containerVariants} className="ir-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1rem' }}>Recent Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {d.recentActivity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                     <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.type === 'success' ? '#10b981' : a.type === 'error' ? '#ef4444' : a.type === 'warning' ? '#f59e0b' : 'var(--primary-blue)', marginTop: '4px', flexShrink: 0 }} />
                     <div>
                       <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{a.event}</div>
                       <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>{new Date(a.timestamp).toLocaleTimeString()}</div>
                     </div>
                  </div>
               ))}
            </div>
         </motion.div>
      </div>
    </motion.div>
  );
}
