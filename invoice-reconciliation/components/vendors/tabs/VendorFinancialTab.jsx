import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from '../../analytics/KpiTileAnimated';
import DataGridViewer from '../../shared/DataGridViewer';

export default function VendorFinancialTab({ data }) {
  const { kpis, varianceWaterfall, varianceByLineCategory, historicalVarianceTable } = data.financialImpact;

  const varCols = [
    { key: 'invoice_id', label: 'Invoice ID' },
    { key: 'date', label: 'Date' },
    { key: 'field', label: 'Field' },
    { key: 'invoiceValue', label: 'Invoiced', render: v => `$${v}` },
    { key: 'expectedValue', label: 'Expected', render: v => `$${v}` },
    { key: 'varianceAmount', label: 'Variance ($)', render: v => `$${v}` },
    { key: 'variancePct', label: 'Variance (%)' },
    { key: 'resolution', label: 'Resolution', render: v => <span style={{ color: v === 'Disputed' ? '#ef4444' : '#10b981', fontWeight: 600 }}>{v}</span> }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Total Variance (Lifetime)" value={kpis.totalVarianceLifetime} prefix="$" deltaIsGood={true} />
        <KpiTileAnimated label="Total Variance (This Period)" value={kpis.totalVariancePeriod} prefix="$" />
        <KpiTileAnimated label="Avg Variance per Invoice" value={kpis.avgVariancePerInvoice} prefix="$" />
        <KpiTileAnimated label="Overbilled Recovered" value={kpis.overbilledRecovered} prefix="$" />
        <KpiTileAnimated label="Underbilled Missed" value={kpis.underbilledMissed} prefix="$" />
        <KpiTileAnimated label="Duplicate Blocks" value={kpis.duplicatePaymentsBlocked} prefix="$" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        
        {/* Waterfall logic via composite chart */}
        <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Variance Waterfall (Expected to Actual)</div>
          <ResponsiveContainer width="100%" height="100%">
            {/* Simple stacked bar to simulate a waterfall for dummy viz */}
            <BarChart data={varianceWaterfall}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v/1000}k`} tick={{ fontSize: 11 }} domain={['dataMin - 2000', 'dataMax + 2000']} />
              <Tooltip formatter={v => `$${v}`} />
              <Bar dataKey="value" fill="#ef4444" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ir-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Variance by Category</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={varianceByLineCategory} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={v => `$${v}`} />
              <Bar dataKey="variance" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      <div className="ir-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Historical Variance Grid</div>
        <DataGridViewer rows={historicalVarianceTable} columns={varCols} />
      </div>

    </motion.div>
  );
}
