// 04-API-CONTRACT.md §B.4.1 — there is no exceptions table, this is a query.
import { request } from './apiClient';

/**
 * @param {{ status?: 'human_review'|'escalated', reason_stage_key?: string, limit?: number, offset?: number }} [params]
 */
export function listExceptions({ status, reason_stage_key, limit, offset } = {}) {
  return request('/exceptions', { query: { status, reason_stage_key, limit, offset } });
}
