import { Router } from 'express';
import { settings, setSettings, nowISO } from '../lib/db.js';
import { Errors, asyncRoute } from '../lib/errors.js';

const DOC_TYPE_DOMAIN = ['po', 'grn', 'quality', 'service_entry']; // excludes invoice (implied) and contract (never matched) — §B.2.2

const router = Router();

// §B.1.4 / §B.2.1 — same endpoint, two consumers (wizard + settings screen).
router.get('/settings/tolerances', (_req, res) => {
  res.status(200).json(settings);
});

// §B.2.2 — full replace, not a patch.
router.put(
  '/settings/tolerances',
  asyncRoute(async (req, res) => {
    const b = req.body ?? {};
    const fields = {};

    const numCheck = (key, ok) => {
      if (b[key] === undefined || typeof b[key] !== 'number' || !ok(b[key])) fields[key] = 'invalid';
    };
    numCheck('tolerance_price_pct', (v) => v >= 0 && v <= 100);
    numCheck('tolerance_tax_pct', (v) => v >= 0 && v <= 100);
    numCheck('tolerance_quantity_units', (v) => v >= 0);
    numCheck('tolerance_date_days', (v) => Number.isInteger(v) && v >= 0);
    numCheck('auto_approve_confidence', (v) => Number.isInteger(v) && v >= 0 && v <= 100);
    numCheck('auto_escalate_variance', (v) => v >= 0);
    if (
      !Array.isArray(b.default_match_doc_types) ||
      b.default_match_doc_types.length === 0 ||
      !b.default_match_doc_types.every((t) => DOC_TYPE_DOMAIN.includes(t))
    ) {
      fields.default_match_doc_types = 'must be a non-empty array from ' + DOC_TYPE_DOMAIN.join(', ');
    }

    if (Object.keys(fields).length) throw Errors.validationFailed('Settings validation failed.', { fields });

    setSettings({
      tolerance_price_pct: b.tolerance_price_pct,
      tolerance_quantity_units: b.tolerance_quantity_units,
      tolerance_date_days: b.tolerance_date_days,
      tolerance_tax_pct: b.tolerance_tax_pct,
      auto_approve_confidence: b.auto_approve_confidence,
      auto_escalate_variance: b.auto_escalate_variance,
      default_match_doc_types: b.default_match_doc_types,
      updated_at: nowISO(),
      updated_by: req.actor.name,
    });

    res.status(200).json(settings);
  })
);

export default router;
