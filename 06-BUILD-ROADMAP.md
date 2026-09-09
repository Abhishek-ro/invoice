# 06 — Build Roadmap

Turns 01–05 into an execution checklist. Nothing here is a new decision — every
item cites the doc/section it comes from. If you disagree with an item, the
argument belongs in that doc, not here.

Order matters: each phase is a prerequisite for the next. Don't skip ahead.

---

## Phase 0 — Resolve before writing any backend code

These block real work. Some cost one Slack message, one blocks the entire
matching engine if the answer is bad.

- [ ] **Line items in Python's `/extract` response — confirmed, not assumed.** (02 open Q5) If header-only, 5-way matching cannot be built at all. Ask this first, today.
- [ ] **Quality doc `quantity` = accepted, not rejected.** (05 §11.8) If inverted, every quality-match stage is silently wrong. Get a real sample inspection report and check.
- [ ] **`auto_escalate_variance` flat $500 vs percentage-based.** (05 §11.6) Whoever owns the touchless-rate metric needs to see this before the first demo — large invoices with legitimate 1–2% drift will escalate every time as currently spec'd.
- [ ] **DB engine: Postgres confirmed, not just assumed.** (03 — flagged as never actually decided)
- [ ] **Router mount point / `basename`.** (02 §11) If not set to `/invoice-reconciliation` by the parent app, every `navigate()` call in the existing code is already broken.
- [ ] **`/extract` p95 latency, and whether Python returns a job id if it can't hit ~45s.** (02 open Q1) Confirms the sync-first design in 02 §2 holds.
- [ ] **Who owns the summary LLM call** — Node (the working assumption) or Python. (04 — not in the contract as written, flip this now if wrong)
- [ ] **`taxRate` and `actualSla` — settings or per-run input.** (01 §5) `taxRate` currently defaults to 0, meaning every run today silently claims zero tax.

---

## Phase 1 — Frontend refactor (network-free, do this while it's cheap)

02 §5 and §10 are explicit: do this *before* wiring any API calls. After six
endpoints are wired into the invoice-only path, this is the same refactor plus
untangling six call sites.

- [ ] Replace the 5 hardcoded document blocks in `NewReconciliation.jsx` with the `DOC_TYPES` config array (02 §5)
- [ ] One `<DocumentStep type={...} />` component doing upload → extract → confirm for any type — replace the inline invoice-only JSX
- [ ] Move `NewReconciliation.jsx`'s 12 `useState` calls to a single `useReducer` with named actions (`FILE_SELECTED`, `EXTRACT_STARTED`, etc.) (02 §10)
- [ ] Fix `fileRefs` — single `useRef({})` keyed by doc id, not five separate `useRef()` calls (02 §5)
- [ ] Rename `timesheet` → `service_entry` everywhere — state key, label, and API will all use this (02 §5, 03 §3.5)
- [ ] Fix the status filter bug — filter on the enum (`touchless_approved`), not the display label string (02 §6)
- [ ] Fix `DataGridViewer` sort — `mismatchRate` returns as `"18%"` and sorts as a string; return numbers, format in `render` (02 Tier 4)
- [ ] Hide the 6 out-of-scope pages from the sidebar (History, Vendor Intelligence, Vendor Profile, Duplicate Detection, Analytics, ERP Config); make `ModuleShell`'s "Demo Data" badge conditional per route (02 §11, 01 §Cross-cutting)
- [ ] Hide the duplicate sidebar badge — no backend serves it in v1 (04 §D gap #2)
- [ ] Hide or scope down the global search box — no `/search` endpoint exists (04 §D gap #3)

---

## Phase 2 — Node: Documents & Upload (Upload screen goes real)

- [ ] Migration: `documents`, `line_items` tables + all `03 §1` domains/enums
- [ ] `POST /documents` (multipart) — file intake, storage write
- [ ] Node → Python `/extract` call: send `document_type`, 60s timeout, echo `doc_id` (04 §A)
- [ ] On timeout/500: write `extraction_status = 'failed'`, return `201` (not 5xx) — this is a shipping path, not an error (04 §E.7)
- [ ] Node-side CSV/XLSX parser for PO/GRN — never sent to Python (04 §A.1.2)
- [ ] Confirm-form fields wired to real extracted data, editable, saved on confirm
- [ ] Per-document-type accepted file formats enforced — `.pdf` blanket guard removed (02 §5 point 6)

---

## Phase 3 — Node: Matching engine + Settings (Settings screen goes real)

- [ ] `settings` table (single org-level row) + `GET`/`PUT /settings/tolerances`
- [ ] Implement the comparison primitive: resolve → normalize → skip-on-null → compare → judge → write (05 §1.1)
- [ ] Implement line pairing: SKU → SKU-with-duplicates → exact normalized description → position (both conditions) → unpaired (05 §2.1, §11.7)
- [ ] Implement per-stage confidence: `max(severity_coverage, severity_breach)`, same formula every stage (05 §4)
- [ ] Implement the breach cap — any breach caps a stage below `auto_approve_confidence` (05 §11.5)
- [ ] Implement `expected_payable` / `total_variance` (05 §3 — min-of-quantities × min-of-prices)
- [ ] Implement the decision ladder (05 §8) — confidence and variance thresholds, resolved per 05 §11.6 once that's answered
- [ ] Wire `default_match_doc_types` to seed the wizard's default checkboxes only, not to decide which stages run per-record (05 §11.9 / §6.1)

---

## Phase 4 — Node: Reconciliation submit (Detail screen goes real)

- [ ] Migration: `reconciliations`, `stages`, `mismatches` tables
- [ ] `POST /reconciliations` — synchronous, returns the finished record; `status: "processing"` escape hatch built but never fires in v1 (02 §2, 04 §B)
- [ ] `GET /reconciliations/:id` — **actually fetch by the route param.** Today it's ignored entirely; every deep link in the app is currently unverified (02 §9)
- [ ] Side-by-side compare wired to real `documents[]` + `mismatches[]`, using the canonical `{line_no, field}` reference (03 §3d)
- [ ] AI Summary + Vendor Message generation, in Node, from the real mismatch rows (04 §A.1 note)
- [ ] Duplicate scan wired to the real `(vendor_name_normalized, invoice_number)` check — exact only (03, 05 §7)

---

## Phase 5 — Node: Exceptions (the screen furthest from done — budget real time)

Approve/Reject/Escalate is 0% built today — buttons exist with no `onClick`.
This is the actual core loop of the app. Don't underestimate it because the UI
looks finished (02 §8).

- [ ] `GET /exceptions` — `status IN (human_review, escalated)`
- [ ] `POST /reconciliations/:id/decision` + the legal-transition table (04 §C)
- [ ] `422 note_required` — reject/escalate without a note rejected (01, 03 §9 check constraint)
- [ ] `audit_log` table, append-only (revoke `UPDATE`/`DELETE`), `actor_id` on every row (03 §9)
- [ ] Cache invalidation across the 4 places the exception count/status shows up — sidebar badge, Dashboard KPI, Exceptions header, the record itself (02 §10, 04 §B.4.2)

---

## Phase 6 — Dashboard (deliberately last)

02's build order flags this explicitly: it has the most existing code and the
least real backing. Tempting to start here because it looks finished — resist
that.

- [ ] `GET /dashboard/kpis` — `{ value, unit }`, never pre-formatted strings (02 §3e)
- [ ] `GET /dashboard/charts` — processing volume, exception breakdown, variance trend
- [ ] Recent reconciliations table with the now-fixed status filter
- [ ] Hide: Pipeline Status strip (no data source, 02 §3c), Dashboard View select (Analytics tabs, out of scope), Region select (no region field exists anywhere)

---

## Not a phase — do this in parallel throughout

- [ ] Keep a running tracker (spreadsheet, not another MD file) of every `[NEEDS CONFIRMATION]` row across 04 §F and 05 §11 — get owners and dates on the ones still open
- [ ] `Vendor Snapshot` card — render only `vendor_name` + this invoice's numbers, or hide it; there's no `vendors` table in v1 (04 §F.5)

---

*Basis: 01-SCOPE.md, 02-ARCHITECTURE.md, 03-DATA-MODEL.md, 04-API-CONTRACT.md, 05-MATCHING-RULES.md. Every checkbox cites its source — nothing new introduced here.*
