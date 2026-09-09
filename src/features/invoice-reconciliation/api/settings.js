// 04-API-CONTRACT.md §B.1.4 / §B.2.1-2
import { request } from './apiClient';

/** Same endpoint feeds the wizard's default match strategy AND the Settings screen (one query key, two consumers — §B.1.4). */
export function getTolerances() {
  return request('/settings/tolerances');
}

/** Full replace, not a patch — send all eight fields (§B.2.2). */
export function updateTolerances(payload) {
  return request('/settings/tolerances', { method: 'PUT', json: payload });
}
