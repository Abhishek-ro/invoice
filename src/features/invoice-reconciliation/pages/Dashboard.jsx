import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getDashboardKpis, getDashboardCharts, listReconciliations, ApiError } from '../api';
import StatusBadge from '../components/shared/StatusBadge';
import { DEMO_KPIS, DEMO_KPIS_PREV, DEMO_CHARTS, DEMO_ROWS, DEMO_TOTAL, DEMO_EXCEPTION_SPLIT } from '../data/demoDashboard';

// ---------------------------------------------------------------------
// Dashboard — stacked full-width sections, Zoho Books style.
//
// Layout is four sections down the page (summary → volume → exceptions +
// variance → recent table) rather than a KPI strip over a chart grid.
// The strip is gone on purpose: five cards in a `overflow-x: auto` flex
// row is what produced the stray horizontal scrollbar. Every row here is
// a CSS grid with `minmax(0, …)` tracks, so nothing can outgrow its
// container; the only element allowed to scroll sideways is the table's
// own wrapper.
//
// Data still comes from the real endpoints (04 §B.5.1 / §B.5.2 / §B.5.3).
// When the backend has nothing in the selected range — which is the
// normal state today, the store is in-memory and starts empty — the page
// falls back to data/demoDashboard.js so the screen is demo-ready
// instead of five zeroes and three empty charts. The fallback is
// labelled in the toolbar; it is never silent.
// ---------------------------------------------------------------------

const DATE_RANGES = {
  'Last 7 Days': () => rangeOfDays(7),
  'Last 30 Days': () => rangeOfDays(30),
  'This Quarter': () => ({ from: startOfQuarter(), to: today() }),
  'Year to Date': () => ({ from: startOfYear(), to: today() }),
};

// Below this many real records in the selected window, the page falls
// back to the demo set instead of rendering the real (but too-sparse-to-
// read) data. The backend ships with 4 seed reconciliations — enough to
// exercise the API, nowhere near enough to fill a 30-day volume chart or
// make the table look like a working system, so this has to be well
// above that seed count, not just above zero.
const MIN_REAL_ROWS = 20;

function today() { return new Date().toISOString().slice(0, 10); }
function iso(d) { return d.toISOString().slice(0, 10); }
function rangeOfDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return { from: iso(d), to: today() };
}
function startOfQuarter() {
  const d = new Date();
  d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  return iso(d);
}
function startOfYear() { return `${new Date().getFullYear()}-01-01`; }

/** The equally-long window ending the day before `from` — used only for the trend arrows. */
function previousWindow(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const prevTo = new Date(start);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: iso(prevFrom), to: iso(prevTo) };
}

// 04 §B.5.1 sends { value, unit }, never a formatted string. These are
// the only place that turns one into display text.
function fmtCurrency(n, { compactAt = Infinity } = {}) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= compactAt) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `${n < 0 ? '-' : ''}$${Math.round(abs).toLocaleString('en-US')}`;
}
function fmtKpi(kpi) {
  if (!kpi) return '—';
  switch (kpi.unit) {
    case 'currency': return fmtCurrency(kpi.value);
    case 'percent': return `${kpi.value}%`;
    case 'minutes': return `${kpi.value} min`;
    default: return kpi.value.toLocaleString('en-US');
  }
}

/**
 * Percentage change vs. the previous window, or percentage-*point* change
 * when the metric is itself a percentage. `goodWhen` decides the colour:
 * fewer exceptions is good, a bigger payable total is neither.
 */
function trendOf(current, previous, goodWhen) {
  if (!current || !previous || previous.value == null || previous.value === 0) return null;
  const diff = current.value - previous.value;
  const isPoints = current.unit === 'percent';
  const magnitude = isPoints ? Math.abs(diff) : Math.abs(diff / previous.value) * 100;
  if (magnitude < 0.5) return { tone: 'flat', caret: '', text: 'no change' };

  const up = diff > 0;
  const good = goodWhen === 'neutral' ? null : (goodWhen === 'up' ? up : !up);
  return {
    tone: good === null ? 'flat' : good ? 'pos' : 'neg',
    caret: up ? '▲' : '▼',
    text: isPoints
      ? `${Math.abs(diff).toFixed(1)} pts`
      : `${magnitude.toFixed(1)}%`,
  };
}

const STAGE_LABELS = {
  po_match: 'PO match',
  grn_match: 'GRN match',
  price_validation: 'Price validation',
  duplicate_scan: 'Duplicate suspected',
  decision: 'Decision',
};
const RAMP_VARS = ['--dash-ramp-1', '--dash-ramp-2', '--dash-ramp-3', '--dash-ramp-4', '--dash-ramp-5'];

const STATUS_FILTERS = {
  All: null,
  'Auto-approved': 'touchless_approved',
  'Needs review': 'human_review',
  Escalated: 'escalated',
  Rejected: 'rejected',
};

/**
 * Recharts writes colours as SVG attributes, where `var(--x)` isn't
 * reliably resolved — so read the palette off :root in JS instead and
 * re-read it when the theme toggle flips `data-theme`. Keeps the actual
 * colour values in the stylesheet where the rest of the theme lives.
 */
function useChartPalette() {
  const read = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
    return {
      bar: v('--dash-chart-bar', '#7d9ec4'),
      line: v('--dash-chart-line', '#8aa2bd'),
      lineFill: v('--dash-chart-line-fill', 'rgba(138,162,189,0.22)'),
      grid: v('--dash-grid', '#eef1f5'),
      axis: v('--dash-axis', '#9aa5b5'),
      ramp: RAMP_VARS.map((name, i) => v(name, ['#40628f', '#6285ae', '#8ba5c5', '#b2c3d6', '#d4dce6'][i])),
      confHigh: v('--dash-conf-high', '#6fa588'),
      confMid: v('--dash-conf-mid', '#cbab6a'),
      confLow: v('--dash-conf-low', '#c08a84'),
      surface: v('--primary-white', '#ffffff'),
    };
  }, []);

  const [palette, setPalette] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setPalette(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [read]);
  return palette;
}

function ChartTip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tip">
      <div className="dash-tip__label">{label}</div>
      <div className="dash-tip__val">{format(payload[0].value)}</div>
    </div>
  );
}

function Trend({ trend }) {
  if (!trend) return null;
  return (
    <span className={`dash-trend dash-trend--${trend.tone}`}>
      {trend.caret && <span className="dash-trend__caret">{trend.caret}</span>}
      {trend.text}
      <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>vs prev</span>
    </span>
  );
}

function SummaryCard({ label, value, trend, foot, loading }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat__label">{label}</div>
      <div className="dash-stat__figure">
        {loading
          ? <div className="dash-skeleton" style={{ width: 140, height: 31 }} />
          : <span className="dash-stat__value">{value}</span>}
        {!loading && <Trend trend={trend} />}
      </div>
      <div className="dash-stat__foot">
        {loading ? <div className="dash-skeleton" style={{ width: '70%', height: 13 }} /> : foot}
      </div>
    </div>
  );
}

function Section({ title, meta, action, flush, children }) {
  return (
    <section className="dash-section">
      <div className="dash-section__head">
        <span className="dash-section__title">{title}</span>
        {action || (meta && <span className="dash-section__meta">{meta}</span>)}
      </div>
      <div className={`dash-section__body${flush ? ' dash-section__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

function EmptyState({ title, hint }) {
  return (
    <div className="dash-empty">
      <div className="dash-empty__title">{title}</div>
      {hint && <div className="dash-empty__hint">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const palette = useChartPalette();

  const [rangeLabel, setRangeLabel] = useState('Last 30 Days');
  const [statusFilter, setStatusFilter] = useState('All');

  const [data, setData] = useState(null);   // { kpis, prevKpis, charts, rows, total, split }
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const demoPayload = useCallback(() => ({
    kpis: DEMO_KPIS,
    prevKpis: DEMO_KPIS_PREV,
    charts: DEMO_CHARTS,
    rows: DEMO_ROWS,
    total: DEMO_TOTAL,
    split: DEMO_EXCEPTION_SPLIT,
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { from, to } = DATE_RANGES[rangeLabel]();
    const prev = previousWindow(from, to);

    try {
      // Four GETs, one window each — the fourth is the same KPI endpoint
      // over the preceding window, which is where the trend arrows come
      // from (04 has no deltas in the KPI payload). 02 §10 wants these
      // sharing a cache entry with the sidebar badge; there's still no
      // query cache in this codebase, so they just re-fetch on range change.
      const [kpisRes, chartsRes, listRes, prevRes] = await Promise.all([
        getDashboardKpis({ date_from: from, date_to: to }),
        getDashboardCharts({ date_from: from, date_to: to }),
        listReconciliations({ date_from: from, date_to: to }),
        getDashboardKpis({ date_from: prev.from, date_to: prev.to }).catch(() => null),
      ]);

      const rows = listRes.rows ?? [];
      const total = listRes.total ?? rows.length;
      if (total < MIN_REAL_ROWS) {
        // Backend reachable but too thin for this window to read as a
        // working system (the seed set is 4 records) — show the demo
        // set rather than a chart with one bar in it.
        setData(demoPayload());
        setIsDemo(true);
      } else {
        setData({
          kpis: kpisRes.kpis,
          prevKpis: prevRes?.kpis ?? null,
          charts: chartsRes,
          rows,
          total: listRes.total ?? rows.length,
          split: {
            human_review: rows.filter((r) => r.status === 'human_review').length,
            escalated: rows.filter((r) => r.status === 'escalated').length,
          },
        });
        setIsDemo(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the reconciliation service.');
      setData(demoPayload());
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [rangeLabel, demoPayload]);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;
  const charts = data?.charts;
  const rows = data?.rows ?? [];

  const trends = useMemo(() => {
    const prev = data?.prevKpis;
    if (!kpis || !prev) return {};
    return {
      total_payable: trendOf(kpis.total_payable, prev.total_payable, 'neutral'),
      open_exceptions: trendOf(kpis.open_exceptions, prev.open_exceptions, 'down'),
      touchless_rate: trendOf(kpis.touchless_rate, prev.touchless_rate, 'up'),
    };
  }, [kpis, data?.prevKpis]);

  const breakdown = charts?.exception_breakdown ?? [];
  const breakdownTotal = breakdown.reduce((sum, e) => sum + e.count, 0);
  const sortedBreakdown = useMemo(
    () => [...breakdown].sort((a, b) => b.count - a.count),
    [breakdown],
  );

  const visibleRows = useMemo(() => {
    const wanted = STATUS_FILTERS[statusFilter];
    const list = wanted ? rows.filter((r) => r.status === wanted) : rows;
    return list.slice(0, 8);
  }, [rows, statusFilter]);

  const rangeMeta = rangeLabel.toLowerCase();

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title" style={{ fontSize: '20px' }}>Dashboard</h1>
        <div className="topbar__right">
          <button className="dash-ghost-btn" onClick={() => window.print()}>Export snapshot</button>
          <button className="ir-new-btn" onClick={() => navigate('/invoice-reconciliation/new')}>
            + New Reconciliation
          </button>
        </div>
      </header>

      <div className="dash-page">
        {error && <div className="dash-banner">{error} Showing sample data instead.</div>}

        {/* Toolbar — date range is the only surviving global filter (04 §B.5) */}
        <div className="dash-toolbar">
          <div className="dash-toolbar__left">
            <label className="dash-field-label" htmlFor="dash-range">Period</label>
            <select
              id="dash-range"
              className="dash-select"
              value={rangeLabel}
              onChange={(e) => setRangeLabel(e.target.value)}
            >
              {Object.keys(DATE_RANGES).map((label) => <option key={label}>{label}</option>)}
            </select>
          </div>
          <div className="dash-toolbar__right">
            {isDemo && !error && (
              <span className="dash-note">Sample data — no reconciliations recorded in this period yet.</span>
            )}
          </div>
        </div>

        {/* ── 1. Summary ─────────────────────────────── */}
        <div className="dash-summary">
          <SummaryCard
            loading={loading && !data}
            label="Total payable this period"
            value={fmtKpi(kpis?.total_payable)}
            trend={trends.total_payable}
            foot={<><b>{(data?.total ?? 0).toLocaleString('en-US')}</b> invoices reconciled · <b>{fmtKpi(kpis?.total_variance)}</b> net variance</>}
          />
          <SummaryCard
            loading={loading && !data}
            label="Exceptions"
            value={fmtKpi(kpis?.open_exceptions)}
            trend={trends.open_exceptions}
            foot={<><b>{data?.split?.human_review ?? 0}</b> awaiting review · <b>{data?.split?.escalated ?? 0}</b> escalated</>}
          />
          <SummaryCard
            loading={loading && !data}
            label="Touchless rate"
            value={fmtKpi(kpis?.touchless_rate)}
            trend={trends.touchless_rate}
            foot={<>Target <b>{kpis?.touchless_rate?.target ?? 85}%</b> · avg processing <b>{fmtKpi(kpis?.avg_processing_time)}</b></>}
          />
        </div>

        {/* ── 2. Processing volume ───────────────────── */}
        <Section title="Processing Volume" meta={`Reconciliations per day · ${rangeMeta}`}>
          {charts?.processing_volume?.length ? (
            <div className="dash-chart">
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <BarChart data={charts.processing_volume} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.grid} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                    tick={{ fontSize: 11, fill: palette.axis }}
                    tickFormatter={(d) => (d ? d.slice(5).replace('-', '/') : '')}
                  />
                  <YAxis axisLine={false} tickLine={false} width={44} tick={{ fontSize: 11, fill: palette.axis }} />
                  <Tooltip
                    cursor={{ fill: palette.grid }}
                    content={<ChartTip format={(v) => `${v} reconciliations`} />}
                  />
                  <Bar dataKey="count" fill={palette.bar} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No invoices processed in this period" hint="Pick a wider date range, or start a new reconciliation." />
          )}
        </Section>

        {/* ── 3. Exception breakdown + variance ──────── */}
        <div className="dash-row-2">
          <Section title="Exception Breakdown" meta={breakdownTotal ? `${breakdownTotal} open` : null}>
            {breakdown.length ? (
              <div className="dash-donut-wrap">
                <div className="dash-donut">
                  <ResponsiveContainer width="100%" height="100%" debounce={1}>
                    <PieChart>
                      <Pie
                        data={sortedBreakdown}
                        dataKey="count"
                        nameKey="stage_key"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={1.5}
                        stroke={palette.surface}
                        strokeWidth={2}
                      >
                        {sortedBreakdown.map((entry, i) => (
                          <Cell key={entry.stage_key} fill={palette.ramp[i % palette.ramp.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="dash-tip">
                              <div className="dash-tip__label">
                                {STAGE_LABELS[payload[0].payload.stage_key] || payload[0].payload.stage_key}
                              </div>
                              <div className="dash-tip__val">{payload[0].value} exceptions</div>
                            </div>
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dash-donut__center">
                    <div className="dash-donut__num">{breakdownTotal}</div>
                    <div className="dash-donut__cap">Open</div>
                  </div>
                </div>

                <div className="dash-legend">
                  {sortedBreakdown.map((e, i) => (
                    <div className="dash-legend__row" key={e.stage_key}>
                      <span
                        className="dash-legend__swatch"
                        style={{ background: palette.ramp[i % palette.ramp.length] }}
                      />
                      <span className="dash-legend__name">{STAGE_LABELS[e.stage_key] || e.stage_key}</span>
                      <span className="dash-legend__val">{e.count}</span>
                      <span className="dash-legend__pct">
                        {breakdownTotal ? Math.round((e.count / breakdownTotal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="No open exceptions" hint="Everything in this period matched inside tolerance." />
            )}
          </Section>

          <Section title="Variance Trend" meta={`Net variance per day · ${rangeMeta}`}>
            {charts?.variance_trend?.length ? (
              <div className="dash-chart dash-chart--short">
                <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <AreaChart data={charts.variance_trend} margin={{ top: 4, right: 8, bottom: 0, left: -4 }}>
                    <defs>
                      <linearGradient id="dashVarianceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.line} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={palette.line} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.grid} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                      tick={{ fontSize: 11, fill: palette.axis }}
                      tickFormatter={(d) => (d ? d.slice(5).replace('-', '/') : '')}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      tick={{ fontSize: 11, fill: palette.axis }}
                      tickFormatter={(v) => fmtCurrency(v, { compactAt: 1000 })}
                    />
                    <Tooltip content={<ChartTip format={(v) => fmtCurrency(v)} />} />
                    <ReferenceLine y={0} stroke={palette.axis} strokeOpacity={0.4} />
                    <Area
                      type="monotone"
                      dataKey="total_variance"
                      baseValue={0}
                      stroke={palette.line}
                      strokeWidth={1.8}
                      fill="url(#dashVarianceFill)"
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No variance recorded" hint="Nothing in this period fell outside tolerance." />
            )}
          </Section>
        </div>

        {/* ── 4. Recent reconciliations ──────────────── */}
        <Section
          title="Recent Reconciliations"
          flush
          action={
            <div className="dash-toolbar__right">
              <div className="dash-chips">
                {Object.keys(STATUS_FILTERS).map((f) => (
                  <button
                    key={f}
                    className={`dash-chip${statusFilter === f ? ' dash-chip--on' : ''}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button className="dash-ghost-btn" onClick={() => navigate('/invoice-reconciliation/history')}>
                View all
              </button>
            </div>
          }
        >
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/invoice-reconciliation/${r.id}`)}>
                    <td className="dash-table__id">{r.invoice_number}</td>
                    <td>{r.vendor_name}</td>
                    <td><StatusBadge status={r.status} compact /></td>
                    <td>
                      <div className="dash-conf">
                        <div className="dash-conf__track">
                          <div
                            className="dash-conf__fill"
                            style={{
                              width: `${Math.max(0, Math.min(100, r.confidence))}%`,
                              background: r.confidence >= 90 ? palette.confHigh
                                : r.confidence >= 60 ? palette.confMid
                                  : palette.confLow,
                            }}
                          />
                        </div>
                        <span className="dash-conf__num">{r.confidence}%</span>
                      </div>
                    </td>
                    <td className="dash-table__num">{fmtCurrency(r.invoice_total)}</td>
                    <td className="dash-table__muted">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="dash-table__act">
                      <button
                        className="dash-row-btn"
                        onClick={(e) => { e.stopPropagation(); navigate(`/invoice-reconciliation/${r.id}`); }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <EmptyState
                        title={statusFilter === 'All' ? 'No reconciliations in this period' : `No ${statusFilter.toLowerCase()} reconciliations`}
                        hint={statusFilter === 'All' ? 'Start one from the button above.' : 'Try a different filter.'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
