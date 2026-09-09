import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/invoice-reconciliation',            end: true, label: 'Dashboard',             badge: null },
  { to: '/invoice-reconciliation/new',                   label: 'New Reconciliation',    badge: null },
  { to: '/invoice-reconciliation/history',               label: 'History',                badge: null },
  { to: '/invoice-reconciliation/exceptions',            label: 'Exceptions Queue',       badge: 4    },
  { to: '/invoice-reconciliation/vendors',               label: 'Vendor Intelligence',    badge: null },
  { to: '/invoice-reconciliation/duplicates',            label: 'Duplicate Detection',    badge: 1    },
  { to: '/invoice-reconciliation/analytics',             label: 'Analytics & Reports',    badge: null },
  { to: '/invoice-reconciliation/settings/rules',        label: 'Matching Rules',         badge: null },
  { to: '/invoice-reconciliation/settings/erp',          label: 'ERP Config',             badge: null },
];

export default function IRSidebar() {
  const navigate = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar__home-container">
        <button
          onClick={() => navigate('/dashboard')}
          className="sidebar__home-btn"
          style={{ background: 'none', border: '1px solid var(--gray-200)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      <div className="sidebar__section-heading">
        <span>INVOICE RECONCILIATION</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className="sidebar__item-dot">
              <svg width="8" height="8" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="3.5" stroke="var(--gray-300)" fill="none" />
              </svg>
            </span>
            <span className="sidebar__item-label">{item.label}</span>
            {item.badge != null && (
              <span className="sidebar__item-count" style={{ background: '#ef4444', color: 'white', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, marginLeft: 'auto' }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
