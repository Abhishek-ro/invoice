import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTolerances } from '../../api';
import { DOC_TONE } from './docMeta';

/*
 * Step 2 of the New Reconciliation wizard: "Matching Strategy".
 *
 * Real: the selection itself (same matchParams the rest of the wizard reads,
 * so it still drives which upload steps show in the stepper and which
 * document ids go into POST /reconciliations), the invoice fields + line
 * items from Step 1, and the tolerance numbers, which come from
 * GET /settings/tolerances (§B.1.4 says that endpoint feeds this screen as
 * well as Matching Rules).
 *
 * Demo: the recommendation is a keyword heuristic over line descriptions,
 * not a model, and the "found in SAP" lines per document are canned. Both
 * are shaped like what the real extraction / ERP lookup would hand back, so
 * wiring them up later only touches recommend() and sourceStatus().
 */

// Used until GET /settings/tolerances answers (or if it can't) — same
// values the stand-in backend seeds, so the numbers don't jump on load.
const FALLBACK_RULES = {
  tolerance_price_pct: 2,
  tolerance_quantity_units: 0,
  tolerance_date_days: 5,
  tolerance_tax_pct: 1,
  auto_approve_confidence: 90,
  auto_escalate_variance: 500,
};

const DOC_ORDER = ['po', 'grn', 'quality', 'service_entry', 'contracts'];

const DOC_META = {
  po: {
    tone: DOC_TONE.po, short: 'PO', title: 'Purchase Order',
    desc: 'Prices, quantities and terms against the original order.',
    chips: ['Unit price', 'Ordered qty', 'Terms'],
  },
  grn: {
    tone: DOC_TONE.grn, short: 'GRN', title: 'Goods Receipt Note',
    desc: 'Billed quantities against what actually arrived.',
    chips: ['Received qty', 'Delivery date'],
  },
  quality: {
    tone: DOC_TONE.quality, short: 'QIC', title: 'Quality Certificate',
    desc: 'Only pay for what passed inspection.',
    chips: ['Accepted qty', 'Rejected lots'],
  },
  service_entry: {
    tone: DOC_TONE.service_entry, short: 'SES', title: 'Service Entry Sheet',
    desc: 'Billed hours or milestones against approved work.',
    chips: ['Approved hours', 'Milestones'],
  },
  contracts: {
    tone: DOC_TONE.contracts, short: 'MSA', title: 'SLA / Master Contract',
    desc: 'Rates and SLA credits against the signed contract.',
    chips: ['Contract rates', 'SLA credits'],
  },
};

const GROUPS = [
  { label: 'Goods', ids: ['po', 'grn', 'quality'] },
  { label: 'Services & contracts', ids: ['service_entry', 'contracts'] },
];

// Common combinations, not tiers — the right one depends on what's being
// bought, not on how careful you want to be (same stance as the landing
// page's MatchDepth section).
const PRESETS = [
  { id: '2way', label: '2-way', docs: ['po'], hint: 'Low-value, non-stock' },
  { id: '3way', label: '3-way', docs: ['po', 'grn'], hint: 'Physical goods' },
  { id: '4way', label: '4-way', docs: ['po', 'grn', 'quality'], hint: 'Regulated goods' },
  { id: '5way', label: '5-way', docs: ['po', 'grn', 'quality', 'service_entry'], hint: 'Goods + services' },
  { id: 'services', label: 'Services', docs: ['po', 'service_entry', 'contracts'], hint: 'SLA-bound work' },
];

/* ── Icons ─────────────────────────────────────────── */
const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const SparkIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);
const CheckIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svg} strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
);
const InvoiceIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
    <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" />
  </svg>
);
const AlertIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const ExternalIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/* ── Helpers ───────────────────────────────────────── */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const toNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
  }
}

const pct = (v) => `±${Number(v).toFixed(1).replace(/\.0$/, '')}%`;
const units = (v) => (Number(v) === 0 ? 'exact' : `±${v} units`);

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const toParams = (docs) => Object.fromEntries(DOC_ORDER.map((id) => [id, docs.includes(id)]));

function initials(name) {
  const letters = String(name || '').replace(/\b(ltd|inc|co|llc|pvt|limited)\b\.?/gi, '').trim().split(/\s+/).map((w) => w[0]).join('');
  return (letters || 'VN').slice(0, 2).toUpperCase();
}

const SERVICE_RE = /\b(services?|licen[cs]e|subscription|saas|consult\w*|support|maintenance|amc|labou?r|install\w*|hours?|retainer|training|audit)\b/i;
const FEE_RE = /\b(freight|shipping|courier|handling|delivery charge)\b/i;
const REGULATED_RE = /\b(pharma\w*|medical|sterile|batch|reagent|vaccine|automotive|food[- ]grade)\b/i;

// Stand-in for the real "which match fits this invoice" call. Reads the
// line items the user just confirmed in Step 1, sorts them into goods,
// services and pass-through fees, and picks the documents that actually
// matter for that mix. The answer is a document list, not a preset — a
// goods + services invoice with nothing regulated on it wants PO + GRN +
// SES, which isn't one of the five presets, and that's fine.
function recommend(fields, rows) {
  const lines = (rows || []).filter((r) => String(r.description || '').trim());
  const service = lines.filter((r) => SERVICE_RE.test(r.description));
  const fees = lines.filter((r) => !SERVICE_RE.test(r.description) && FEE_RE.test(r.description));
  const goods = lines.length - service.length - fees.length;
  const regulated = goods > 0 && lines.some((r) => REGULATED_RE.test(r.description));

  let docs;
  let why;
  if (service.length && !goods) {
    docs = ['po', 'service_entry', 'contracts'];
    why = 'Every line is a service, so billed work gets checked against approved service entries and the contract rates.';
  } else if (service.length) {
    docs = regulated ? ['po', 'grn', 'quality', 'service_entry'] : ['po', 'grn', 'service_entry'];
    why = `This invoice mixes goods and services, so the goods need a receipt${regulated ? ' and an inspection' : ''} and the services need a signed-off service entry.`;
  } else if (regulated) {
    docs = ['po', 'grn', 'quality'];
    why = 'Some lines look like regulated goods, so only the quantity that passed inspection should be paid.';
  } else if (goods) {
    docs = ['po', 'grn'];
    why = `It's all physical goods${fees.length ? ' plus freight' : ''}, so it's worth checking quantities against what actually arrived.`;
  } else {
    docs = ['po'];
    why = 'Nothing here needs a delivery check, so the PO alone is enough to confirm price and terms.';
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const chips = [];
  chips.push(fields.po_ref ? { tone: 'ok', text: `${fields.po_ref} referenced` } : { tone: 'warn', text: 'No PO number on invoice' });
  if (goods) chips.push({ tone: 'ok', text: `${plural(goods, 'goods line')}${fees.length ? ' + freight' : ''}` });
  chips.push(service.length ? { tone: 'ok', text: plural(service.length, 'service line') } : { tone: 'muted', text: 'No service lines' });
  if (regulated) chips.push({ tone: 'ok', text: 'Regulated items' });
  if (fields.grn_ref && docs.includes('grn')) chips.push({ tone: 'ok', text: `${fields.grn_ref} on invoice` });

  const preset = PRESETS.find((p) => sameSet(p.docs, docs)) || null;
  const confidence = 86 + (hash(String(fields.doc_number || 'invoice')) % 11);
  return { docs, preset, why, chips, confidence, serviceLines: service.length };
}

// Where each document would come from. Canned, but keyed off the refs Step 1
// actually extracted so it reads consistently with the invoice on screen.
function sourceStatus(id, fields, serviceLines) {
  const seed = hash(String(fields.doc_number || 'invoice'));
  switch (id) {
    case 'po':
      return fields.po_ref
        ? { state: 'ok', text: `${fields.po_ref} found in SAP S/4HANA` }
        : { state: 'warn', text: "No PO number, we'll search by vendor" };
    case 'grn':
      return fields.grn_ref
        ? { state: 'ok', text: `${fields.grn_ref} posted against this PO` }
        : { state: 'warn', text: 'No receipt ref, fetch or upload' };
    case 'quality':
      return { state: 'warn', text: 'Not in ERP, upload the certificate' };
    case 'service_entry':
      return serviceLines
        ? { state: 'ok', text: `SES-${4000 + (seed % 900)} approved in SAP` }
        : { state: 'idle', text: 'No service lines on this invoice' };
    case 'contracts':
      return { state: 'ok', text: `MSA-${initials(fields.vendor_name)}-24 on file, valid to Mar 2027` };
    default:
      return { state: 'idle', text: '' };
  }
}

function buildChecks(selected, rules) {
  const byDoc = {
    po: [
      { label: 'Unit price vs PO', tol: pct(rules.tolerance_price_pct) },
      { label: 'Billed qty within ordered qty', tol: units(rules.tolerance_quantity_units) },
      { label: 'Payment terms match PO', tol: 'exact' },
    ],
    grn: [
      { label: 'Billed qty vs received qty', tol: units(rules.tolerance_quantity_units) },
      { label: 'Received before invoice date', tol: `±${rules.tolerance_date_days} days` },
    ],
    quality: [
      { label: 'Only accepted qty is billed', tol: 'exact' },
      { label: 'No rejected lots on invoice', tol: 'exact' },
    ],
    service_entry: [
      { label: 'Billed hours vs approved SES', tol: pct(rules.tolerance_price_pct) },
      { label: 'Milestone signed off', tol: 'required' },
    ],
    contracts: [
      { label: 'Rates match contract', tol: pct(rules.tolerance_price_pct) },
      { label: 'SLA credits applied', tol: 'auto' },
    ],
  };
  const docChecks = DOC_ORDER.filter((id) => selected[id]).flatMap((id) => byDoc[id].map((c) => ({ ...c, doc: id })));
  return [
    ...docChecks,
    { label: 'Tax recalculated', tol: pct(rules.tolerance_tax_pct), doc: 'invoice' },
    { label: 'Duplicate invoice screen', tol: 'always', doc: 'invoice' },
  ];
}

function pickRules(s) {
  const out = {};
  for (const key of Object.keys(FALLBACK_RULES)) {
    if (typeof s?.[key] === 'number' && Number.isFinite(s[key])) out[key] = s[key];
  }
  return out;
}

const toneOf = (id) => (id === 'invoice' ? 'slate' : DOC_META[id].tone);

/* ── Component ─────────────────────────────────────── */
export default function MatchingStrategyStep({
  docTypes,
  matchParams,
  extractedData,
  lineItems,
  nextStepLabel,
  onToggle,
  onSetParams,
  onBack,
  onContinue,
}) {
  const [rules, setRules] = useState(FALLBACK_RULES);

  useEffect(() => {
    let alive = true;
    getTolerances()
      .then((s) => { if (alive) setRules((r) => ({ ...r, ...pickRules(s) })); })
      .catch(() => { /* read-only hint — keep the fallback numbers quietly */ });
    return () => { alive = false; };
  }, []);

  const fields = extractedData || {};
  const rec = useMemo(() => recommend(extractedData || {}, lineItems), [extractedData, lineItems]);
  const typeById = useMemo(() => Object.fromEntries((docTypes || []).map((d) => [d.id, d])), [docTypes]);

  const selectedIds = DOC_ORDER.filter((id) => matchParams[id]);
  const activePreset = PRESETS.find((p) => sameSet(p.docs, selectedIds));
  const recApplied = sameSet(rec.docs, selectedIds);
  const recName = rec.preset?.id === 'services' ? 'services' : `${rec.docs.length + 1}-way`;
  const checks = buildChecks(matchParams, rules);
  const count = selectedIds.length;
  const depthLabel = count ? `${count + 1}-way` : 'Invoice only';

  const currency = fields.currency || 'USD';
  const total = Number.isFinite(Number(fields.total)) && fields.total !== '' && fields.total != null
    ? Number(fields.total)
    : (lineItems || []).reduce((sum, r) => sum + toNum(r.quantity) * toNum(r.unit_price), 0);

  const needsPoHint = !matchParams.po && (matchParams.grn || matchParams.quality);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="ir-ms"
    >
      {/* Header */}
      <div className="ir-ms__head">
        <div>
          <h2 className="ir-ms__title">How should Cortex check this invoice?</h2>
          <p className="ir-ms__sub">Pick a match depth, or choose the documents one by one.</p>
        </div>
        <div className="ir-ms__inv" title="Invoice being reconciled">
          <span className="ir-ms__inv-icon"><InvoiceIcon /></span>
          <span className="ir-ms__inv-text">
            <strong>{fields.doc_number || 'Invoice'}</strong>
            <span className="ir-ms__inv-sep">·</span>
            <span className="ir-ms__inv-vendor">{fields.vendor_name || 'Unknown vendor'}</span>
            <span className="ir-ms__inv-sep">·</span>
            <strong>{formatMoney(total, currency)}</strong>
          </span>
        </div>
      </div>

      <div className="ir-ms__body">
        <div className="ir-ms__main">
          {/* Recommendation */}
          <div className="ir-ms-rec">
            <span className="ir-ms-rec__spark"><SparkIcon /></span>
            <div className="ir-ms-rec__copy">
              <div className="ir-ms-rec__eyebrow">
                Cortex suggestion
                <span className="ir-ms-rec__conf">{rec.confidence}% confidence</span>
              </div>
              <div className="ir-ms-rec__title">
                A {recName} match fits this invoice best
                {!rec.preset && (
                  <span className="ir-ms-rec__docs">
                    {rec.docs.map((id) => DOC_META[id].short).join(' + ')}
                  </span>
                )}
              </div>
              <p className="ir-ms-rec__why">{rec.why}</p>
              <div className="ir-ms-rec__chips">
                {rec.chips.map((c) => (
                  <span key={c.text} className={`ir-ms-chip ir-ms-chip--${c.tone}`}>
                    {c.tone === 'ok' && <CheckIcon />}
                    {c.tone === 'warn' && <AlertIcon size={12} />}
                    {c.text}
                  </span>
                ))}
              </div>
            </div>
            <div className="ir-ms-rec__action">
              {recApplied ? (
                <span className="ir-ms-applied"><CheckIcon /> Applied</span>
              ) : (
                <button type="button" className="ir-ms-btn-apply" onClick={() => onSetParams(toParams(rec.docs))}>
                  {rec.preset ? `Use ${rec.preset.label.toLowerCase()}` : 'Use this'}
                </button>
              )}
            </div>
          </div>

          {/* Presets */}
          <section>
            <div className="ir-ms-label">
              <span className="ir-ms-label__text">Match depth</span>
              {!activePreset && count > 0 && <span className="ir-ms-label__meta">Custom · <strong>{depthLabel}</strong></span>}
            </div>
            <div className="ir-ms-presets" role="radiogroup" aria-label="Match depth">
              {PRESETS.map((p) => {
                const active = activePreset?.id === p.id;
                const suggested = rec.preset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`ir-ms-preset${active ? ' is-active' : ''}`}
                    onClick={() => onSetParams(toParams(p.docs))}
                  >
                    <span className="ir-ms-preset__top">
                      <span className="ir-ms-preset__name">{p.label}</span>
                      {suggested && <span className="ir-ms-preset__ai" title="Cortex suggestion"><SparkIcon size={12} /></span>}
                    </span>
                    <span className="ir-ms-preset__bars" aria-hidden="true">
                      {['invoice', ...p.docs].map((id) => <i key={id} className={`ir-ms-tone--${toneOf(id)}`} />)}
                    </span>
                    <span className="ir-ms-preset__hint">{p.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Documents */}
          <section>
            <div className="ir-ms-label">
              <span className="ir-ms-label__text">Documents to match against</span>
              <span className="ir-ms-label__meta"><strong>{count}</strong> of {DOC_ORDER.length} selected</span>
            </div>
            {GROUPS.map((g) => (
              <div className="ir-ms-group" key={g.label}>
                <div className="ir-ms-group__label">{g.label}</div>
                <div className="ir-ms-docs">
                  {g.ids.map((id) => {
                    const meta = DOC_META[id];
                    const on = !!matchParams[id];
                    const status = sourceStatus(id, fields, rec.serviceLines);
                    return (
                      <label key={id} className={`ir-ms-doc ir-ms-tone--${meta.tone}${on ? ' is-on' : ''}`}>
                        <input
                          type="checkbox"
                          className="ir-ms-doc__input"
                          aria-label={`${meta.title} (${meta.short})`}
                          checked={on}
                          onChange={(e) => onToggle(id, e.target.checked)}
                        />
                        <span className="ir-ms-doc__top">
                          <span className="ir-ms-doc__icon">{typeById[id]?.icon}</span>
                          <span className="ir-ms-check" aria-hidden="true"><CheckIcon /></span>
                        </span>
                        <span className="ir-ms-doc__title">
                          {meta.title} <span className="ir-ms-doc__code">{meta.short}</span>
                        </span>
                        <span className="ir-ms-doc__desc">{meta.desc}</span>
                        <span className={`ir-ms-doc__status is-${status.state}`}>
                          <i aria-hidden="true" />
                          <span>{status.text}</span>
                        </span>
                        <span className="ir-ms-doc__chips">
                          {meta.chips.map((c) => <span key={c} className="ir-ms-doc__chip">{c}</span>)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* Summary rail */}
        <aside className="ir-ms-aside" aria-live="polite">
          <div className="ir-ms-aside__head">Match summary</div>
          <div className="ir-ms-sum">
            <div className="ir-ms-sum__depth">
              {depthLabel}{count > 0 && <small>match</small>}
            </div>
            <div className="ir-ms-sum__sub">
              {count ? `Invoice + ${count} document${count === 1 ? '' : 's'}` : 'Nothing to compare against yet'}
            </div>

            <div className="ir-ms-chain">
              <AnimatePresence initial={false}>
                {['invoice', ...selectedIds].map((id) => (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.18 }}
                    className={`ir-ms-node ir-ms-tone--${toneOf(id)}`}
                  >
                    <span className="ir-ms-node__dot">{id === 'invoice' ? <InvoiceIcon /> : typeById[id]?.icon}</span>
                    <span className="ir-ms-node__label">{id === 'invoice' ? 'INV' : DOC_META[id].short}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {count === 0 && (
              <div className="ir-ms-note ir-ms-note--warn">
                <AlertIcon /> Pick at least one document. An invoice on its own has nothing to be checked against.
              </div>
            )}
            {needsPoHint && (
              <div className="ir-ms-note">
                <AlertIcon /> Receipt and quality checks are measured against the PO. Without it they can only compare quantities, not prices.
              </div>
            )}
          </div>

          <div className="ir-ms-checks">
            <div className="ir-ms-checks__title">
              What gets checked
              <span className="ir-ms-checks__count">{checks.length}</span>
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {checks.map((c) => (
                  <motion.li
                    key={`${c.doc}-${c.label}`}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <i className={`ir-ms-tone--${toneOf(c.doc)}`} aria-hidden="true" />
                    <span>{c.label}</span>
                    <code>{c.tol}</code>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>

          <div className="ir-ms-aside__foot">
            Auto-approves at <strong>{rules.auto_approve_confidence}%</strong> confidence. Variances over{' '}
            <strong>{formatMoney(rules.auto_escalate_variance, currency)}</strong> go to review.{' '}
            <a href="/invoice-reconciliation/settings/rules" target="_blank" rel="noreferrer">
              Matching rules <ExternalIcon />
            </a>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <div className="ir-ms__foot">
        <button type="button" className="ir-ms-btn-back" onClick={onBack}>← Back</button>
        <div className="ir-ms__foot-meta">
          <strong>{count}</strong> document{count === 1 ? '' : 's'} · <strong>{checks.length}</strong> checks
        </div>
        <button type="button" className="ir-ms-btn-next" onClick={onContinue} disabled={count === 0}>
          Continue to {(nextStepLabel || 'next step').toLowerCase()} →
        </button>
      </div>
    </motion.div>
  );
}
