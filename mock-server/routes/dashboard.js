import { Router } from 'express';
import { reconciliations } from '../lib/db.js';
import { deriveReason, inDateRange } from '../lib/derive.js';

const router = Router();

function filterByRange(rows, date_from, date_to) {
  if (!date_from && !date_to) return rows;
  return rows.filter((r) => inDateRange(r.created_at, date_from, date_to));
}

// §B.5.1 GET /dashboard/kpis — { value, unit } shape, numbers only, no
// pre-formatted strings (02 §3e, restated in 04 §B.5.1).
router.get('/dashboard/kpis', (req, res) => {
  const { date_from, date_to } = req.query;
  const rows = filterByRange([...reconciliations.values()], date_from, date_to);

  const total_payable = round2(sum(rows, (r) => r.expected_payable));
  const total_variance = round2(sum(rows, (r) => r.total_variance));
  const open_exceptions = rows.filter((r) => ['human_review', 'escalated'].includes(r.status)).length;

  // touchless_rate: touchless_approved status AND no audit_log row with
  // kind='decision' — a human approval also writes touchless_approved
  // (§C note 1), so counting the status alone would inflate this.
  const touchlessCount = rows.filter(
    (r) => r.status === 'touchless_approved' && !r.audit_log.some((a) => a.kind === 'decision')
  ).length;
  const touchless_rate = rows.length ? round1((touchlessCount / rows.length) * 100) : 0;

  const withMatchedAt = rows.filter((r) => r.matched_at);
  const avg_processing_time = withMatchedAt.length
    ? round1(
        sum(withMatchedAt, (r) => (new Date(r.matched_at) - new Date(r.created_at)) / 60000) / withMatchedAt.length
      )
    : 0;

  res.status(200).json({
    kpis: {
      total_payable: { value: total_payable, unit: 'currency' },
      touchless_rate: { value: touchless_rate, unit: 'percent', target: 85, target_direction: 'at_least' },
      avg_processing_time: { value: avg_processing_time, unit: 'minutes', target: 2, target_direction: 'at_most' },
      open_exceptions: { value: open_exceptions, unit: 'count' },
      total_variance: { value: total_variance, unit: 'currency' },
    },
    date_from: date_from ?? null,
    date_to: date_to ?? null,
  });
});

// §B.5.3 GET /dashboard/charts — buckets are daily, empty days omitted.
router.get('/dashboard/charts', (req, res) => {
  const { date_from, date_to } = req.query;
  const rows = filterByRange([...reconciliations.values()], date_from, date_to);

  const byDay = (getValue) => {
    const map = new Map();
    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      map.set(day, (map.get(day) || 0) + getValue(r));
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, value]) => ({ date, value }));
  };

  const processing_volume = byDay(() => 1).map(({ date, value }) => ({ date, count: value }));
  const variance_trend = byDay((r) => r.total_variance).map(({ date, value }) => ({ date, total_variance: round2(value) }));

  // Same population as GET /exceptions (human_review + escalated) AND the
  // same reason derivation (lib/derive.js) — 04 §B.5.3 requires both to
  // match or "the chart and the filter chips can't disagree" breaks.
  const breakdownMap = new Map();
  for (const r of rows.filter((r) => ['human_review', 'escalated'].includes(r.status))) {
    const reason = deriveReason(r);
    if (!reason) continue;
    breakdownMap.set(reason.stage_key, (breakdownMap.get(reason.stage_key) || 0) + 1);
  }
  const exception_breakdown = [...breakdownMap.entries()].map(([stage_key, count]) => ({ stage_key, count }));

  res.status(200).json({ processing_volume, exception_breakdown, variance_trend, date_from: date_from ?? null, date_to: date_to ?? null });
});

function sum(rows, fn) {
  return rows.reduce((acc, r) => acc + (fn(r) || 0), 0);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

export default router;
