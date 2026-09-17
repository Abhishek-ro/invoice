import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendors } from '../../context/VendorContext';
import { usePendingExceptionsCount } from '../../hooks/usePendingExceptionsCount';
import { ACTOR } from '../../api';

function initials(name) {
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function GlobalTopNav() {
  const navigate = useNavigate();
  const { vendors } = useVendors();
  const pendingExceptions = usePendingExceptionsCount();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? vendors.filter((v) => v.name.toLowerCase().includes(q) || v.vendorId.toLowerCase().includes(q)).slice(0, 6)
    : [];

  const goToVendor = (v) => {
    navigate(`/invoice-reconciliation/vendors/${v.vendorId}`);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && matches.length > 0) {
      goToVendor(matches[0]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <header className="ir-topnav">
      <button className="ir-topnav-brand" onClick={() => navigate('/invoice-reconciliation')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="m9 15 2 2 4-4" />
        </svg>
        <span>Invoice Reconciliation</span>
      </button>

      <div className="ir-topnav-search-wrap">
        <div className="ir-search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Search vendors ( / )"
          />
        </div>
        {open && q && (
          <div className="ir-search-dropdown">
            {matches.length === 0 ? (
              <div className="ir-search-dropdown-empty">No vendors match "{query}"</div>
            ) : matches.map((v) => (
              <div key={v.vendorId} className="ir-search-dropdown-item" onMouseDown={() => goToVendor(v)}>
                <span className="ir-search-dropdown-name">{v.name}</span>
                <span className="ir-search-dropdown-id">{v.vendorId}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ir-topnav-spacer" />

      <div className="ir-topnav-actions">
        <button className="ir-topnav-create-btn" title="New Reconciliation" aria-label="New Reconciliation" onClick={() => navigate('/invoice-reconciliation/new')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>

        <button className="ir-topnav-icon-btn" title="Exceptions Queue" aria-label="Exceptions Queue" onClick={() => navigate('/invoice-reconciliation/exceptions')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {pendingExceptions != null && pendingExceptions > 0 && (
            <span className="ir-topnav-badge">{pendingExceptions}</span>
          )}
        </button>

        <button className="ir-topnav-icon-btn" title="Matching Rules" aria-label="Matching Rules" onClick={() => navigate('/invoice-reconciliation/settings/rules')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <div className="ir-topnav-avatar" title={ACTOR.name}>{initials(ACTOR.name)}</div>
      </div>
    </header>
  );
}
