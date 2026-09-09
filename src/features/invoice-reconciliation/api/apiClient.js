// ---------------------------------------------------------------------
// THE ONE-LINE SWAP POINT.
//
// Every request the frontend makes goes through request() below, which
// reads its target from VITE_API_BASE_URL (set in .env at the project
// root). Right now that points at the invoice-backend/ folder next to this
// project. When the real Node backend exists, change that one env var —
// nothing in any page or component needs to change, because every call
// site already goes through this file and the api/*.js functions that
// wrap it, never a direct fetch() to a hardcoded URL.
//
// Shapes, error codes and status codes here all match
// 04-API-CONTRACT.md §0 exactly, because that's the contract both this
// this backend and (eventually) the real backend implement.
// ---------------------------------------------------------------------

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1';

// §0: "In v1 the frontend hardcodes these; when auth lands they come
// from the session and the headers are dropped." One place to change
// when that day comes.
const ACTOR = { id: 'u_dev_stub', name: 'P. Sharma' };

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code; // switch on THIS, never on `message` — §0
    this.details = details;
  }
}

async function parseErrorBody(res) {
  try {
    const body = await res.json();
    if (body?.error?.code) return body.error;
  } catch {
    /* fall through to generic error below */
  }
  return { code: 'internal_error', message: `Request failed with status ${res.status}` };
}

/**
 * @param {string} path - relative to /api/v1, e.g. '/reconciliations/:id'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.json] - if set, sent as application/json body
 * @param {FormData} [options.formData] - if set, sent as multipart/form-data (mutually exclusive with json)
 * @param {object} [options.query] - query params (repeated keys supported via arrays)
 * @param {boolean} [options.mutating] - defaults to true for non-GET methods; set false to skip actor headers on a non-GET call that doesn't need them (none currently)
 */
export async function request(path, options = {}) {
  const { method = 'GET', json, formData, query } = options;

  let url = `${BASE_URL}${path}`;
  if (query && Object.keys(query).length) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.append(key, value);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {};
  if (method !== 'GET') {
    headers['X-Actor-Id'] = ACTOR.id;
    headers['X-Actor-Name'] = ACTOR.name;
  }

  let body;
  if (formData) {
    body = formData; // browser sets multipart Content-Type + boundary itself
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const res = await fetch(url, { method, headers, body });

  if (!res.ok) {
    const { code, message, details } = await parseErrorBody(res);
    throw new ApiError(res.status, code, message, details);
  }
  if (res.status === 204) return null;
  return res.json();
}
