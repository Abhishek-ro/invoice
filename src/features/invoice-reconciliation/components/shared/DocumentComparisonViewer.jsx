import React from 'react';

export default function DocumentComparisonViewer({ docA, docB, type = 'invoice_vs_po' }) {
  // A mock representation of a document for side-by-side comparison.
  // In a real implementation, this would integrate react-pdf.
  
  const MockDocument = ({ title, data, highlightFields }) => (
    <div style={{ background: 'var(--primary-white)', border: '1px solid var(--gray-200)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--gray-50)', padding: '12px 16px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)' }}>{title}</span>
        <svg style={{ cursor: 'pointer', color: 'var(--gray-400)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      </div>
      <div style={{ padding: '24px', flex: 1, fontFamily: 'monospace', fontSize: '12px', color: 'var(--gray-800)', lineHeight: 1.6 }}>
        <div style={{ marginBottom: '24px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>{data.vendor}</div>
          <div style={{ color: 'var(--gray-500)' }}>Date: {data.date || '2026-06-18'}</div>
          <div style={{ color: 'var(--gray-500)' }}>Ref: {data.invoice_id || 'DOC-001'}</div>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--gray-500)' }}>LINE ITEMS</div>
          {data.lineItems?.map((li, i) => (
            <div key={i} style={{ 
              display: 'flex', justifyContent: 'space-between', padding: '4px 8px', marginBottom: '4px',
              borderLeft: highlightFields?.includes(`line_${i}`) ? '3px solid #f59e0b' : '3px solid transparent',
              background: highlightFields?.includes(`line_${i}`) ? 'var(--tint-escalated-bg)' : 'transparent'
            }}>
              <span>{li.desc} (x{li.qty})</span>
              <span>${li.price}</span>
            </div>
          ))}
        </div>
        
        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
          <span>TOTAL</span>
          <span>${data.amount}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%' }}>
      <MockDocument 
        title={type === 'invoice_vs_po' ? 'Supplier Invoice' : 'Invoice A'}
        data={docA || { vendor: 'Global Supplies Ltd', amount: '1,053.45', lineItems: [{desc: 'Office Chairs', qty: 100, price: '61.50'}] }}
        highlightFields={['line_0']}
      />
      <MockDocument 
        title={type === 'invoice_vs_po' ? 'Internal Purchase Order' : 'Invoice B'}
        data={docB || { vendor: 'Global Supplies Ltd', amount: '1,053.00', lineItems: [{desc: 'Office Chairs', qty: 100, price: '61.05'}] }}
        highlightFields={['line_0']}
      />
    </div>
  );
}
