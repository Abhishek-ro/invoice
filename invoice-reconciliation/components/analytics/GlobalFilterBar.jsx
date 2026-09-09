import React, { useState } from 'react';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';

export default function GlobalFilterBar() {
  const { filters, updateFilter, clearFilters, savedViews, saveView, loadView } = useAnalyticsFilters();
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewName, setViewName] = useState('');

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'dateRange' && v !== 'This Quarter') return true;
    if (k === 'currency' && v !== 'All') return true;
    if (Array.isArray(v) && v.length > 0) return true;
    return false;
  }).length;

  const handleSaveView = () => {
    if (viewName) {
      saveView(viewName);
      setViewName('');
    }
  };

  return (
    <div style={{ background: 'var(--primary-white)', borderBottom: '1px solid var(--gray-200)', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'var(--gray-50)', color: 'var(--gray-800)', border: '1px solid var(--gray-300)', padding: '8px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Filters
            {activeFilterCount > 0 && <span style={{ background: 'var(--primary-blue)', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '11px' }}>{activeFilterCount}</span>}
          </button>
          
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Clear All</button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {savedViews.length > 0 && (
            <select onChange={(e) => {
              const view = savedViews.find(v => v.name === e.target.value);
              if (view) loadView(view);
            }} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px', outline: 'none', background: 'var(--primary-white)', color: 'var(--gray-800)' }}>
              <option value="">Load Saved View...</option>
              {savedViews.map((v, i) => <option key={i} value={v.name}>{v.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--gray-50)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '4px' }}>Date Range</label>
            <select value={filters.dateRange} onChange={e => updateFilter('dateRange', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--gray-300)', fontSize: '13px', background: 'var(--primary-white)', color: 'var(--gray-800)' }}>
              <option>Today</option><option>Last 7 Days</option><option>Last 30 Days</option><option>This Quarter</option><option>This Year</option>
            </select>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '8px' }}>Status (Demo)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'touchless', label: 'Touchless' },
                { id: 'human', label: 'Human Review' },
                { id: 'escalated', label: 'Escalated' },
                { id: 'rejected', label: 'Rejected' }
              ].map(st => {
                const isActive = filters.status.includes(st.id);
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      const next = isActive ? filters.status.filter(x => x !== st.id) : [...filters.status, st.id];
                      updateFilter('status', next);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--primary-blue)' : '1px solid var(--gray-300)',
                      background: isActive ? 'var(--primary-50)' : 'white',
                      color: isActive ? 'var(--primary-blue-dark)' : 'var(--gray-500)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {st.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '4px' }}>Currency</label>
            <select value={filters.currency} onChange={e => updateFilter('currency', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--gray-300)', fontSize: '13px', background: 'var(--primary-white)', color: 'var(--gray-800)' }}>
              <option>All</option><option>USD</option><option>EUR</option><option>INR</option><option>GBP</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
             <input type="text" placeholder="View Name" value={viewName} onChange={e => setViewName(e.target.value)} style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '4px', fontSize: '13px', background: 'var(--primary-white)', color: 'var(--gray-800)' }} />
             <button onClick={handleSaveView} style={{ padding: '8px 12px', background: 'var(--primary-blue)', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Save View</button>
          </div>
        </div>
      )}
    </div>
  );
}
