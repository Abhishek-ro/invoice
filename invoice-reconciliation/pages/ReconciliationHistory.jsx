import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReconciliations, ApiError } from '../api';
import StatusBadge from '../components/shared/StatusBadge';
import DataGridViewer from '../components/shared/DataGridViewer';

// TODO(04 §B.5.2): status filter now covers all 5 values from §C's status
// enum (StatusBadge already had labels for all 5 — the original dropdown
// only wired 3 of them, silently hiding escalated/duplicate_flagged rows
// from anything but "All Statuses").
const STATUS_FILTER_MAP = {
  'All Statuses': null,
  'Auto-Approved': 'touchless_approved',
  'Human Review': 'human_review',
  'Escalated': 'escalated',
  'Duplicate Flagged': 'duplicate_flagged',
  'Rejected': 'rejected',
};

export default function ReconciliationHistory() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All Statuses');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Status filtering is server-side (§B.5.2 accepts a `status` param).
      // Free-text vendor/id search has no equivalent query param in 04 —
      // it's applied client-side below, same as the original mock did.
      const status = STATUS_FILTER_MAP[filter];
      const res = await listReconciliations(status ? { status } : {});
      setRows(res.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load reconciliation history.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  let filtered = rows;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => r.vendor_name.toLowerCase().includes(q) || r.invoice_number.toLowerCase().includes(q));
  }

  const columns = [
    { key: 'invoice_number', label: 'ID', render: (val) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{val}</span> },
    { key: 'vendor_name', label: 'VENDOR' },
    { key: 'status', label: 'STATUS', render: (val) => <StatusBadge status={val} /> },
    { key: 'confidence', label: 'CONFIDENCE', render: (val) => <span style={{ fontWeight: 600, color: val > 90 ? '#10b981' : val > 60 ? '#f59e0b' : '#ef4444' }}>{val}%</span> },
    { key: 'invoice_total', label: 'AMOUNT', render: (val) => `$${val.toLocaleString()}` },
    { key: 'created_at', label: 'CREATED DATE', render: (val) => new Date(val).toLocaleDateString() },
    // TODO(04 §B.5.2 toListRow): was `row._id`, a field that doesn't exist
    // anywhere in the contract (rows only ever carry `id`) — this button
    // was silently navigating to `/invoice-reconciliation/undefined`.
    { key: 'action', label: 'ACTION', sortable: false, render: (val, row) => <button className="ir-row-btn" onClick={() => navigate(`/invoice-reconciliation/${row.id}`)}>Review</button> }
  ];

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title">Reconciliation History</h1>
      </header>

      <div className="ud-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-text)', borderRadius: '8px', marginBottom: '1rem', fontSize: '13px', fontWeight: 600 }}>⚠ {error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search Vendor or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', width: '250px', outline: 'none' }}
            />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', background: 'var(--primary-white)', outline: 'none' }}
            >
              {Object.keys(STATUS_FILTER_MAP).map(label => <option key={label} value={label}>{label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* TODO(04): saved views aren't in the contract anywhere — this
                stays an inert placeholder exactly as in the original mock. */}
            <select style={{ padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', background: 'var(--gray-50)', fontWeight: 600, color: 'var(--gray-600)', outline: 'none' }}>
              <option>Saved View: Default</option>
              <option>This Week's Rejections</option>
            </select>
            {/* Export and Column Toggle are handled by DataGridViewer */}
          </div>
        </div>

        <div className="ir-card" style={{ flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
          {loading && rows.length === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--gray-400)', textAlign: 'center' }}>Loading history…</div>
          ) : (
            <DataGridViewer columns={columns} rows={filtered} enableExport={true} enableColumnToggle={true} filename="History_Export.xlsx" />
          )}
        </div>

      </div>
    </>
  );
}
