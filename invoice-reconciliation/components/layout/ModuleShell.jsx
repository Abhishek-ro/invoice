import React from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';

export default function ModuleShell() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive breadcrumb from pathname
  const paths = location.pathname.split('/').filter(Boolean);
  let breadcrumb = 'Dashboard';
  if (paths.length > 1) {
    if (paths[1] === 'new') breadcrumb = 'New Reconciliation';
    else if (paths[1] === 'history') breadcrumb = 'History';
    else if (paths[1] === 'exceptions') breadcrumb = 'Exceptions Queue';
    else if (paths[1] === 'vendors') breadcrumb = 'Vendor Intelligence';
    else if (paths[1] === 'duplicates') breadcrumb = 'Duplicate Detection';
    else if (paths[1] === 'analytics') breadcrumb = 'Analytics & Reports';
    else if (paths[1] === 'settings' && paths[2] === 'rules') breadcrumb = 'Matching Rules';
    else breadcrumb = paths[1]; // e.g. INV-1001
  }

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value;
      if (q) navigate(`/invoice-reconciliation/history?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Sticky Sub-header */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '12px 24px', background: 'var(--primary-white)', borderBottom: '1px solid var(--gray-200)',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Invoice Reconciliation</span>
          <span style={{ color: 'var(--gray-300)' }}>/</span>
          <span style={{ color: 'var(--gray-900)' }}>{breadcrumb}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Search invoices, vendors, POs..." 
              onKeyDown={handleSearch}
              style={{
                padding: '6px 12px 6px 32px', borderRadius: '6px', border: '1px solid var(--gray-300)',
                fontSize: '13px', width: '250px', outline: 'none',
                background: 'var(--primary-white)', color: 'var(--gray-900)'
              }}
            />
          </div>
          <span style={{
            background: 'var(--tint-escalated-bg)', color: 'var(--tint-escalated-text)', border: '1px solid var(--tint-escalated-border)',
            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px'
          }}>
            Demo Data
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gray-50)' }}>
        <Outlet />
      </div>
    </div>
  );
}
