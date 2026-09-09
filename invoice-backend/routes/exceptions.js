import { Router } from 'express';
import { reconciliations } from '../lib/db.js';
import { toExceptionRow } from '../lib/derive.js';
import { Errors } from '../lib/errors.js';

const router = Router();

// §B.4.1 GET /exceptions — there is no exceptions table, this is a query.
router.get('/exceptions', (req, res) => {
  const { status, reason_stage_key } = req.query;
  if (status && !['human_review', 'escalated'].includes(status)) {
    throw Errors.malformedRequest('status must be human_review or escalated.', { received: status });
  }

  let rows = [...reconciliations.values()].filter((r) => ['human_review', 'escalated'].includes(r.status));
  if (status) rows = rows.filter((r) => r.status === status);

  let exceptionRows = rows.map(toExceptionRow);
  if (reason_stage_key) {
    exceptionRows = exceptionRows.filter((r) => r.reason && r.reason.stage_key === reason_stage_key);
  }
  exceptionRows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  res.status(200).json({ rows: exceptionRows, total: exceptionRows.length });
});

export default router;
