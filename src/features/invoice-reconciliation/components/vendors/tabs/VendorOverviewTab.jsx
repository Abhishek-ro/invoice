import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from '../../analytics/KpiTileAnimated';
import DataGridViewer from '../../shared/DataGridViewer';

export default function VendorOverviewTab({ data }) {
  const { kpis, spendTrend, categorySpendBreakdown, relationshipTimeline } = data.overview;

  const invoiceColumns = [
    { key: 'id', label: 'Invoice ID' },
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Total Spend (Period)" value={kpis.totalSpend} prefix="$" />
        <KpiTileAnimated label="Invoice Count" value={kpis.invoiceCount} />
        <KpiTileAnimated label="Avg Invoice Value" value={kpis.avgInvoiceValue} prefix="$" />
        <KpiTileAnimated label="Mismatch Rate" value={parseFloat(kpis.mismatchRate)} suffix="%" deltaIsGood={false} />
        <KpiTileAnimated label="On-Time Delivery" value={kpis.onTimeDeliveryPct} suffix="%" />
        <KpiTileAnimated label="Contract Compliance" value={kpis.contractCompliancePct} suffix="%" />
        <KpiTileAnimated label="Open Disputes" value={kpis.openDisputes} />
        <KpiTileAnimated label="Avg Payment Cycle" value={kpis.avgPaymentCycleTime} suffix="d" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Spend Trend */}
        <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>12-Month Spend Trend & Forecast</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spendTrend.map((d, index, arr) => {
              const isLastActual = !d.projected && arr[index + 1]?.projected;
              return {
                ...d,
                actual: d.projected ? null : d.spend,
                proj: d.projected ? d.spend : (isLastActual ? d.spend : null)
              };
            })}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v/1000}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `$${v}`} />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="var(--primary-blue)" strokeWidth={3} dot={{ r: 4 }} name="Actual Spend" connectNulls />
              <Line type="monotone" dataKey="proj" stroke="var(--primary-blue)" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} name="Projected Spend" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Spend by Category</div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categorySpendBreakdown} dataKey="pct" nameKey="category" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%">
                {categorySpendBreakdown.map((entry, index) => <Cell key={index} fill={['var(--primary-blue)', '#8b5cf6', '#10b981', '#f59e0b'][index % 4]} />)}
              </Pie>
              <Tooltip formatter={v => `${v}%`} />
              <Legend layout="vertical" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        {/* Timeline */}
        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1.5rem' }}>Relationship Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--gray-200)' }} />
            {relationshipTimeline.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: item.type === 'negative' ? '#ef4444' : item.type === 'warning' ? '#f59e0b' : 'var(--primary-blue)', border: '3px solid white', boxShadow: '0 0 0 1px var(--gray-300)' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-800)' }}>{item.event}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{item.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dummy Invoice Grid */}
        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>Recent Invoices</div>
            <button style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>View All →</button>
          </div>
          <DataGridViewer 
            rows={[{ id: 'INV-1029', date: '2026-07-01', amount: '$4,200', status: 'Pending' }, { id: 'INV-1028', date: '2026-06-25', amount: '$1,850', status: 'Approved' }]} 
            columns={invoiceColumns} 
          />
        </div>
      </div>
    </motion.div>
  );
}
