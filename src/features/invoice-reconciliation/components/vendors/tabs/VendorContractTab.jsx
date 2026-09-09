import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiTileAnimated from '../../analytics/KpiTileAnimated';
import DataGridViewer from '../../shared/DataGridViewer';

export default function VendorContractTab({ data }) {
  const { kpis, activeContract, slaPerformanceTrend, rateCardDeviationTable, penaltyClauseTracker } = data.contractSla;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Contract Compliance Score" value={kpis.contractComplianceScore} suffix="%" />
        <KpiTileAnimated label="SLA Breaches (Period)" value={kpis.slaBreachesPeriod} deltaIsGood={false} />
        <KpiTileAnimated label="Rate Card Deviations" value={kpis.rateCardDeviations} deltaIsGood={false} />
        <KpiTileAnimated label="Penalty Clauses Triggered" value={kpis.penaltyClausesTriggered} deltaIsGood={false} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        
        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1.5rem' }}>Active Contract Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Contract ID</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>{activeContract.contractId}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Effective Dates</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-800)' }}>{activeContract.effectiveDate} to {activeContract.renewalDate}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Rate Card Version</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-blue)', textDecoration: 'underline', cursor: 'pointer' }}>{activeContract.rateCardVersion}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Key Clause Count</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-800)' }}>{activeContract.clauseCount} tracked clauses</div>
            </div>
          </div>
        </div>

        <div className="ir-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>SLA Performance Trend</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={slaPerformanceTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[70, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#8b5cf6" strokeWidth={3} name="Actual SLA %" />
              <Line type="monotone" dataKey="threshold" stroke="#ef4444" strokeDasharray="5 5" name="Required Threshold" />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Rate Card Deviations</div>
          <DataGridViewer 
            rows={rateCardDeviationTable} 
            columns={[
              { key: 'lineItem', label: 'Item' },
              { key: 'contractedRate', label: 'Contracted' },
              { key: 'recentInvoicedRate', label: 'Invoiced' },
              { key: 'deviationPct', label: 'Deviation', render: v => <span style={{ color: '#ef4444' }}>{v}</span> }
            ]} 
          />
        </div>

        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Penalty Clause Tracker</div>
          <DataGridViewer 
            rows={penaltyClauseTracker} 
            columns={[
              { key: 'clause', label: 'Clause' },
              { key: 'triggeredCount', label: 'Triggered' },
              { key: 'estRecoverable', label: 'Est. Recoverable', render: v => `$${v}` }
            ]} 
          />
        </div>
      </div>

    </motion.div>
  );
}
