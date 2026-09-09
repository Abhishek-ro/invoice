import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ComposedChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getDashboardKpis, getDashboardCharts, listReconciliations, ApiError } from '../api';
import StatusBadge from '../components/shared/StatusBadge';

// TODO(04 §D "Three gaps" + §B.5 intro): "Dashboard View" (CFO/Procurement/
// Internal Audit) and "Region" selectors are cut from v1 — 04 says so
// explicitly ("Date Range is the only surviving filter"). Both dropdowns
// had no onChange handler in the original mock either, so nothing
// functional is being removed here, just the dead controls themselves.
// Pipeline Status and Top Vendor Risk are also gone for the same reason
// (§B.5 intro: "no data source, hidden in v1"; topVendorRisk was never in
// any 04 endpoint at all).
const DATE_RANGES = {
  'Last 7 Days': () => ({ from: daysAgo(6), to: today() }),
  'Last 30 Days': () => ({ from: daysAgo(29), to: today() }),
  'This Quarter': () => ({ from: startOfQuarter(), to: today() }),
  'Year to Date': () => ({ from: startOfYear(), to: today() }),
};

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function startOfQuarter() { const d = new Date(); d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1); return d.toISOString().slice(0, 10); }
function startOfYear() { const d = new Date(); return `${d.getFullYear()}-01-01`; }

// 04 §B.5.1 requires numbers + a unit, never a formatted string — these
// two functions are the ONE place that turns { value, unit } into
// display text, per the api/dashboard.js comment.
function formatKpiValue(kpi) {
  if (!kpi) return '—';
  switch (kpi.unit) {
    case 'currency': return `$${kpi.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case 'percent': return `${kpi.value}%`;
    case 'minutes': return `${kpi.value} min`;
    default: return `${kpi.value}`;
  }
}
function formatKpiTarget(kpi) {
  if (!kpi?.target) return null;
  const arrow = kpi.target_direction === 'at_least' ? '↑' : '↓';
  const suffix = kpi.unit === 'percent' ? '%' : kpi.unit === 'minutes' ? ' min' : '';
  return `${arrow} ${kpi.target}${suffix}`;
}

const STAGE_LABELS = { po_match: 'PO Match', grn_match: 'GRN Match', price_validation: 'Price Validation', duplicate_scan: 'Duplicate Suspected', decision: 'Decision' };
const STAGE_COLORS = { po_match: '#3b82f6', grn_match: '#f59e0b', price_validation: '#ef4444', duplicate_scan: '#8b5cf6', decision: '#64748b' };

const STATUS_FILTER_MAP = { 'All': null, 'Auto-Approved': 'touchless_approved', 'Human Review': 'human_review', 'Rejected': 'rejected' };

export default function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [dateRangeLabel, setDateRangeLabel] = useState('This Quarter');

  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recentRows, setRecentRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { from, to } = DATE_RANGES[dateRangeLabel]();
    try {
      // TODO(04 §B.5.1 / §B.5.2 / §B.5.3): three independent GETs, same
      // date_from/date_to. 02 §10 wants these sharing one query-key/cache
      // entry with the sidebar badge and Exceptions header — not done
      // here since there's no cache layer (TanStack Query etc.) in this
      // codebase yet; each call just re-fetches on date-range change.
      const [kpisRes, chartsRes, recentRes] = await Promise.all([
        getDashboardKpis({ date_from: from, date_to: to }),
        getDashboardCharts({ date_from: from, date_to: to }),
        listReconciliations({ date_from: from, date_to: to }),
      ]);
      setKpis(kpisRes.kpis);
      setCharts(chartsRes);
      setRecentRows(recentRes.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [dateRangeLabel]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'All' ? recentRows : recentRows.filter(r => r.status === STATUS_FILTER_MAP[filter]);

  const KPI_LIST = kpis ? [
    { label: 'Total Payable This Period', kpi: kpis.total_payable, icon: 0 },
    { label: 'Touchless Rate', kpi: kpis.touchless_rate, icon: 1 },
    { label: 'Avg Processing Time', kpi: kpis.avg_processing_time, icon: 2 },
    { label: 'Open Exceptions', kpi: kpis.open_exceptions, icon: 3 },
    { label: 'Total Variance', kpi: kpis.total_variance, icon: 4 },
  ] : [];
  const KPI_ICONS = [
    <svg key="1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>,
    <svg key="2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    <svg key="3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"></circle><polyline points="12 9 12 13 14 15"></polyline><line x1="12" y1="2" x2="12" y2="4"></line></svg>,
    <svg key="4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    <svg key="5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title" style={{ fontSize: '20px' }}>Dashboard Overview</h1>
        </div>
        <div className="topbar__right" style={{ gap: '1rem' }}>
          <button className="ir-link-btn" style={{ padding: '8px 16px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px' }} onClick={() => window.print()}>
            Export Snapshot
          </button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="ir-new-btn" onClick={() => navigate('/invoice-reconciliation/new')}>
            + New Reconciliation
          </motion.button>
        </div>
      </header>

      <div className="ud-content" style={{ paddingBottom: '3rem' }}>

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-text)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '13px', fontWeight: 600 }}>⚠ {error}</div>
        )}

        {/* Global Filters — Date Range only, per 04 §B.5 */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-600)' }}>Date Range:</label>
            <select value={dateRangeLabel} onChange={e => setDateRangeLabel(e.target.value)} style={{ padding: '6px 12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer', background: 'var(--primary-white)', color: 'var(--gray-900)' }}>
              {Object.keys(DATE_RANGES).map(label => <option key={label}>{label}</option>)}
            </select>
          </div>
        </div>

        {/* KPI Strip — 5 KPIs per 04 §B.5.1, not 8; the rest had no endpoint */}
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {loading && !kpis ? (
            <div style={{ padding: '2rem', color: 'var(--gray-400)' }}>Loading KPIs…</div>
          ) : KPI_LIST.map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="ir-kpi-card" style={{ minWidth: '220px', flex: '0 0 auto' }}>
              <div className="ir-kpi-icon">{KPI_ICONS[k.icon]}</div>
              <div className="ir-kpi-val" style={{ color: k.label.includes('Variance') ? '#dc2626' : 'inherit' }}>{formatKpiValue(k.kpi)}</div>
              <div className="ir-kpi-lbl">{k.label}</div>
              {formatKpiTarget(k.kpi) && <div className="ir-kpi-target">{formatKpiTarget(k.kpi)}</div>}
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: 'auto auto', gap: '1.5rem', marginBottom: '2rem' }}>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="ir-card" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
            <div className="ir-card-head"><span className="ir-card-title">Processing Volume</span></div>
            <div style={{ flex: 1, minHeight: 0, padding: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={charts?.processing_volume ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-500)' }} tickFormatter={d => d?.slice(5)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--primary-white)', color: 'var(--gray-800)' }} />
                  <Bar dataKey="count" fill="var(--primary-blue)" radius={[4, 4, 0, 0]} barSize={32} name="Reconciliations" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="ir-card" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
            <div className="ir-card-head"><span className="ir-card-title">Exception Breakdown</span></div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts?.exception_breakdown ?? []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="stage_key">
                    {(charts?.exception_breakdown ?? []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage_key] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [value, STAGE_LABELS[props.payload.stage_key] || props.payload.stage_key]} contentStyle={{ background: 'var(--primary-white)', color: 'var(--gray-800)', border: '1px solid var(--gray-200)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-800)' }}>{kpis?.open_exceptions.value ?? '—'}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Open</div>
              </div>
            </div>
            <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {(charts?.exception_breakdown ?? []).map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--gray-600)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[e.stage_key] || '#94a3b8' }} /> {STAGE_LABELS[e.stage_key] || e.stage_key}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="ir-card" style={{ gridColumn: '1 / -1', height: '280px', display: 'flex', flexDirection: 'column' }}>
            <div className="ir-card-head"><span className="ir-card-title">Variance Trend Over Time</span></div>
            <div style={{ flex: 1, minHeight: 0, padding: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts?.variance_trend ?? []}>
                  <defs>
                    <linearGradient id="colorVar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} tickFormatter={d => d?.slice(5)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip formatter={(value) => `$${value}`} contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--primary-white)', color: 'var(--gray-800)' }} />
                  <ReferenceLine y={0} stroke="var(--gray-400)" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="total_variance" stroke="#ef4444" fillOpacity={1} fill="url(#colorVar)" name="Total Variance" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Recent table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="ir-card">
          <div className="ir-card-head">
            <span className="ir-card-title">Recent Reconciliations</span>
            <button className="ir-link-btn" onClick={() => navigate('/invoice-reconciliation/history')}>View All →</button>
          </div>

          <div className="ir-filter-row">
            {Object.keys(STATUS_FILTER_MAP).map(f => (
              <div key={f} onClick={() => setFilter(f)} className={`ir-filter-chip ${filter === f ? 'ir-filter-active' : ''}`} style={{ cursor: 'pointer' }}>
                {f}
              </div>
            ))}
          </div>

          <table className="ir-table">
            <thead>
              <tr>
                <th>INVOICE ID</th>
                <th>VENDOR</th>
                <th>STATUS</th>
                <th>CONFIDENCE</th>
                <th>AMOUNT</th>
                <th>DATE CREATED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + (i * 0.05) }} key={r.id} onClick={() => navigate(`/invoice-reconciliation/${r.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="ir-td-id">{r.invoice_number}</td>
                  <td>{r.vendor_name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, background: 'var(--gray-200)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${r.confidence}%`, height: '100%', background: r.confidence >= 90 ? '#10b981' : r.confidence >= 60 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-600)', width: '30px' }}>{r.confidence}%</span>
                    </div>
                  </td>
                  <td className="ir-td-amt">${r.invoice_total.toLocaleString()}</td>
                  <td className="ir-td-date">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>
                    <button className="ir-row-btn" onClick={e => { e.stopPropagation(); navigate(`/invoice-reconciliation/${r.id}`); }}>
                      Review
                    </button>
                  </td>
                </motion.tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>No reconciliations in this range.</td></tr>
              )}
            </tbody>
          </table>
        </motion.div>
      </div>
    </>
  );
}
