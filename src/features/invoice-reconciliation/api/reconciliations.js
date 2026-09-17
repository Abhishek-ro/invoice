// 04-API-CONTRACT.md §B.1.3, §B.3.1-4, §B.4.2, §B.5.2
import { RECON_API_BASE_URL, request } from './apiClient';

/**
 * §B.1.3 — synchronous, returns the finished record. §B.3.2: in v1 this
 * never comes back with status:"processing", but a real async backend
 * might, so callers should still handle it (see getReconciliation's poll
 * loop note below) rather than assuming this promise always resolves to
 * a terminal record.
 */
export function createReconciliation({ document_ids, tax_rate, actual_sla }) {
  return request('/reconciliations', {
    method: 'POST',
    json: { document_ids, tax_rate, actual_sla },
  });
}

/**
 * §B.3.1. §B.3.2's "processing" escape hatch: if this ever comes back
 * with `status: "processing"` (never happens against this backend —
 * it's always synchronous — but will once matching moves to a background
 * job), the caller is expected to poll this same endpoint every 1s until
 * it isn't. See 04 §B.3.2 for the ~20-line reference loop; not wired up
 * here since there's nothing to exercise it against yet.
 */
export function getReconciliation(id) {
  return request(`/reconciliations/${id}`);
}

/** §B.5.2 — the Dashboard / History list. `status` may be a string or an array (repeatable query param). */
export function listReconciliations({
  status,
  date_from,
  date_to,
  limit,
  offset,
} = {}) {
  return request('/reconciliations', {
    query: { status, date_from, date_to, limit, offset },
  });
}

/** §B.3.3 */
export function addNote(id, body) {
  return request(`/reconciliations/${id}/notes`, {
    method: 'POST',
    json: { body },
  });
}

/**
 * §B.3.4 / §B.4.2 — shared by Invoice Detail's header buttons and the
 * Exceptions Queue row action. `note` is required (non-blank) for
 * 'reject' and 'escalate', optional for 'approve' — the server enforces
 * this with 422 note_required, but validate client-side too so the user
 * isn't round-tripping to find out.
 * @param {string} id
 * @param {'approve'|'reject'|'escalate'} action
 * @param {string} [note]
 */
export function postDecision(id, action, note) {
  return request(`/reconciliations/${id}/decision`, {
    method: 'POST',
    json: { action, note },
  });
}

export function reconcileDocuments({
  digitization_output,
  po_data = {},
  receipt_doc_text = '',
  sla_doc_text = '',
  acceptance_data = {},
  tax_rate = 0,
  sla_data = {},
}) {
  return request('/reconcile', {
    method: 'POST',
    json: {
      digitization_output,
      po_data,
      receipt_doc_text,
      contract_text: '',
      sla_doc_text,
      performance_data: {},
      acceptance_data,
      tax_rate,
      config: {},
      sla_data,
    },
    baseUrl: RECON_API_BASE_URL,
  });
}

export function runFullPipeline({
  invoicePdf,
  poPdf,
  slaPdf,
  grnFile,
  acceptancePdf,
  language,
}) {
  const formData = new FormData();
  formData.append('invoice_pdf', invoicePdf);
  if (poPdf) formData.append('po_pdf', poPdf);
  if (slaPdf) formData.append('sla_pdf', slaPdf);
  if (grnFile) formData.append('grn_file', grnFile);
  if (acceptancePdf) formData.append('acceptance_pdf', acceptancePdf);
  const query = {};
  if (language) query.language = language;
  return request('/full-pipeline', {
    method: 'POST',
    formData,
    query,
    baseUrl: RECON_API_BASE_URL,
  });
}
