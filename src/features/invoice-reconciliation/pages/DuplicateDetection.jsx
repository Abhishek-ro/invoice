import React, { useState } from 'react';
import { MOCK_DUPLICATES } from '../data/mockData';
import DocumentComparisonViewer from '../components/shared/DocumentComparisonViewer';

export default function DuplicateDetection() {
  const d = MOCK_DUPLICATES;
  const [expandedRow, setExpandedRow] = useState(d.flaggedPairs[0].id);

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 className="topbar__title">Duplicate Detection Center</h1>
          <span style={{ background: 'var(--tint-purple-bg)', color: 'var(--tint-purple-text)', border: '1px solid var(--tint-purple-border)', padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
            {d.flaggedPairs.length} Suspected
          </span>
        </div>
      </header>

      <div className="ud-content" style={{ paddingBottom: '3rem' }}>
        
        {/* Summary Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="ir-kpi-card">
            <div className="ir-kpi-val" style={{ color: '#10b981' }}>{d.summary.exactMatchesBlocked}</div>
            <div className="ir-kpi-lbl">Exact Matches Blocked</div>
          </div>
          <div className="ir-kpi-card">
            <div className="ir-kpi-val" style={{ color: '#f59e0b' }}>{d.summary.fuzzyMatchesFlagged}</div>
            <div className="ir-kpi-lbl">Fuzzy Matches Flagged</div>
          </div>
          <div className="ir-kpi-card">
            <div className="ir-kpi-val" style={{ color: 'var(--primary-blue)' }}>{d.summary.estSaved}</div>
            <div className="ir-kpi-lbl">Est. $ Saved from Blocked Duplicates</div>
          </div>
        </div>

        {/* Flagged Pairs List */}
        <div className="ir-card" style={{ padding: 0 }}>
          <div className="ir-card-head" style={{ padding: '1rem 1.5rem' }}><span className="ir-card-title">Flagged Pairs</span></div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {d.flaggedPairs.map(pair => (
              <div key={pair.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                {/* Row Header */}
                <div 
                  onClick={() => setExpandedRow(expandedRow === pair.id ? null : pair.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', cursor: 'pointer', background: expandedRow === pair.id ? 'var(--gray-50)' : 'white' }}
                >
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={expandedRow === pair.id ? "var(--primary-blue)" : "var(--gray-400)"} strokeWidth="2"><path d={expandedRow === pair.id ? "M6 9l6 6 6-6" : "M9 18l6-6-6-6"} /></svg>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-800)' }}>{pair.id}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--gray-600)' }}>{pair.invoiceA.invoice_id}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
                      <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--gray-600)' }}>{pair.invoiceB.invoice_id}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{pair.invoiceA.vendor} • ${pair.invoiceA.amount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tint-escalated-text)', background: 'var(--tint-warning-bg)', padding: '2px 8px', borderRadius: '12px' }}>{pair.matchType.split('—')[0]}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: pair.similarity > 90 ? '#ef4444' : '#f59e0b' }}>{pair.similarity}% Match</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Comparison */}
                {expandedRow === pair.id && (
                  <div style={{ padding: '24px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--gray-600)', fontStyle: 'italic' }}>Reason: {pair.matchType}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ padding: '8px 16px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)', cursor: 'pointer' }}>Not a Duplicate</button>
                        <button style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Confirm Duplicate (Reject Invoice B)</button>
                      </div>
                    </div>
                    
                    <div style={{ height: '400px' }}>
                      <DocumentComparisonViewer 
                        type="invoice_vs_invoice" 
                        docA={pair.invoiceA} 
                        docB={pair.invoiceB} 
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
