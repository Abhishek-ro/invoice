import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function VendorTrendsTab({ data }) {
  const { compositeTrend, aiNarrative, recommendedActions, peerComparison } = data.trendsActions;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Composite Trend */}
        <div className="ir-card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>12-Month Composite Trend (Normalized 0-100)</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compositeTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="mismatchRateInverted" stroke="#ef4444" strokeWidth={3} name="Mismatch Quality (Inverted)" />
              <Line type="monotone" dataKey="onTimeDelivery" stroke="var(--primary-blue)" strokeWidth={3} name="On-Time Delivery" />
              <Line type="monotone" dataKey="contractCompliance" stroke="#10b981" strokeWidth={3} name="Contract Compliance" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Narrative & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="ir-card" style={{ padding: '1.5rem', background: 'var(--tint-success-bg)', border: '1px solid var(--tint-success-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#22c55e', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>AI Synthesized</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--tint-success-text)' }}>Vendor Narrative</div>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#15803d' }}>
              {aiNarrative}
            </div>
          </div>

          <div className="ir-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '1rem' }}>Recommended Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recommendedActions.map((action, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      background: action.priority === 'High' ? 'var(--tint-danger-bg)' : action.priority === 'Medium' ? 'var(--tint-warning-bg)' : 'var(--gray-100)',
                      color: action.priority === 'High' ? '#dc2626' : action.priority === 'Medium' ? '#d97706' : 'var(--gray-500)',
                      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 
                    }}>
                      {action.priority}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-800)' }}>{action.action}</div>
                  </div>
                  {action.actionable && (
                    <button style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-300)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      {action.actionType === 'draftEmail' ? 'Draft Email' : 'Go to Rules'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="ir-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>Peer Comparison (Health Score)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', fontSize: '12px', fontWeight: 600 }}>This Vendor</div>
                <div style={{ flex: 1, background: 'var(--gray-100)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${peerComparison.vendorHealthScore}%`, background: '#f59e0b', height: '100%' }} />
                </div>
                <div style={{ width: '30px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{peerComparison.vendorHealthScore}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)' }}>Category Average</div>
                <div style={{ flex: 1, background: 'var(--gray-100)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${peerComparison.categoryAvgHealthScore}%`, background: 'var(--gray-400)', height: '100%' }} />
                </div>
                <div style={{ width: '30px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)' }}>{peerComparison.categoryAvgHealthScore}</div>
              </div>

            </div>
          </div>

        </div>
      </div>

    </motion.div>
  );
}
