import { Router } from 'express';
import { documents, reconciliations, genId, nowISO, settings } from '../lib/db.js';
import { runMatch } from '../lib/matcher.js';
import { toListRow } from '../lib/derive.js';
import { Errors, asyncRoute } from '../lib/errors.js';

const router = Router();

// §C — the state machine lives here, not in a trigger.
const TRANSITIONS = {
  human_review: { approve: 'touchless_approved', reject: 'rejected', escalate: 'escalated' },
  escalated: { approve: 'touchless_approved', reject: 'rejected' },
  duplicate_flagged: { approve: 'touchless_approved', reject: 'rejected', escalate: 'escalated' },
  touchless_approved: {},
  rejected: {},
};

// §B.1.3 POST /reconciliations — synchronous, returns the finished record.
router.post(
  '/reconciliations',
  asyncRoute(async (req, res) => {
    const { document_ids, tax_rate, actual_sla } = req.body ?? {};
    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      throw Errors.malformedRequest('document_ids must be a non-empty array.');
    }

    const docs = [];
    const missing = [];
    for (const id of document_ids) {
      const d = documents.get(id);
      if (!d) missing.push(id);
      else docs.push(d);
    }
    if (missing.length) throw Errors.notFound('One or more document ids do not exist.', { document_ids: missing });

    const invoiceDocs = docs.filter((d) => d.document_type === 'invoice');
    if (invoiceDocs.length !== 1) throw Errors.missingInvoiceDocument();

    const typeCounts = {};
    for (const d of docs) typeCounts[d.document_type] = (typeCounts[d.document_type] || 0) + 1;
    const dupedType = Object.entries(typeCounts).find(([, count]) => count > 1);
    if (dupedType) throw Errors.duplicateDocumentType('No two documents may share a document_type.', { document_type: dupedType[0] });

    const unconfirmed = docs.filter((d) => !d.confirmed_at).map((d) => d.id);
    if (unconfirmed.length) throw Errors.documentNotConfirmed('All documents must be confirmed before matching.', { document_ids: unconfirmed });

    const alreadyUsed = docs.filter((d) => d.usedInReconciliation).map((d) => d.id);
    if (alreadyUsed.length) throw Errors.documentAlreadyUsed('One or more documents already belong to a reconciliation.', { document_ids: alreadyUsed });

    const id = genId();
    const createdAt = nowISO();
    const invoice = invoiceDocs[0];

    const result = runMatch({ docs, settings, existingReconciliations: [...reconciliations.values()] });
    const matchedAt = nowISO();

    const record = {
      id,
      invoice_number: invoice.fields.doc_number,
      vendor_name: invoice.fields.vendor_name,
      status: result.status,
      confidence: result.confidence,
      confidence_driver_stage: result.confidence_driver_stage,
      invoice_total: result.invoice_total,
      expected_payable: result.expected_payable,
      total_variance: result.total_variance,
      currency: invoice.fields.currency,
      tax_rate: tax_rate ?? null,
      actual_sla: actual_sla ?? null,
      match_mode: result.match_mode,
      tolerance_snapshot: {
        tolerance_price_pct: settings.tolerance_price_pct,
        tolerance_quantity_units: settings.tolerance_quantity_units,
        tolerance_date_days: settings.tolerance_date_days,
        tolerance_tax_pct: settings.tolerance_tax_pct,
        auto_approve_confidence: settings.auto_approve_confidence,
        auto_escalate_variance: settings.auto_escalate_variance,
      },
      human_summary: result.human_summary,
      vendor_message: result.vendor_message,
      duplicate_check: result.duplicate_check,
      documents: docs,
      stages: result.stages,
      mismatches: result.mismatches.map((m) => ({ ...m, id: genId() })),
      audit_log: [
        { id: genId(), kind: 'system', action: null, from_status: null, to_status: result.status, body: 'Matcher set status from confidence rollup', actor_id: 'system', actor_name: 'system', created_at: matchedAt },
      ],
      created_at: createdAt,
      matched_at: matchedAt,
      decided_at: null,
    };

    reconciliations.set(id, record);
    for (const d of docs) d.usedInReconciliation = true;

    res.status(201).json(record);
  })
);

// §B.5.2 GET /reconciliations — the dashboard list, with status/date filters.
router.get('/reconciliations', (req, res) => {
  let rows = [...reconciliations.values()];

  const statusFilter = req.query.status;
  if (statusFilter) {
    const wanted = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    rows = rows.filter((r) => wanted.includes(r.status));
  }
  const { date_from, date_to } = req.query;
  if (date_from) rows = rows.filter((r) => r.created_at.slice(0, 10) >= date_from);
  if (date_to) rows = rows.filter((r) => r.created_at.slice(0, 10) <= date_to);

  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.status(200).json({ rows: rows.map(toListRow), total: rows.length });
});

// §B.3.1 GET /reconciliations/:id — one round trip, whole Detail screen.
// §B.3.2's "processing" poll never actually happens in v1 (this always
// returns a terminal status synchronously) but the frontend's poll loop
// should still be written to handle it — see 04 §B.3.2.
router.get('/reconciliations/:id', (req, res) => {
  const r = reconciliations.get(req.params.id);
  if (!r) throw Errors.notFound('No reconciliation with that id.', { id: req.params.id });
  res.status(200).json(r);
});

// §B.3.3 POST /reconciliations/:id/notes
router.post(
  '/reconciliations/:id/notes',
  asyncRoute(async (req, res) => {
    const r = reconciliations.get(req.params.id);
    if (!r) throw Errors.notFound('No reconciliation with that id.', { id: req.params.id });

    const body = (req.body?.body ?? '').trim();
    if (!body) throw Errors.validationFailed('Note body must not be blank.', { fields: { body: 'required' } });

    const entry = {
      id: genId(), kind: 'note', action: null, from_status: null, to_status: null,
      body, actor_id: req.actor.id, actor_name: req.actor.name, created_at: nowISO(),
    };
    r.audit_log.push(entry);
    res.status(201).json({ entry, audit_log: r.audit_log });
  })
);

// §B.3.4 / §B.4.2 POST /reconciliations/:id/decision — the core loop.
router.post(
  '/reconciliations/:id/decision',
  asyncRoute(async (req, res) => {
    const r = reconciliations.get(req.params.id);
    if (!r) throw Errors.notFound('No reconciliation with that id.', { id: req.params.id });

    const { action, note } = req.body ?? {};
    if (!['approve', 'reject', 'escalate'].includes(action)) {
      throw Errors.malformedRequest('action must be approve, reject, or escalate.', { received: action });
    }
    if ((action === 'reject' || action === 'escalate') && !(note ?? '').trim()) {
      throw Errors.noteRequired();
    }

    const allowed = TRANSITIONS[r.status] ?? {};
    const toStatus = allowed[action];
    if (!toStatus) {
      throw Errors.illegalTransition(`Cannot ${action} a record that is already ${r.status.replace('_', ' ')}.`, {
        from_status: r.status,
        action,
        allowed_actions: Object.keys(allowed),
      });
    }

    const fromStatus = r.status;
    r.status = toStatus;
    r.decided_at = nowISO();
    r.audit_log.push({
      id: genId(), kind: 'decision', action, from_status: fromStatus, to_status: toStatus,
      body: note ?? null, actor_id: req.actor.id, actor_name: req.actor.name, created_at: r.decided_at,
    });

    res.status(200).json({ id: r.id, status: r.status, decided_at: r.decided_at, audit_log: r.audit_log });
  })
);

export default router;
