# 01 — v1 Scope Contract

Read with `02-ARCHITECTURE.md`. Everything here traces back to that audit — no new analysis.
If something isn't listed as IN SCOPE below, it isn't being built this sprint. Disagree now, not in review.

**Timeline: days, not weeks.** Every cut below exists because of that.

---

## Cross-cutting constraints (apply to all 5 screens)

Pulled from the architecture doc so scope and architecture can't drift apart:

- **Single currency.** `$` is hardcoded in ~15 places. No multi-currency, no FX. The currency filter and the `currency` tolerance are dropped from v1. (§Tier 4)
- **No pagination.** `DataGridViewer` sorts, filters and exports client-side. APIs return full arrays. `limit`/`offset` stay in the query signature so adding it later isn't breaking. (§3f)
- **Synchronous everything.** No queue, no Redis, no webhooks. Extraction is one sync call per document during upload; matching is sync and returns the finished record. (§2)
- **`status: "processing"` escape hatch is built but never fires in v1.** Client handles it, server never sends it. ~20 lines of insurance. (§2)
- **Manual-entry fallback on extraction failure.** When Python times out or 500s, the confirm form's editable inputs are the degraded mode. This is a shipping path, not an error screen. (§2)
- **Stub auth, real `actor_id`.** No login flow in v1, but every audit row carries a real actor from day one. (§3f)
- **Tolerance changes affect future runs only.** No bulk re-match of historical invoices — that's the trigger for needing a queue. (§2, §7)
- **No PDF rendering.** Side-by-side compare shows extracted structured data, which is what the component already does. (§3d)

---

# 1. IN SCOPE — the five screens

## Dashboard (`Dashboard.jsx`)

**Build this last.** It has the most existing code and the least real backing — its KPIs are aggregates over data that only exists once the other four ship. (§Build order)

In:

- KPI strip — API returns `{ value, unit }` numbers, frontend formats. Requires the `KPI_LIST` change in §3e; do not ship pre-formatted strings.
- Recent reconciliations table with status filter chips — **filter on the enum, render the label from `StatusBadge`'s map**. Fixes the Auto-Approved filter returning nothing. (§6)
- Processing volume, exception breakdown, variance trend charts — real aggregates.
- "+ New Reconciliation" → Upload.

Out:

- **Pipeline Status strip** (`"Invoice Ingestion / Operational"`, `"GRN Matching / Delayed"`). It's system health with no data source behind it, and it shares words with per-invoice stages, which causes confusion. Hide for v1. (§3c)
- **Dashboard View select** (CFO / Procurement / Internal Audit) — those are the Analytics page's tabs, which are out of scope.
- **Region select** — no region field exists anywhere in the data model.
- Date Range select is the only filter that stays.

## Upload (`NewReconciliation.jsx`)

**Refactor before wiring.** The `DOC_TYPES` config array + `useReducer` rework (§5, §10) happens while this file is still network-free. After six API calls are wired into the invoice-only path it's the same refactor plus untangling six call sites.

In:

- **Extract-then-confirm for every document type, not just Invoice.** Today `handleDocUpload` only attaches a file. (§5)
- Document types in v1: `invoice`, `po`, `grn`, `service_entry`, `quality`.
- `contract` — upload and store only, **no matching against it**. See cut #1.
- **Per-type accepted formats.** The blanket `.pdf` guard goes; POs and GRNs arrive as CSV/XLSX too. (§5)
- Editable confirm form including a line-item table, not four flat text inputs. (§5)
- Match strategy step reads its default from Settings (`defaultMatchMode`), doesn't hardcode it.
- Submit → `POST /reconciliations`, sync, returns the finished record. Keep the 5-stage animation as a client-side flourish. (§2)
- Rename `timesheet` → `service_entry` throughout. (§5)

Out:

- **"Fetch from ERP" source.** It's a `setTimeout(1500)` fake, and ERP Config — the screen that would configure the connection — is out of scope. There is nothing to fetch from. The source selector collapses to manual upload only for v1. Keep `source: "upload" | "erp"` on the documents table so adding it later isn't a migration. (§4)
- Batch or email ingestion. One reconciliation at a time, user present.

## Exceptions (`ExceptionsQueue.jsx`)

**This is the screen furthest from done — approve/reject/escalate is 0% built.** The buttons have no `onClick`. Budget real time; the work is the audit and state machine, not the button. (§8)

In:

- List where `status IN (human_review, escalated)`.
- **Approve / Reject / Escalate, one record at a time**, with: required note on reject and escalate, a legal-transition check, an audit row with `actor_id`, and cache invalidation so the sidebar badge and Dashboard KPIs update.
- Reason filter chips.
- Aging labels and the four aging tiles **derived client-side from `created_at`** — the API returns a timestamp, not `"4h"` / `ageOld`. (§3f)
- Live sidebar badge count (currently hardcoded `badge: 4`). (§8)

Out:

- **Bulk approve / bulk escalate.** The buttons exist but are styled disabled today. Multi-select plus per-record audit plus partial-failure handling is a feature on its own. Ship single-record decisions first.

## Invoice Detail (`ReconciliationDetail.jsx`)

In:

- **Actually fetch by route param.** Today `useParams()` is called and the id ignored — every deep link in the app is currently unverified. Expect the ID bugs from §3a to surface here all at once. (§9)
- Financial summary: invoice total, expected payable, total variance.
- Line-item mismatch grid, each row stamped with the tolerance that was applied.
- **Matching pipeline as an ordered array**, not an object keyed by display name — a 3-way run has no GRN stage. (§3b)
- **Side-by-side compare of extracted structured data**, with the mismatching line highlighted on both sides using one canonical `{ line_no, field }` reference. (§3d)
- Approve / Reject / Escalate from the header — same endpoint as Exceptions.
- AI Summary + Vendor Message draft, generated in Node. (§1)
- Internal notes + audit log, normalized server-side to one shape. (§3f)
- Duplicate scan card — wired to `duplicateCheck.flagged`, exact matches only. Today it renders a static green box regardless. (§3f)
- Print Summary (it's `window.print()`, free).

Out:

- **Contract Intelligence card** — that's contract-based validation, cut #1. Hidden in v1.
- **Download Source Docs (.zip)** and **Flag for Audit** — no handlers, no endpoints, not core loop.
- Vendor Snapshot card links to Vendor Profile, which is out of scope. Keep the card, drop the "View Full Profile" link.

## Settings (`MatchingRulesSettings.jsx`)

In:

- **Persisted** via `GET`/`PUT /settings/tolerances`. Today it's `useState` with a Save button that does nothing and a banner admitting it. (§7)
- Tolerance controls: price %, quantity units, date days, **plus tax %** — which is in `MOCK_SETTINGS.tolerances` today with no UI.
- Auto-approve confidence threshold, auto-escalate variance threshold.
- **`defaultMatchMode` gets a control and the wizard reads it.** Right now the setting says `"4-way"` and the wizard defaults to 3-way. (§7)
- Org-level only.

Out:

- **`currency` tolerance** — dropped from the model, single currency.
- Per-vendor or per-category tolerance overrides.
- Re-running historical invoices after a tolerance change.
- Settings change history / who-changed-what.

---

# 2. OUT OF SCOPE

**Six pages, ~half the codebase, no backend, not touched this sprint.** (§0, §11)

| Page | Files | Status |
|---|---|---|
| Reconciliation History | `ReconciliationHistory.jsx` | Demo-only |
| Vendor Intelligence | `VendorIntelligence.jsx` | Demo-only |
| Vendor Profile | `VendorProfile.jsx` + 7 components in `components/vendors/` | Demo-only |
| Duplicate Detection | `DuplicateDetection.jsx` | Demo-only |
| Analytics & Reports | `AnalyticsReports.jsx` + 6 components in `components/analytics/` | Demo-only |
| ERP Config | `ErpConfig.jsx` | Demo-only |

Rules for all of the above:

- **Do not delete them.** They're good demo surface and someone will want them for a walkthrough.
- **They stay on mock data.** No endpoint gets wired to them. If you find yourself writing an API for a vendor risk tier, stop.
- **`ModuleShell`'s "Demo Data" badge becomes conditional per route** — shown on these six, hidden on the five real ones. Right now it's always on, which makes it decoration instead of a signal. (§11)
- **Keep them out of the sidebar's primary section**, or out of the sidebar entirely for v1, so nobody demos a fake screen thinking it's real.
- `context/AnalyticsFilterContext.jsx` stays exactly where it is — scoped inside the Analytics page. It is not promoted to app level. None of the five v1 screens import it. (§10)

Also not touched: the `exportFilename` / `filename` prop bug in `VendorIntelligence`, and the string-sorted `mismatchRate: "18%"` column. Real bugs, out-of-scope screens. (§Tier 4)

---

# 3. DEFINITIONS

The audit found these undefined or defined three different ways. These are the canonical versions. Use them in the DB, the API and the UI.

## 3.1 What "N-way" means

**N counts the documents in the match set, and the invoice is one of them.**

| Mode | Documents | Used for |
|---|---|---|
| 2-way | Invoice + PO | Services with no receipt step |
| **3-way** | **Invoice + PO + GRN** | **Physical goods — the v1 default** |
| 3-way (service) | Invoice + PO + Service Entry | Phased/milestone billing |
| 4-way | Invoice + PO + GRN + Quality | Goods requiring inspection |
| 5-way | Invoice + PO + GRN + Quality + Service Entry | Full set |

- The **contract / SLA document does not count toward N** in v1 — nothing matches against it. See cut #1.
- `MOCK_SETTINGS.defaultMatchMode` changes from `"4-way"` to `"3-way"` to match what the wizard actually defaults to. (§7)
- Product still says "5-way reconciliation platform" — that's the capability, not the default run.

## 3.2 Status enum — canonical

From `StatusBadge.jsx`, which is already the single source of truth for status → label. The backend emits exactly these strings; anything else silently renders as `"Unknown"`. (§3f)

| Enum value | Display label |
|---|---|
| `touchless_approved` | Auto-Approved |
| `human_review` | Needs Review |
| `escalated` | Escalated |
| `rejected` | Rejected |
| `duplicate_flagged` | Duplicate Flagged |

**Filter on the enum. Never on the label.** That's the bug in §6.

## 3.3 Pipeline stage names — canonical

Three vocabularies exist today (`stageTraces` keys, `pipelineStatus` labels, and `mismatches[].stage: "Layer 1"`). This one wins. (§3b, §3c)

| Key | Label | Present when |
|---|---|---|
| `po_match` | PO Match | PO in match set |
| `grn_match` | GRN Match | GRN in match set |
| `quality_match` | Quality Check | Quality doc in match set |
| `service_entry_match` | Service Entry Match | Service entry in match set |
| `price_validation` | Price Validation | Always |
| `duplicate_scan` | Duplicate Scan | Always |
| `decision` | Decision | Always |

- Shipped as an **array with an explicit `order`**, not an object keyed by display name.
- `"Layer 1"` / `"Layer 2"` on mismatch rows is retired — a mismatch references a stage `key`.
- The Dashboard's `pipelineStatus` is a **different concept** (system health) and is hidden in v1 anyway.

## 3.4 Identifiers

Three id formats currently navigate to the same Detail route, and one of them is invented by string substitution. (§3a)

- **`id`** — the reconciliation's primary key. The only thing used as a route param or for navigation.
- **`invoice_number`** — human label (`INV-1001`). Displayed and searched, never used as a key.
- Every list endpoint returns **both on every row**, so no screen has to derive one from the other.
- `_id` is retired — it implies Mongo and the backend is not Mongo.

## 3.5 Document type keys

`invoice`, `po`, `grn`, `service_entry`, `quality`, `contract`.

`timesheet` is renamed to `service_entry` — the state key, the label and the domain term were three different words for one thing. (§5)

---

# 4. EXPLICIT CUTS

Named so nobody quietly builds them. Each has a re-add signal — when that signal fires, it's a scoped follow-up, not a surprise.

### 1. Contract-based validation

- **What:** matching invoice line rates and SLA terms against a master contract or rate card — the `contractIntelligence.clauses` block (`"Rate Card - Line 1: $61.05/unit contracted vs $61.50/unit observed"`) and the Contract Intelligence card on Detail.
- **Why cut:** it needs contract terms as structured, queryable data with effective dates and per-line rate cards — a data model of its own, not a document upload. The `contract` doc type has `extract: false` in the config for exactly this reason. Price validation in v1 compares against the **PO**, which is a real document with real line rates.
- **Re-add when:** contract rates and PO rates start disagreeing often enough that reviewers ask which one is authoritative, or a customer asks for SLA-linked penalties.

### 2. Vendor auto-prediction for no-PO invoices

- **What:** an invoice arrives with no PO reference; the system predicts the vendor and the likely PO from history.
- **Why cut:** v1's flow is user-driven — the user picks the match strategy and attaches each document by hand. There's no ingestion path where a document arrives unattended, so there's nothing to predict for. It also needs invoice history that doesn't exist yet on day one.
- **Re-add when:** email or batch ingestion ships (which is also a queue trigger, §2) — at that point nobody is present to attach the PO.

### 3. Fuzzy duplicate detection

- **What:** the 94%-similarity flagging on the Duplicate Detection page — same amount, same vendor, shifted invoice-number pattern.
- **Why cut:** fuzzy matching needs a similarity threshold that's tuned against real data, plus a false-positive review flow, plus its own screen — and that screen is out of scope. v1 does **exact duplicate detection only** (same vendor + same invoice number, or same vendor + same amount + same date), surfaced on the Detail sidebar's Duplicate Scan card.
- **Re-add when:** exact matching starts missing duplicates that reviewers catch by eye, or the Duplicate Detection page comes into scope.

### 4. Fraud / anomaly detection

- **What:** the `"SLA / Fraud Check"` stage in the submit animation, the Risk & Fraud tab on Vendor Profile, and vendor risk tiers.
- **Why cut:** it's a stage label in a fake progress bar with nothing behind it. Real anomaly detection needs a behavioural baseline across months of invoices — you can't build it before you have the data, and v1 is what generates the data.
- **Re-add when:** there are a few months of real reconciliation history to train a baseline against, and someone owns the false-positive rate.

### 5. Bounding-box PDF highlighting

- **What:** rendering the actual PDF in the comparison viewer with the mismatching field highlighted in place — what the component's own comment points at (*"In a real implementation, this would integrate react-pdf"*).
- **Why cut:** it needs per-field page coordinates from the Python extract response, plus a PDF renderer, plus coordinate-to-viewport math. Multi-day on its own. v1 renders the **extracted structured data** side by side, which is what the component already does and which is enough to resolve a price or quantity variance.
- **Re-add when:** reviewers say they don't trust the extracted values and want to see the source document. **Ask the Python team about `bbox` now anyway** — see open question #2, because if it needs re-extraction of history, that gets expensive later.

---

# 5. AMBIGUOUS — RESOLVE THIS WEEK

Carried over so they live in one place. Nothing new here.

## For the Python team (§Open questions)

| # | Question | Why it blocks |
|---|---|---|
| 1 | Can `/extract` return within ~45s for a typical multi-page scanned PDF? What's the p95? If not, do they return a job id? | Decides whether the sync-first design in §2 holds |
| 2 | Can the response carry per-field page coordinates (`bbox`)? If not now but maybe later — does that mean re-extracting historical documents? | Decides whether PDF highlighting is ever cheap (cut #5) |
| 3 | Do they handle CSV / XLSX / ERP JSON, or does Node parse structured formats itself and only send scans and PDFs to them? *(Our assumption: Node handles structured formats — it's a parser, not an OCR problem.)* | Decides the per-type `accepts` list in `DOC_TYPES` |
| 4 | Does Node tell them the document type, or do they detect it? *(Our assumption: Node tells them — the wizard already knows which step the user is on.)* | Decides the `/extract` request shape |
| 5 | **Does the response include line items, or only header fields?** | If header-only, 5-way matching cannot be built at all. Highest-stakes question on this list |
| 6 | Who owns the summary LLM call — Node, or a second Python endpoint? *(Our lean: Node, because it needs the mismatch rows and tolerances, which are Node's. Flip it if they already own the key and budget — but keep it separate from `/extract`.)* | Decides who builds `humanSummary` / `vendorMessage` |

Owner: ______  ·  Answer by: ______

## Internal — matching parameters (§7)

Matching params currently come from two places: the Settings screen, and the Review step of the upload wizard. Pick one home for each.

| Item | Current state | Decision needed |
|---|---|---|
| **`taxRate`** | Free-text field in the Review step, **defaults to `0`** — so every run today claims zero tax | Read it from the extracted invoice (it's on the document), or make it a setting. Not a free-text field defaulting to 0 |
| **`actualSla`** | Typed in by hand per run | Genuinely per-run, so keep it on the payload — but it should come from vendor data, not a human. Flag as a v1 shortcut |
| **`defaultMatchMode`** | Setting says `"4-way"`, wizard defaults to 3-way, setting has no UI | Set to `3-way`, give it a control, wizard reads it (§3.1) |
| **`tax` and `currency` tolerances** | In `MOCK_SETTINGS.tolerances`, no UI for either | `tax` gets a control; `currency` is dropped (single currency) |

Owner: ______  ·  Answer by: ______

## Internal — one thing to confirm before any other work

**Where does this router mount?** `routes/index.jsx` declares relative paths while every `navigate()` in the app is absolute (`/invoice-reconciliation/...`). That only works if the parent app mounts it with `basename="/invoice-reconciliation"`, and that parent isn't in this folder. If the basename isn't set, **every navigation in the app is broken** and the routes look fine in isolation. (§11)

Owner: ______  ·  Answer by: ______

---

# Sign-off

Agreeing to this doc means agreeing to:

- Five screens ship. Six stay demo-only with a visible badge.
- Single currency, no pagination, sync matching, no queue, no PDF rendering.
- Five named features are cut with a written re-add signal each.
- The definitions in §3 are the ones that go in the DB and the API — not whatever the mock data says.

| Name | Role | Agreed |
|---|---|---|
| | | |
| | | |
| | | |

*Basis: `02-ARCHITECTURE.md` (full read of `features/invoice-reconciliation/`, 37 files, ~4,160 lines). No new code analysis in this document.*
