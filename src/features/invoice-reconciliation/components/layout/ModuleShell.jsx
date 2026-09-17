import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';

const ROUTE_META = {
  ''               : { breadcrumb: 'Dashboard' },
  'new'            : { breadcrumb: 'New Reconciliation' },
  'exceptions'     : { breadcrumb: 'Exceptions Queue' },
  'settings/rules' : { breadcrumb: 'Matching Rules' },
  'history'        : { breadcrumb: 'History' },
  'vendors'        : { breadcrumb: 'Vendors' },
  'vendors/new'    : { breadcrumb: 'New Vendor' },
  'duplicates'     : { breadcrumb: 'Duplicate Detection' },
  'analytics'      : { breadcrumb: 'Analytics & Reports' },
  'settings/erp'   : { breadcrumb: 'ERP Config' },
};

export default function ModuleShell() {
  const location = useLocation();

  // Derive breadcrumb from pathname
  const paths = location.pathname.split('/').filter(Boolean);
  const key = paths.length > 1 ? paths.slice(1).join('/') : '';
  const meta = ROUTE_META[key] || { breadcrumb: paths[1] || 'Dashboard' }; // e.g. INV-1001 falls through here

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
          <span style={{ color: 'var(--gray-900)' }}>{meta.breadcrumb}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gray-50)' }}>
        <Outlet />
      </div>
    </div>
  );
}
