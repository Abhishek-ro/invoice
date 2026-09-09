# 02 — Architecture

Written after reading every file in `features/invoice-reconciliation/` (37 files, ~4,160 lines).
Every point below traces to something in that folder or to one of the five v1 screens. Nothing generic.

---

## What is actually in the folder right now

Read this first, because most of the decisions below only make sense against it.

```
components/analytics/     6 files   (Analytics page only)
components/layout/        2 files   IRSidebar, ModuleShell
components/shared/        4 files   StatusBadge, DataGridViewer, DocumentComparisonViewer, ActivityTimeline
components/vendors/       7 files   (Vendor 360 page only)
context/                  1 file    AnalyticsFilterContext
data/                     3 files   mockData, mockAnalyticsData, mockVendorData
hooks/                    1 file    useCountUp  (a number animation, not a data hook)
pages/                   11 files
routes/                   1 file
styles/                   1 file
```

Three facts that shape everything:

**1. There is zero backend contact anywhere.** I grepped for `fetch(`, `axios`, `/api/`, `process.env`, `import.meta.env`, `useQuery`, `swr`. Nothing. The only `useEffect` in the whole feature is inside `useCountUp`, animating a number with `requestAnimationFrame`. Every page does `import { MOCK_X } from '../data/mockData'` at module scope and renders it. So there is no existing API client to conform to — but there *is* an implied API shape baked into the mock objects, and that shape has problems (section 3).

**2. Roughly half the code serves screens that are not in v1.** History, Vendor Intelligence, Vendor Profile (+6 tabs), Duplicate Detection, Analytics (+6 components), ERP Config come to ~2,100 lines. The five v1 screens map cleanly onto `Dashboard.jsx`, `NewReconciliation.jsx`, `ExceptionsQueue.jsx`, `ReconciliationDetail.jsx`, `MatchingRulesSettings.jsx`. This matters for the timeline: half the surface area does not need a backend, and shouldn't get one.

**3. `NewReconciliation.jsx` is the most finished thing here** — 433 lines, 12 `useState` calls, a dynamic step wizard, and a working extract-then-confirm step. It is also where the biggest structural problem is (section 4).

---

# Tier 1 — Decisions that block other work

## 1. The Node ↔ Python boundary
*(answers Q2)*

**Python owns exactly one thing: bytes in, structured JSON for that one document out.**

```
POST /extract
  { doc_id, document_type: "invoice"|"po"|"grn"|"service_entry"|"quality"|"contract",
    file_url }
  ->
  { doc_id, document_type,
    fields: { vendor_name, doc_number, doc_date, currency, subtotal, tax, total, po_ref, ... },
    line_items: [ { line_no, description, sku, quantity, uom, unit_price, line_total } ],
    confidence: 0-100,
    page_count, warnings: [] }
```

Python does **not**: touch the database, know about tolerances, compare two documents, decide a status, know what a reconciliation is, or hold state between calls. One document, one call, stateless, retry-safe.

**Node owns everything else**: file intake and storage, the reconciliation record, assembling the document set, normalizing extracted JSON into a canonical line-item model, **matching**, **tolerance evaluation**, confidence rollup, the decision (auto-approve / review / escalate / reject), status transitions, the audit log, settings CRUD, and every endpoint the five screens read.

### Why matching and tolerance live in Node, not Python

This isn't a preference, the existing code already assumes it:

- `MOCK_RECONCILIATION_DETAIL.mismatches[]` stamps each row with `tolerance_applied: "±2%"`. The UI *renders* the tolerance the engine applied — it doesn't compute it. So whatever produces `mismatches[]` owns tolerance.
- `MatchingRulesSettings.jsx` is a settings CRUD screen (price %, quantity units, date days, auto-approve confidence, auto-escalate variance). Those values have to be read at match time. Putting them behind a second service means a second config store, or Node shipping config into every Python call. Both are worse.
- Changing a tolerance slider must be able to **re-run matching without re-running extraction**. Extraction is the slow, expensive, non-deterministic part. Matching is arithmetic over JSON that's already in the DB. If matching sits in Python, every tolerance change drags OCR along with it.
- Practically: the Python team ships when they ship. If matching is on their side, your Settings screen, Exceptions queue and Detail page are all blocked on another team. Keep the blocking surface to one endpoint.

**One open question to settle with them, not to assume:** `humanSummary` and `vendorMessage` in `MOCK_RECONCILIATION_DETAIL` are LLM prose. Those are generated *after* matching, from the mismatch list. Either Node calls an LLM directly (simplest — it's a text-in/text-out call with no OCR involved), or you add `POST /summarize` to the Python service. My call: Node does it, because it needs the mismatch rows and the tolerances, which are Node's. If the Python team already owns the LLM key and budget, flip it — but keep it a separate endpoint from `/extract`, not a bolt-on to it.

---

## 2. Sync or async between Node and Python
*(answers Q3)*

**Recommendation: synchronous HTTP for both hops in v1. No queue, no webhooks, no polling infrastructure. Build one escape hatch and move on.**

### Hop A — extraction, during upload: synchronous

The upload screen already does this, one document at a time:

```js
// NewReconciliation.jsx, handleInvoiceUpload
setIsExtracting(true);
setTimeout(() => { setExtractedData({...}); setIsExtracting(false); }, 2000);
```

That's a single-document request with a spinner and a 2-second placeholder. Real latency for OCR + LLM structuring of a 1–3 page PDF is roughly 3–15 seconds; a scanned multi-page doc can hit 30s+. That fits inside a spinner the user is already staring at, having just clicked upload. It does not fit inside "upload 6 documents then wait", which is why extraction belongs at the per-document step where it already is, not batched at submit.

`POST /documents` (multipart) → Node writes the file → Node calls Python `/extract` with a **60s timeout** → Node persists the extracted JSON → returns it to the browser → the confirm form renders.

**The failure path is already built.** The confirm form is editable inputs bound to `extractedData`:

```jsx
<input type="text" value={val} onChange={(e) => setExtractedData({...extractedData, [key]: e.target.value})} />
```

So when Python times out or 500s, Node returns `{ status: "extraction_failed", fields: {} }` and the user types the fields in by hand. That is a real, shippable degraded mode you get for free. Do not build a retry queue for v1.

### Hop B — the reconciliation run: also synchronous

Matching runs over JSON that is already in the database. No network call, no OCR, no model. It is arithmetic and joins: single-digit to low-hundreds of milliseconds. `POST /reconciliations` can return the finished record.

Which means the 5-stage progress animation in `submitReconciliation` — `['Extracting', 'Matching Engine', 'Validating Allowances', 'SLA / Fraud Check', 'Finalizing Decision']` on an 800ms interval, ~4 seconds total — is **longer than the real work will take**. Keep the animation as a client-side flourish; don't build a job system to feed it.

### The escape hatch (build this, it's ~20 lines)

`POST /reconciliations` returns the record with a `status` field. If that status is `processing`, the frontend polls `GET /reconciliations/:id` every 1s until it isn't. In v1 the status is never `processing` — but the client-side handling exists, so switching matching to a background job later is a server-side change only, with no frontend rewrite.

**Move to a real queue when any of these becomes true** (none are true for v1):

- batch or email ingestion (many invoices at once, no user watching)
- the ERP fetch path in `renderDocStep` becomes real and the ERP is slow or rate-limited
- a tolerance change triggers a bulk re-match across thousands of historical invoices
- extraction consistently exceeds ~45s and the Python team can't bring it down

If the Python team insists on async on their side, the cheapest interop is them returning a job id and Node polling `GET /extract/:job_id`. Still no queue in Node. Push back on anything involving webhooks into Node for v1 — that means a public callback URL, auth on it, and out-of-order handling, none of which fits the timeline.

---

## 3. The reconciliation record shape, and the ID scheme
*(answers Q5 — the assumptions already baked into `data/`)*

There is no API client to conflict with, but the mock objects are a de-facto contract that the pages are written against. Several parts of it will hurt if you build the backend to match it literally.

### 3a. IDs — fix this before writing a single route

Three different identifiers are in play right now, and the code fakes conversions between them:

| Where | What it uses |
|---|---|
| `routes/index.jsx` | `/:id` |
| `Dashboard.jsx` | `navigate('/invoice-reconciliation/' + r._id)` → `6650a1` |
| `ExceptionsQueue.jsx` | `` navigate(`/...${row.invoice_id.replace('INV-', '6650a')}`) `` → `6650a1001` |
| `NewReconciliation.jsx` | `navigate('/invoice-reconciliation/INV-1001')` — hardcoded, and uses the invoice number, not `_id` |

The Exceptions row does a string substitution to invent a record id it doesn't have, and it produces `6650a1001`, which is not the mock's `6650a1`. The post-submit navigate goes somewhere else again. Three navigation paths to the Detail page, three incompatible id formats.

**Decision:** one `id` on the reconciliation record (UUID, or whatever the DB gives you) is the route param and the only thing used for navigation. `invoice_number` (`INV-1001`) is a human label — displayed, searchable, never used as a key. Every list endpoint returns both on every row so no screen has to invent one. Also note the `_id` naming implies Mongo; if the backend is Postgres, don't carry that name into the API just because the mock has it.

### 3b. `stageTraces` should be an array, not an object

```js
stageTraces: { "PO Match": {...}, "GRN Match": {...}, "Price Validation": {...}, ... }
```

`ReconciliationDetail.jsx` renders it with `Object.entries(...).map(...)` and relies on JS insertion order for the timeline. Two problems: a 3-way run has no GRN stage and no service-entry stage, so the key set varies per run; and display names as object keys means renaming a stage in the UI is a schema change.

**Make it:** `stages: [ { key: "grn_match", label: "GRN Match", status: "passed"|"warning"|"failed", detail, confidence, order } ]`. Ordering is explicit, stages can be absent per match mode, and the label is data.

### 3c. Three competing names for the same concept

The codebase already has three vocabularies for pipeline stages:

- `stageTraces` keys: `"PO Match"`, `"GRN Match"`, `"Price Validation"`, `"SLA Compliance"`, `"AI Decision"`
- `MOCK_DASHBOARD.pipelineStatus` labels: `"Invoice Ingestion"`, `"PO Matching"`, `"GRN Matching"`, `"Price Validation"`, `"AI Decision"`
- `mismatches[].stage`: `"Layer 1"`, `"Layer 2"`

Pick one set of stage keys in the backend and use it everywhere. Note that `pipelineStatus` on the Dashboard is a *system health* strip (`"Operational"` / `"Delayed"`), a completely different thing from per-invoice stages that happens to share the words — either rename it (`systemHealth`) or drop it from v1, because "is the GRN matcher up" is an ops question with no data source behind it yet.

### 3d. Line items are addressed two incompatible ways

- Mismatch rows use dotted field paths: `field: "line.unit_price"`
- `DocumentComparisonViewer` uses positional keys: `highlightFields={['line_0']}`

The Invoice Detail screen needs to highlight the mismatching line on both sides of the side-by-side compare. That can't work while the two halves address lines differently.

**Decide one canonical addressing scheme** — I'd use `{ line_no, field }` (e.g. `line_no: 1, field: "unit_price"`) since `line_no` survives reordering and PO/GRN line counts that differ from the invoice. Every mismatch row carries the line reference for *both* documents, because line 1 on the invoice is not necessarily line 1 on the PO.

Related: `DocumentComparisonViewer` is a mock renderer with its own hardcoded fallback data and a hardcoded `highlightFields={['line_0']}` on both panes. Its own comment says *"In a real implementation, this would integrate react-pdf."* For v1, rendering the **extracted structured data** side by side (which is what it does today) is the right call — actual PDF rendering with coordinate highlighting needs bounding boxes from the Python side and is a multi-day feature on its own. If you want it later, that's a `bbox` per field in the extract response; ask the Python team now whether they can emit it, so it doesn't become a re-extraction of every historical document.

### 3e. KPIs are pre-formatted strings

```js
kpis: { totalPayable: "$1,842,930", touchlessRate: { current: "42%", target: "85%" },
        avgProcessingTime: { current: "5.2 min", target: "<2 min" } }
```

Everything else in the mocks is a number (`invoice_total: 12350`, `total_variance: 0.45`) formatted at render time with `.toFixed(2)` / `.toLocaleString()`. If the API returns display strings for KPIs, the backend owns currency symbols and locale, nothing is sortable or comparable, and `"<2 min"` is unparseable.

**Return numbers plus a unit** (`{ value: 1842930, unit: "currency" }`), format in the Dashboard. This is a ~30-line change to `Dashboard.jsx`'s `KPI_LIST` and it should happen before the endpoint is written, not after.

### 3f. Other assumptions worth naming

- **Status enum** — `StatusBadge.jsx` is the canonical vocabulary: `touchless_approved`, `human_review`, `escalated`, `rejected`, `duplicate_flagged`. The backend must emit exactly these strings; anything else silently renders as `"Unknown"`. Write them down as a shared enum.
- **Confidence** is a 0–100 integer, and appears both per-record (`recentReconciliations[].confidence`) and per-stage (`stageTraces[x].confidence`). But `MOCK_RECONCILIATION_DETAIL` has **no top-level confidence field** — the Detail page shows only per-stage numbers while the list shows a record-level one. Add a top-level `confidence` to the record and define how it rolls up from the stages (min? the AI-decision stage? weighted?). That number gates auto-approval, so it can't be vague.
- **Exceptions carry precomputed age**: `ageLabel: "4h"`, `ageOld: false`. Don't return that. Return `created_at` and derive the label client-side — otherwise the label is stale the moment it's fetched, and the aging buckets can't be recomputed without a refetch. (The four aging tiles in `ExceptionsQueue.jsx` are hardcoded `1`s for the same reason.)
- **Two audit shapes, one component**: `notes[]` is `{author, text, timestamp}` and `overrideLog[]` is `{action, note, actor, timestamp}`. `ActivityTimeline` papers over it with `entry.author || entry.actor` and `entry.text || entry.note`. Normalize server-side to one shape with a `kind` field.
- **No user model exists anywhere.** `notes[].author` is the string `"P. Sharma"` and `overrideLog[].actor` is `"system"`. There is no auth, no current-user concept, no `actor_id`. Approve/reject/escalate is an audited action — it needs a real actor. Even if v1 auth is a stub, the record needs `actor_id` from day one or the audit log is worthless retroactively.
- **`duplicateCheck: { flagged, matches }`** is on the record, but the Detail sidebar ignores it and renders a static green "No matches found" box. Wire it or drop the field.
- **No pagination anywhere.** `DataGridViewer` takes full `rows` arrays, sorts in memory, and exports via SheetJS from the client. That's correct for v1 volume. It breaks somewhere around a few thousand rows — at which point sort, filter and export all have to move server-side together. Not a v1 problem; just don't design the API to make it impossible (keep `limit`/`offset` in the query signature from the start even if you always return everything).

---

## 4. End-to-end trace of one invoice
*(answers Q1)*

Concrete, in order, given the decisions above. This is the physical-goods 3-way path (invoice + PO + GRN), which is what `NewReconciliation.jsx` defaults to (`matchParams = { po: true, grn: true, ... }`).

```
 BROWSER                    NODE API                 PYTHON SVC        STORE
────────────────────────────────────────────────────────────────────────────
 1  drop invoice PDF
    POST /documents  ───────►
                            2 write file  ─────────────────────────►  S3/disk
                            3 insert documents row ───────────────►  Postgres
                            4 POST /extract  ────────►
                                                     5 OCR + structure
                                             ◄──────── fields+line_items
                            6 persist extracted JSON ─────────────►  Postgres
    ◄──────────────────────── 200 { document_id, fields, line_items }
 7  confirm/edit fields
    PATCH /documents/:id ──►  8 overwrite fields, mark confirmed ─►  Postgres

 9  pick match strategy (PO + GRN)  [client state only, no call]

10  upload PO   → steps 1-8 again with document_type="po"
11  upload GRN  → steps 1-8 again with document_type="grn"

12  click "Run AI Reconciliation"
    POST /reconciliations ─►
      { document_ids[], match_mode, tax_rate, actual_sla }
                           13 load the 3 docs + tolerance settings
                           14 normalize line items to canonical model
                           15 MATCH (all in Node, no network):
                                invoice↔PO   price, qty, dates, PO validity
                                invoice↔GRN  received qty vs billed qty
                                price vs contract rate
                                duplicate scan vs prior invoices
                           16 apply tolerances → mismatches[] each stamped
                              with the tolerance that was applied
                           17 roll up confidence → decide status:
                                conf ≥ autoApproveConfidence  → touchless_approved
                                |variance| > autoEscalateVariance → escalated
                                any mismatch outside tolerance → human_review
                                duplicate hit → duplicate_flagged
                           18 generate humanSummary + vendorMessage (LLM)
                           19 insert reconciliation + stages + mismatches ─► Postgres
    ◄──────────────────────── 201 { id, status, ... }
20  navigate to /:id

── reviewer, later ─────────────────────────────────────────────────────────
21  Exceptions queue
    GET /exceptions ───────►  22 select where status in (human_review, escalated)
    ◄──────────────────────── rows { id, invoice_number, vendor, total,
                                     variance, reason, created_at }
23  click Review → GET /reconciliations/:id
                          24 record + stages + mismatches + doc snapshots
    ◄────────────────────────
25  side-by-side compare, reads mismatches[]
26  click Approve / Reject / Escalate
    POST /reconciliations/:id/decision ─►
      { action, note }   27 validate transition, write status
                         28 append audit_log row (actor_id, action, note, ts)
    ◄──────────────────────── 200 { status, audit_log[] }
29  invalidate the exceptions + dashboard caches, badge count drops
```

**Systems touched, in order:** React → Node API → object store → Postgres → Python extract service → Postgres → (user confirm) → Node → Postgres → Node matching engine → LLM → Postgres → React → Node → Postgres → React.

Two things worth noticing in that trace:

- **Python is touched once per document, during upload, and never again.** It is not in the reconciliation run path at all. That's what makes the run fast enough to be synchronous, and it's what lets a tolerance change re-run matching for free.
- **Steps 9 and 12 are where the ERP path would slot in.** `renderDocStep` already has a "Fetch from ERP" source that fakes a 1.5s call. When that becomes real, it replaces steps 10–11 with a `GET /erp/po?ref=...` and the extraction hop disappears for those documents (ERP gives you structured data already). Design `documents` so a row can have `source: "upload" | "erp"` and a null file path. This is cheap now and expensive later.

---

# Tier 2 — Conflicts between what's coded and what v1 needs

## 5. The upload flow only extracts the invoice
*(answers Q6 — this is the biggest single piece of rework)*

**Short answer: the wizard shell is built for reuse. The extract-then-confirm step is not — it exists only for Invoice.**

What *is* reusable, and genuinely well done:

- `docStates` is a keyed map, so per-document state is uniform
- `dynamicSteps` is built by pushing based on `matchParams`, so the step list already varies per match mode
- `renderDocStep(docId, title, desc, targetRefText)` is one parameterized renderer that handles all five supporting doc types
- both upload sources (manual / ERP) are handled generically inside it

What breaks the moment PO or GRN needs the same extract-then-confirm treatment:

1. **Extraction is hardcoded to the invoice.** `handleInvoiceUpload` sets `isExtracting` → `extractedData`, and those are two top-level `useState`s, not per-document. `handleDocUpload` just does `updateDoc(docId, { file })` — attach and move on. There is no extraction, no confirm form, no editable fields for PO/GRN/anything else.
2. **The confirm UI is inline JSX inside the `currentStep.id === 'invoice'` block**, ~60 lines, not a component. `renderDocStep` can't call it.
3. **`docStates` has no slots for it** — `{ source, file, fetched, fetching }` and nothing for `extracting`, `extracted`, `confirmed`, `extractionError`.
4. **`fileRefs` is five separate `useRef()` calls in an object literal.** It works today because the literal is fixed. The moment someone builds it dynamically (`docTypes.map(() => useRef())`) it violates the rules of hooks and breaks in a way that's annoying to debug. Use a single `useRef({})` keyed by doc id.
5. **Adding a sixth document type means editing four places** plus adding a `renderDocStep` line: `matchParams`, the `dynamicSteps` push chain, `docStates`, `fileRefs`. That's a config array's job.
6. **PDF-only guard**: `handleFileUpload` rejects anything not `.pdf`. Real POs and GRNs arrive as CSV, XLSX and ERP JSON far more often than invoices do. Accepted file types need to be per-document-type.
7. **`extractedData` is a flat 4-field object** (`vendor`, `invoice_id`, `po_ref`, `amount`) rendered with `Object.entries().map()`. Real extraction returns nested line items. The confirm step has to show and edit a line-item table, not four text inputs — and that table is shared by every document type.

### The rework, concretely

Replace the five hardcoded blocks with a config array:

```js
const DOC_TYPES = {
  invoice:      { label: 'Invoice',            accepts: ['.pdf'],                 extract: true,  required: true },
  po:           { label: 'Purchase Order',     accepts: ['.pdf','.csv','.xlsx'],  extract: true,  erp: true },
  grn:          { label: 'Goods Receipt',      accepts: ['.pdf','.csv','.xlsx'],  extract: true,  erp: true },
  quality:      { label: 'Quality Insp.',      accepts: ['.pdf'],                 extract: true },
  service_entry:{ label: 'Service Entry',      accepts: ['.pdf','.xlsx'],         extract: true,  erp: true },
  contract:     { label: 'SLA / Contract',     accepts: ['.pdf'],                 extract: false },
};
```

Then one `<DocumentStep type={...} />` component that does upload → extract → confirm for any type, and `dynamicSteps` derived from `Object.keys(DOC_TYPES).filter(k => matchParams[k])`. The invoice becomes just the first entry with `required: true`, not a special case.

**Do this before wiring the backend, not after.** Right now it's a self-contained refactor of one file with no network code in it. After you've wired six API calls into the invoice-only path, it's the same refactor plus untangling six call sites.

**Also rename `timesheet` → `service_entry` while you're in there.** The state key is `timesheet`, the label says "Service Entry Sheet / Timesheet", and the domain calls it a Service Entry / Milestone doc. Three names for one thing, and the state key is the one that'll end up in the API.

## 6. The status filter on Dashboard and History is broken

```js
// Dashboard.jsx and ReconciliationHistory.jsx, same logic
filtered = raw.filter(r => r.status.replace('_',' ').toLowerCase().includes(filter.toLowerCase()));
// filter chips: ['All', 'Auto-Approved', 'Human Review', 'Rejected']
```

`touchless_approved` → `"touchless approved"`, which does not contain `"auto-approved"`. The Auto-Approved filter returns an empty table. Human Review and Rejected happen to work by coincidence of wording.

This is what happens when display labels are used as filter values. Filter on the enum (`touchless_approved`), render the label from `StatusBadge`'s map — which already exists and is already the single source of truth for status → label.

## 7. Tolerance inputs are split across two screens and neither persists

- `MatchingRulesSettings.jsx` holds tolerances in `useState(MOCK_SETTINGS.tolerances)` with a Save button that does nothing, and a banner admitting it: *"Settings are saved to local state only in this demo environment."*
- The Review step of `NewReconciliation.jsx` separately collects `taxRate` and `actualSla` as per-run inputs.

So matching parameters come from two places, and one of them is a per-run override of something the Settings screen thinks it owns. Decide which:

- **Tolerances** (price %, qty units, date days, tax %, currency %) → org-level settings, `GET/PUT /settings/tolerances`, read at match time.
- **`actualSla`** → genuinely per-run (it's this vendor's measured performance this period), keep it on the run payload. Though realistically it should come from vendor data, not a human typing it in — flag it as a v1 shortcut.
- **`taxRate`** → ambiguous. It defaults to `0`, which means every run currently claims zero tax. Either read it from the extracted invoice (it's on the document) or make it a setting. Don't leave it as a free-text field defaulting to 0.

Two more gaps in the same file:

- `MOCK_SETTINGS.tolerances` has **five** keys (`price`, `quantity`, `tax`, `dateDays`, `currency`); the Settings screen renders **three**. `tax` and `currency` have no UI. Either add the controls or drop them from the model.
- `MOCK_SETTINGS.defaultMatchMode` is `"4-way"`, but `NewReconciliation` defaults `matchParams` to PO + GRN only — a 3-way run. The setting exists, has no UI, and contradicts the actual default. Pick one and make the wizard read it.

Also settle the **"N-way" vocabulary** now, because `MOCK_OPERATIONAL.matchTypeBreakdown` reports on `3-Way / 4-Way / 5-Way` and nothing defines them. Invoice + PO + GRN = 3-way is the standard reading (the invoice counts). Write it down, because "5-way matching" is in the product name and people will ask.

## 8. Approve / Reject / Escalate does not exist

The three buttons in `ReconciliationDetail.jsx`'s header have classes and no `onClick`. The bulk actions in `ExceptionsQueue.jsx` are styled `cursor: 'not-allowed'` with grey text. The Exceptions row action is just "Review" — it navigates.

This is the core loop of the Exceptions screen and it's 0% built. It needs: a decision endpoint, a status state machine (which transitions are legal — can an `escalated` record be approved? by whom?), an actor, an audit append, a required note on reject/escalate, and cache invalidation so the sidebar badge and the Dashboard KPIs update. Budget real time for it; it's more work than it looks because of the audit and permissions side, not the button.

While you're there: `IRSidebar` badges are hardcoded `badge: 4` and `badge: 1`. They need the live open-exception and open-duplicate counts.

## 9. Detail and Profile pages ignore their route params

```js
const { id } = useParams();
const d = MOCK_RECONCILIATION_DETAIL;   // id unused
```

Same in `VendorProfile.jsx`, which is honest enough to say so in a comment. Trivial to fix once there's an endpoint, but it means **every deep link in the app is currently unverified** — nothing has ever navigated to a specific record and got that record back. Expect the id/route bugs in 3a to surface all at once here.

Related dead wiring: `ModuleShell`'s global search navigates to `/history?q=...`, and `ReconciliationHistory` never reads `useSearchParams` — it has its own local search box. The global search does nothing.

---

# Tier 3 — Structural decisions with no existing code either way

## 10. Frontend state
*(answers Q4)*

### Audit of `context/`

There is exactly one context: `AnalyticsFilterContext.jsx`. Findings:

- It is provided **inside** `AnalyticsReports.jsx`, not at the app root. Its scope is one page.
- That page is **not one of the five v1 screens**.
- It holds analytics filter UI state (`dateRange`, `status[]`, `vendors[]`, `amountRange`, `savedViews`) — presentation state for charts, nothing about reconciliations.
- Its `isUpdating` flag is theatre: `setIsUpdating(true)` then `setTimeout(() => setIsUpdating(false), 150)`. It fakes a loading shimmer for data that never loads.
- Its consumers multiply mock numbers by a fudge factor: `const dateScale = filters.dateRange === 'Today' ? 0.05 : ...` in `OperationalOverviewTab` and `CfoDashboardTab`.

**Verdict: it is not insufficient for the five v1 screens — it is irrelevant to them.** None of the five import it. Leave it exactly where it is, scoped to the Analytics page, and don't promote it to app level. When Analytics gets real data, `filters` becomes a query key and the fudge-factor code deletes itself.

### What the five v1 screens actually need

Almost nothing shared. Look at what crosses screen boundaries:

| Data | Screens | Shared? |
|---|---|---|
| Reconciliation list | Dashboard, Exceptions | Same server data, different filters |
| Open exception count | Sidebar badge, Dashboard KPI, Exceptions header | Same number in three places |
| One reconciliation | Detail | Single screen |
| Tolerance settings | Settings | Single screen (matching reads them server-side) |
| Upload wizard state | Upload | Single screen, dies on navigate |

The only genuinely shared things are **server data that appears on more than one screen** — which is a caching problem, not a state-management problem.

**Recommendation: TanStack Query for server data, `useState` for form state, no global store, no new context.**

- The exception count appears in three places; one query key, three components reading the same cache entry, one invalidation after a decision. A Redux/Zustand store would make you write that invalidation by hand.
- `isUpdating`, `isExtracting`, `isFinalizing` and the fake loading states all become real `isLoading` / `isPending` for free.
- It's one dependency and no architecture. On a days-long timeline that matters more than purity.

If the team refuses another dependency, the fallback is a single `ReconciliationDataContext` holding the list + counts with a manual `refetch()`. It works, it's maybe 80 lines, and it will slowly grow into a bad cache. Say so out loud before choosing it.

### The one place that does need restructuring

`NewReconciliation.jsx` has **12 `useState` calls** in one component: `stepIndex`, `error`, `invoiceFile`, `isExtracting`, `extractedData`, `matchParams`, `docStates`, `taxRate`, `actualSla`, `isFinalizing`, `processStage`, plus six `useRef`s. Once every document type gets its own extraction state (section 5), that becomes ~20 pieces of state with real interdependencies (can't advance a step while extracting; can't submit while any doc is unconfirmed).

Move it to a single `useReducer` with one wizard state object and named actions (`FILE_SELECTED`, `EXTRACT_STARTED`, `EXTRACT_SUCCEEDED`, `EXTRACT_FAILED`, `FIELDS_EDITED`, `STEP_ADVANCED`). Same file, no new dependency, and step-validity becomes a derived function instead of a boolean expression inlined in a `disabled` prop. This is a v1 requirement, not cleanup — it's a precondition for doc-type parity.

## 11. Routing

Current state: `routes/index.jsx` declares relative paths (`/`, `/new`, `/exceptions`, `/:id`) while every `navigate()` in the app is absolute (`/invoice-reconciliation/...`). That only works if the router is mounted with `basename="/invoice-reconciliation"` by the parent app — which isn't in this folder. **Confirm where this mounts before anything else**, because if the basename isn't set, every navigation in the app is broken and the routes look fine in isolation.

Two calls to make:

- **`/:id` as a catch-all is fragile.** It sits last so static routes win, but any future top-level route silently becomes a record id if it's added below it. Use `/reconciliations/:id`. Cheap now.
- **Scope: 6 of the 11 pages are not in v1** (History, Vendor Intelligence, Vendor Profile, Duplicate Detection, Analytics, ERP Config) — about half the codebase. Don't delete them; they're good demo surface. But mark them clearly as mock-only so nobody wires an endpoint to them by accident, and keep them out of the sidebar's primary section, or out of the sidebar entirely for v1. `ModuleShell` already renders a **"Demo Data"** badge — make that badge conditional per route (real / mock) instead of always-on, and it becomes an honest signal instead of decoration.

## 12. File storage

Nothing in the codebase says anything about this, so it's a free choice. For the timeline: local disk behind a Node static route is fine for v1 and takes minutes; S3-compatible storage takes an afternoon and saves you the migration. Either way the `documents` row stores a URI, and Python receives a **URL, not base64** — sending PDFs through JSON round-trips memory twice and caps you at whatever body-size limit you forget to raise.

---

# Tier 4 — Reasonable defaults, low risk either way

- **Pagination**: skip it. `DataGridViewer` sorts and exports client-side; v1 volumes don't need it. Keep `limit`/`offset` in the query signature so adding it later isn't a breaking change.
- **Age labels**: return `created_at`, derive `"4h"` / `ageOld` in the frontend. Same for the four aging tiles.
- **Currency**: `$` is hardcoded in ~15 places while filters and tolerances both have a `currency` field. Single-currency for v1 is fine — just don't ship the currency filter pretending it does something.
- **Excel export**: SheetJS client-side already works. Leave it. Server-side export only matters once the grid stops holding all the rows.
- **`useCountUp`**: harmless, no cleanup on unmount (the `requestAnimationFrame` loop keeps going after the component dies). One-line fix, not urgent.
- **`DataGridViewer` prop bug**: `VendorIntelligence` passes `exportFilename`, the component's prop is `filename`. Out of v1 scope but it's a real bug sitting there.
- **Sorting types**: `DataGridViewer` sorts raw values, so `mismatchRate: "18%"` sorts as a string. Return numbers, format in `render`.
- **Auth**: stub it, but put a real `actor_id` on every audit row from day one (see 3f).

---

# Open questions for the Python team

Ask these this week — the answers change the contract, and the contract is what everything else waits on.

1. **Sync or job-based?** Can `/extract` return within ~45s for a typical multi-page scanned PDF? If not, what's the p95, and do they return a job id?
2. **Bounding boxes.** Can the response carry per-field page coordinates? If it can't now but might later, does re-extraction of historical documents become necessary? (Affects whether the side-by-side compare can ever show the real PDF.)
3. **Non-PDF inputs.** POs and GRNs often arrive as CSV/XLSX/ERP JSON. Do they handle those, or does Node parse structured formats itself and only send scans/PDFs to them? (My assumption: Node handles structured formats directly — it's a parser, not an OCR problem.)
4. **Document type detection.** Does Node tell them the type, or do they detect it? (My assumption: Node tells them — the wizard already knows which step the user is on.)
5. **Line items.** Does the response include line items, or only header fields? Everything about matching depends on line items. If they only return header fields, 5-way matching cannot be built.
6. **Who owns the summary LLM call** — Node or a second Python endpoint? (See section 1.)

---

# Suggested build order

Given days, not weeks, and that the contract blocks everything:

1. Lock the Node↔Python contract (§1, §2) and the record shape + IDs (§3). One page, agreed with both teams, before code.
2. Refactor `NewReconciliation.jsx` to `DOC_TYPES` + `useReducer` (§5, §10) while it's still network-free.
3. Node: documents endpoints + `/extract` passthrough, with the manual-entry fallback. Upload screen goes real.
4. Node: matching engine + tolerances + settings CRUD. Settings screen goes real.
5. Node: `POST /reconciliations` (sync, with the `processing` escape hatch). Detail screen goes real.
6. Node: exceptions list + decision endpoint + audit. Exceptions screen goes real — this is the piece that's furthest from done (§8).
7. Dashboard last: its KPIs are aggregates over data that only exists once 3–6 are shipped, and it needs the numeric-KPI change (§3e).

Note that the Dashboard is the screen with the most existing code and the least real backing — it's tempting to start there because it looks finished. It should be last.

---

*Basis: full read of `features/invoice-reconciliation/` — 37 files, ~4,160 lines. No other source consulted; this codebase is treated as the only source of truth.*
