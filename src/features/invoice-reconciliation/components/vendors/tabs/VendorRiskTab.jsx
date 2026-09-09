import React from 'react';
import { motion } from 'framer-motion';
import KpiTileAnimated from '../../analytics/KpiTileAnimated';
import DataGridViewer from '../../shared/DataGridViewer';
import ActivityTimeline from '../../shared/ActivityTimeline';

export default function VendorRiskTab({ data }) {
  const { kpis, riskSignals, anomalyTimeline, duplicateAttemptHistory } = data.riskFraud;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <KpiTileAnimated label="Overall Risk Score" value={kpis.overallRiskScore} suffix="/100" />
        <KpiTileAnimated label="Duplicate Attempts" value={kpis.duplicateAttemptsLifetime} deltaIsGood={false} />
        <KpiTileAnimated label="Bank Detail Changes" value={kpis.bankDetailChangeEvents} />
        <KpiTileAnimated label="Anomaly Alerts (Open)" value={kpis.anomalyAlertsOpen} deltaIsGood={false} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        
        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1.5rem' }}>Risk Signal Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {riskSignals.map((sig, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', marginTop: '4px', background: sig.status === 'red' ? '#ef4444' : sig.status === 'amber' ? '#f59e0b' : '#10b981' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-800)' }}>{sig.signal}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>{sig.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ir-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1.5rem' }}>Anomaly Event Timeline</div>
          <ActivityTimeline 
            entries={anomalyTimeline.map(e => ({
              id: Math.random(),
              actor: 'system',
              action: e.event,
              timestamp: e.timestamp,
              severity: e.severity
            }))}
          />
        </div>

      </div>

      <div className="ir-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Duplicate Attempt History</div>
        <DataGridViewer 
          rows={duplicateAttemptHistory} 
          columns={[
            { key: 'invoiceA', label: 'Target Invoice' },
            { key: 'invoiceB', label: 'Suspected Duplicate' },
            { key: 'similarity', label: 'Similarity', render: v => <span style={{ color: '#ef4444', fontWeight: 600 }}>{v}%</span> },
            { key: 'date', label: 'Detection Date' },
            { key: 'outcome', label: 'Outcome', render: v => <span style={{ background: 'var(--tint-success-bg)', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{v}</span> }
          ]} 
        />
      </div>

    </motion.div>
  );
}
