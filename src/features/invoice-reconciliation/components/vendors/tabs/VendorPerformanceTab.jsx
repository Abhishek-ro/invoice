import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from '../../analytics/KpiTileAnimated';
import DataGridViewer from '../../shared/DataGridViewer';

export default function VendorPerformanceTab({ data }) {
  const { kpis, cycleTimeTrend, radarProfile, benchmarkComparison } = data.performance;

  const benchmarkCols = [
    { key: 'metric', label: 'Metric' },
    { key: 'vendor', label: 'Vendor Performance' },
    { key: 'categoryAvg', label: 'Category Avg' },
    { key: 'companyAvg', label: 'Company Avg' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="On-Time Delivery" value={kpis.onTimeDeliveryPct} suffix="%" />
        <KpiTileAnimated label="Avg GRN-to-Invoice Lag" value={kpis.avgGrnToInvoiceLagDays} suffix="d" />
        <KpiTileAnimated label="Avg Invoice Cycle Time" value={kpis.avgInvoiceCycleTime} suffix="d" />
        <KpiTileAnimated label="First-Pass Match Rate" value={parseFloat(kpis.firstPassMatchRate)} suffix="%" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        
        <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Cycle Time Trend vs Company Average</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cycleTimeTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}d`} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="vendor" stroke="#f59e0b" strokeWidth={3} name="Vendor Cycle Time" />
              <Line type="monotone" dataKey="companyAvg" stroke="var(--gray-400)" strokeDasharray="5 5" name="Company Avg" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Delivery Performance Radar</div>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarProfile} outerRadius="70%">
              <PolarGrid />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--gray-500)' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Vendor Profile" dataKey="value" stroke="var(--primary-blue)" fill="var(--primary-blue)" fillOpacity={0.4} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

      </div>

      <div className="ir-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Benchmark Comparison</div>
        <DataGridViewer rows={benchmarkComparison} columns={benchmarkCols} />
      </div>

    </motion.div>
  );
}
