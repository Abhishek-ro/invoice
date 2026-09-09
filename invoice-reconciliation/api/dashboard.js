// 04-API-CONTRACT.md §B.5.1 / §B.5.3
import { request } from './apiClient';

/** { value, unit } shape per KPI — never a pre-formatted string. Format in the component, not here. */
export function getDashboardKpis({ date_from, date_to } = {}) {
  return request('/dashboard/kpis', { query: { date_from, date_to } });
}

/** processing_volume / exception_breakdown / variance_trend, one request (§B.5.3). */
export function getDashboardCharts({ date_from, date_to } = {}) {
  return request('/dashboard/charts', { query: { date_from, date_to } });
}
