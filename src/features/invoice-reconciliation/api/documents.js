// 04-API-CONTRACT.md §B.1.1 / §B.1.2
import { RECON_API_BASE_URL, request } from './apiClient';

/**
 * Upload one document and get back its extraction result (or the
 * all-null degraded shape if extraction failed — see §A.4. This mock
 * server always succeeds; a real backend can return the failed shape,
 * so callers should still branch on `extraction_status`, never on
 * whether this promise resolved.)
 * @param {File} file
 * @param {'invoice'|'po'|'grn'|'service_entry'|'quality'|'contract'} documentType
 */
export function uploadDocument(file, documentType, fileHash) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  // Optional — lets the backend record this invoice's hash for future
  // duplicate-detection lookups (see checkDocumentHash below). Harmless
  // to omit for non-invoice document types.
  if (fileHash) formData.append('file_hash', fileHash);
  return request('/documents', { method: 'POST', formData });
}

/**
 * Duplicate-invoice check (new endpoint, not in 04-API-CONTRACT.md).
 * Call with a SHA-256 hex digest of the raw file bytes (see
 * `hashFile` in pages/NewReconciliation.jsx, computed via Web Crypto)
 * BEFORE uploading — a duplicate hit means the file must not be
 * uploaded/extracted at all.
 * @param {string} hash - sha256 hex digest
 * @returns {Promise<{ duplicate: boolean, match?: { document_id: string, original_filename: string, processed_at: string } }>}
 */
export function checkDocumentHash(hash) {
  return request('/documents/check-hash', { method: 'POST', json: { hash } });
}

/**
 * The confirm step. `line_items` is a FULL REPLACE if present at all —
 * omit it to leave line items untouched, pass [] to delete them (§B.1.2).
 * @param {string} id
 * @param {{ fields?: object, line_items?: object[] }} payload
 */
export function confirmDocument(id, payload) {
  return request(`/documents/${id}`, { method: 'PATCH', json: payload });
}

export function digitizeDocument(file, type, { debug = false, language } = {}) {
  const formData = new FormData();
  const fieldName = {
    invoice: 'invoice_pdf',
    po: 'po_pdf',
    grn: 'grn_file',
    acceptance: 'acceptance_pdf',
    sla: 'sla_file',
    timesheet: 'timesheet_file',
    'service-invoice': 'service_invoice_pdf',
  }[type];
  formData.append(fieldName, file);
  const query = {};
  if (debug) query.debug = true;
  if (language) query.language = language;
  return request(`/digitize-${type}`, {
    method: 'POST',
    formData,
    query,
    baseUrl: RECON_API_BASE_URL,
  });
}

export function checkDuplicateInvoice(
  digitizationOutput,
  includeMatches = true,
) {
  return request('/check-duplicate-invoice', {
    method: 'POST',
    json: {
      digitization_output: digitizationOutput,
      include_matches: includeMatches,
    },
    baseUrl: RECON_API_BASE_URL,
  });
}
