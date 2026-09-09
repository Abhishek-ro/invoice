# 04 — API Contract

Turns `01-SCOPE.md`, `02-ARCHITECTURE.md` and `03-DATA-MODEL.md` into wire format. Nothing here re-opens those.
Where 02 said "assumption", this document says "contract" — that's the whole point of it existing.

Two parts:

- **Part A** — Node ↔ Python. One endpoint. This is the part you hand to the Python team.
- **Part B** — Frontend ↔ Node. One section per v1 screen, in 03's build order (Upload → Settings → Detail → Exceptions → Dashboard).

**Nine things this document had to decide** that 01–03 left open — §E. **Six things marked `[NEEDS CONFIRMATION]`** — §F. Read those before you object.

---

# §0 — Conventions (both parts)

- **Base path: `/api/v1`.** Every path in Part B is relative to it. This was never picked anywhere; picking it here. Note it is *not* the frontend's `basename` (`/invoice-reconciliation`, 02 §11) — different thing, don't collapse them.
- **JSON everywhere**, `Content-Type: application/json`, except `POST /documents` which is `multipart/form-data`.
- **Money is a JSON number with 2 decimals** (`12350.00` → serialises as `12350`). Quantities and unit prices carry 4 (`03 §Conventions`). Never a formatted string — same rule as KPIs (02 §3e).
- **Timestamps are ISO 8601 with offset**, `2026-08-14T09:12:44.318Z`. Dates without a time (`documents.doc_date`) are `YYYY-MM-DD`.
- **`id` is a uuid string** and the only thing used as a route param (02 §3a). `invoice_number` never appears in a path.
- **No labels in any response.** Status labels, stage labels and the `"3-way"` string are all rendered from frontend maps (01 §3.2, §3.3, §3.1). The API returns enum values and counts.
- **No pagination in v1, but `limit` and `offset` are accepted and ignored-if-absent on every list endpoint** (01 §Cross-cutting). Defaults: `limit=1000`, `offset=0`. Adding real paging later is not a breaking change.
- **Every mutating request carries the actor**, as two headers:

  ```
  X-Actor-Id:   u_dev_stub
  X-Actor-Name: P. Sharma
  ```

  `audit_log.actor_id` and `actor_name` are both `not null` (03 §9) and there is no user model (02 §3f). In v1 the frontend hardcodes these; when auth lands they come from the session and the headers are dropped. A mutating request missing either header is `400 malformed_request` — fail loudly now, or the audit log is worthless retroactively.

## The error body — defined once, used by every endpoint in Part B

```json
{
  "error": {
    "code": "illegal_transition",
    "message": "Cannot approve a record that is already rejected.",
    "details": { "from_status": "rejected", "action": "approve", "allowed_actions": [] }
  }
}
```

- `code` — machine-readable, from the table below. The client switches on this, never on `message`.
- `message` — one sentence, safe to show a user.
- `details` — optional, shape depends on `code`. Absent when there's nothing useful to add.

No endpoint defines its own error envelope. No endpoint returns a bare string. No endpoint returns `200` with an error inside it — **except the one documented exception in §A.4**, which is a shipping path, not an error.

| `code` | HTTP | When |
|---|---|---|
| `malformed_request` | 400 | Unparseable body, missing actor headers, bad uuid in a path |
| `not_found` | 404 | No row with that id |
| `illegal_transition` | 409 | Decision endpoint, transition not in §C |
| `document_already_used` | 409 | A `document_id` already has a row in `reconciliation_documents` |
| `duplicate_document_type` | 409 | Two documents of the same type in one `POST /reconciliations` (03 §6 unique constraint) |
| `unsupported_file_type` | 415 | Extension/MIME not in that type's `accepts` list (01 §Upload) |
| `validation_failed` | 422 | Field-level validation. `details.fields` is `{ field_name: "reason" }` |
| `note_required` | 422 | Reject or escalate without a note (01 §Exceptions, 03 §9 check constraint) |
| `missing_invoice_document` | 422 | `POST /reconciliations` with no `invoice` document (03 §6 — Node enforces this, the DB can't) |
| `document_not_confirmed` | 422 | A submitted document has `confirmed_at is null` |
| `internal_error` | 500 | Node fault. **Python being slow or down is never one of these** — see §A.4 |

---

# PART A — Node ↔ Python

## §A.1 — Four things that are now contract, not assumption

02 listed six open questions. Four of them change the shape of this request. Answering them here so the Python team gets a spec, not a conversation.

**1. Node sends `document_type`. Python does not detect it.** (02 open question #4)

The wizard knows which step the user is on before the file is picked (`renderDocStep(docId, ...)`, 02 §5). Detection would be Python re-deriving something Node already knows for certain, and a detection disagreement would silently produce a PO extracted as an invoice. Python treats `document_type` as an input, uses it to pick its prompt/model path, and **echoes it back unchanged**.

If Python's own detection disagrees with what Node sent, it does **not** override — it appends `{"code": "document_type_mismatch", "detail": "looks like grn"}` to `warnings` and extracts as told. Node logs it and moves on. Nothing in v1 reads that warning.

**2. Node handles CSV / XLSX. Python only ever receives PDFs and image scans.** (02 open question #3)

01 §Upload gives POs and GRNs `accepts: ['.pdf','.csv','.xlsx']`. Structured formats are a parsing problem, not an OCR problem — Node parses them itself into the same internal shape and **never calls `/extract` for them**. Those documents land in the DB with `extraction_status = 'extracted'`, `extraction_confidence = 100`, and `raw_extraction` holding the parsed rows.

Practical consequence for the Python team: **you never need CSV or XLSX support.** If you already have it, we're not using it in v1.

**3. `line_items` is required in the response.** (02 open question #5 — the highest-stakes one)

See §A.5 for the full rule and for what Node does when it comes back empty anyway.

**4. No `bbox`.** (02 open question #2, 01 cut #5)

Not requested, not stored as columns. If Python emits per-field coordinates anyway they land in `documents.raw_extraction` for free (03 §2) and cost nothing. **Still worth asking whether it's possible later**, because if it needs re-extraction of history it gets expensive — but it does not change this contract.

Not in this contract at all: `POST /summarize`. `human_summary` and `vendor_message` are generated in Node (02 §1). If the Python team wants to own the LLM call, that's a separate endpoint and a separate conversation — it does not bolt onto `/extract`.

## §A.2 — Request

```
POST {PYTHON_BASE}/extract
Content-Type: application/json
```

```json
{
  "doc_id": "9f4c1a2e-6b30-4f7a-9c11-2d8e5a7b0c33",
  "document_type": "invoice",
  "file_url": "https://storage.internal/inv/9f4c1a2e.pdf"
}
```

| Field | Type | Notes |
|---|---|---|
| `doc_id` | uuid string | The value of `documents.id`. Named `doc_id` because 02 §1 fixed it; Node's own REST calls the same value `id`. Opaque to Python — echo it back, don't parse it. |
| `document_type` | `document_type` domain | One of `invoice`, `po`, `grn`, `service_entry`, `quality`, `contract` (03 §1). **`contract` never actually arrives** — 01 gives it `extract: false` and Node skips the call. It's in the enum because the enum is the enum. |
| `file_url` | string | A URL Python fetches. **Not base64** (02 §12 — JSON round-trips the bytes through memory twice). Node guarantees it is reachable from Python for at least the 60s window. |

Stateless. No auth token in v1 (service-to-service on a private network) `[NEEDS CONFIRMATION — see §F.1]`. Retry-safe: the same `doc_id` may be sent twice and Python must not care.

## §A.3 — Response

`200 OK`. Field names are the `documents` and `line_items` column names from 03 §2 and §3 — not 02's sketch, which said `tax` where the column is `tax_amount`.

```json
{
  "doc_id": "9f4c1a2e-6b30-4f7a-9c11-2d8e5a7b0c33",
  "document_type": "invoice",
  "confidence": 91,
  "page_count": 2,
  "fields": {
    "vendor_name": "Meridian Components Ltd",
    "doc_number": "INV-1001",
    "doc_date": "2026-08-14",
    "po_ref": "PO-88213",
    "subtotal": 11500.00,
    "tax_amount": 850.00,
    "total": 12350.00,
    "currency": "USD"
  },
  "line_items": [
    {
      "line_no": 1,
      "description": "Hex bolt M8x40, zinc",
      "sku": "HB-M8-40Z",
      "quantity": 200.0000,
      "uom": "EA",
      "unit_price": 61.0500,
      "line_total": 12210.00
    }
  ],
  "warnings": []
}
```

### `fields` — exactly these keys, no others promoted

| Key | Type | Maps to |
|---|---|---|
| `vendor_name` | string \| null | `documents.vendor_name` |
| `doc_number` | string \| null | `documents.doc_number` — the invoice number on an invoice, the PO number on a PO. One key, not six. |
| `doc_date` | `YYYY-MM-DD` \| null | `documents.doc_date` |
| `po_ref` | string \| null | `documents.po_ref` |
| `subtotal` | number \| null | `documents.subtotal` |
| `tax_amount` | number \| null | `documents.tax_amount` — **not `tax`**, 02 §1's sketch was wrong against 03 §2 |
| `total` | number \| null | `documents.total` |
| `currency` | 3-letter code \| null | `documents.currency`. Always `"USD"` in v1 (01 §Cross-cutting). Return what's on the document; Node ignores anything else. |

- **`null` is the correct answer for a field that isn't on the document.** A GRN has no `tax_amount`. Don't send `0`, don't send `""` — Node cannot tell an absent tax from a zero tax, and 01 §5 already flags that every run currently claims zero tax.
- **Anything else Python extracts goes nowhere and that's fine.** The whole response body is persisted verbatim to `documents.raw_extraction` (03 §2), so extra keys are kept for free and can be promoted to columns later without re-extraction. Do not ask for a column to be added; just send it.

### `line_items` — exactly these keys

| Key | Type | Maps to |
|---|---|---|
| `line_no` | integer ≥ 1 | `line_items.line_no`, **1-based, as printed on the document**. This is the `line_no` in the `{line_no, field}` addressing (02 §3d, 03 §3). It must be stable across re-extractions of the same file. |
| `description` | string \| null | `line_items.description` |
| `sku` | string \| null | `line_items.sku` |
| `quantity` | number \| null | `line_items.quantity` |
| `uom` | string \| null | `line_items.uom` |
| `unit_price` | number \| null | `line_items.unit_price` |
| `line_total` | number \| null | `line_items.line_total` |

- `line_no` must be **unique within the response** — 03 §3 has `unique (document_id, line_no)` and Node's insert will blow up on a duplicate.
- Do not renumber, sort, or drop lines to make them tidy. Line 1 on the invoice is not line 1 on the PO, and the matcher depends on that being true (02 §3d).

### `confidence`, `page_count`, `warnings`

- `confidence` — integer 0–100 (03 §1 `confidence_score`). Document-level. Node stores it as `documents.extraction_confidence`. **It is not the same number as `reconciliations.confidence`**, which is a MIN over match stages (03 §Confidence rollup) and has nothing to do with OCR quality.
- `page_count` — integer, or `null` for non-paginated input.
- `warnings` — array, may be empty, never absent. Each entry `{ "code": "...", "detail": "..." }`. Codes are advisory; nothing in v1 branches on them. `[NEEDS CONFIRMATION — see §F.2]`

## §A.4 — Timeout and failure — what Node does

**Node's timeout on this call is 60 seconds** (02 §2). Not configurable per document type in v1.

The upload endpoint's contract with the browser is: **`POST /documents` returns `201` whether extraction worked or not.** Extraction failure is not an API error, it's a degraded path that 01 §Cross-cutting calls "a shipping path, not an error screen". The confirm form's editable inputs are the fallback and they already exist (02 §2).

| What Python does | `documents.extraction_status` | `extraction_error` | Node's response to the browser |
|---|---|---|---|
| `200` with a valid body | `'extracted'` | `null` | `201`, fields + line items populated |
| `200` with a body that fails schema validation | `'failed'` | `"invalid response schema: <detail>"` | `201`, `fields` all-null, `line_items: []` |
| `4xx` / `5xx` | `'failed'` | `"python /extract returned 502"` | `201`, `fields` all-null, `line_items: []` |
| No response inside 60s | `'failed'` | `"python /extract timed out after 60000ms"` | `201`, `fields` all-null, `line_items: []` |
| Connection refused / DNS | `'failed'` | `"python /extract unreachable: ECONNREFUSED"` | `201`, `fields` all-null, `line_items: []` |

In all four failure rows: `extracted_at` stays `null`, `extraction_confidence` stays `null`, `raw_extraction` holds whatever came back (including the error body — it's diagnostics you'll want).

**Note the enum value.** 02 §2 wrote `{ status: "extraction_failed" }`. The column's check constraint is `'failed'` (03 §2). **`'failed'` wins** — 03 is the data model and the API must not carry a fifth spelling. The browser reads `extraction_status === "failed"` and renders the empty confirm form.

**No retry, no retry endpoint, no queue.** (02 §2 — "Do not build a retry queue for v1.") The user's recovery path is: type the fields in, hit confirm, the document flips to `'manual'` (§B.1.2). If they'd rather re-run OCR, they re-upload the file — which creates a **new** `documents` row. The old one is orphaned and the nightly cleanup takes it (03 §2).

**Node never surfaces a Python failure as a 5xx to the browser.** If you find yourself writing a `502` handler in the frontend, something has gone wrong with this contract.

## §A.5 — Line items, and the header-only case

**Contract: `line_items` is a required key. It is always an array. It may be empty.**

An absent `line_items` key is a schema violation → the `'failed'` path in §A.4, same as a 500. Send `[]`, not nothing.

An **empty** array is legal and is not an extraction failure — some documents genuinely have no lines. `extraction_status` stays `'extracted'` and Python appends `{"code": "no_line_items"}` to `warnings`.

### What Node does with a header-only document

01 §5 put it starkly: *"If header-only, 5-way matching cannot be built at all."* That's true of the **capability**. It is not true of an individual run, and failing the reconciliation would mean a user who uploaded six documents gets an error and no record — which is worse than a partial answer.

**Matching degrades. The reconciliation does not fail.** Concretely:

1. **Line-scoped comparison is skipped** for any document pair where either side has no lines. No `mismatches` rows with `scope = 'line'` are written for that pair.
2. **Header-scoped comparison still runs** — `subtotal`, `tax_amount`, `total`, `doc_date`, `po_ref`, `vendor_name` are all on `documents` and all in the `matchable_field` domain (03 §1). A total-vs-total variance is still a real finding.
3. **The affected stage is written with `status = 'warning'`**, not `'passed'` and not `'skipped'`. `'skipped'` means the stage wasn't in the match set (03 §7); this stage *was* in the match set and ran on less data than it should have. `stages.detail` says so: `"line comparison skipped: PO has no line items"`.
4. **The stage's `confidence` is capped at 60.** Because confidence rolls up as MIN (03 §Confidence rollup) and the auto-approve gate defaults to 90, this makes a header-only run **structurally incapable of auto-approving**. That's the point: 01's stated bias is that being too strict costs a reviewer a click and being too loose costs a wrong payment.
5. **If the *invoice itself* has no line items, nothing line-level is possible at all.** Every match stage degrades, `price_validation` gets `'warning'` with confidence 60, and the record lands in `human_review` by the same MIN rollup. Still a record, still reviewable, still auditable.

`[NEEDS CONFIRMATION — see §F.3]` on the cap value of 60.

**What this is not:** it is not permission for Python to ship header-only and call it done. If `/extract` returns empty `line_items` for a normal itemised invoice PDF, the product doesn't work — 01 cut contract-based validation specifically *because* price validation compares invoice lines against **PO lines** (01 cut #1). Degradation is a per-document safety net, not the target state.

## §A.6 — What Python must not do

Restating 02 §1 because it's the part that gets eroded first:

Python does not touch the database, does not know what a reconciliation is, does not know tolerances exist, does not compare two documents, does not decide a status, and holds no state between calls. One document in, structured JSON out.

If a request arrives asking Python to compare an invoice to a PO, someone has misread this document.

---

# PART B — Frontend ↔ Node

Order matches 03's build sequence: Upload (step 3) → Settings (step 4) → Detail (step 5) → Exceptions (step 6) → Dashboard (step 7). Dashboard is last because its KPIs are aggregates over data that only exists once the other four ship (01 §Dashboard).

Every endpoint below uses the error envelope from §0. None of them redefine it.

---

## §B.1 — Upload screen (`NewReconciliation.jsx`) — build step 3

Four endpoints. One of them belongs to Settings and is listed there.

### B.1.1 `POST /documents`

Upload one file, extract it, return the result. Called once per document, at the step where the user picked the file — not batched at submit (02 §2).

```
POST /api/v1/documents
Content-Type: multipart/form-data
X-Actor-Id, X-Actor-Name
```

| Part | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | yes | ERP source is cut for v1 (01 §Upload), so there is always a file |
| `document_type` | text | yes | `document_type` domain (03 §1) |

**Server-side accept check.** The extension/MIME must be in that type's `accepts` list (01 §Upload — `DOC_TYPES`). The client already guards this; the server guards it again because the client's list is config that will drift. Rejection is `415 unsupported_file_type` with `details: { document_type, received: ".docx", accepts: [".pdf", ".csv", ".xlsx"] }`.

**Reads/writes:** writes `documents` (1 row), `line_items` (0..n rows). Reads nothing.

**Response `201`:**

```json
{
  "id": "9f4c1a2e-6b30-4f7a-9c11-2d8e5a7b0c33",
  "document_type": "invoice",
  "source": "upload",
  "original_filename": "meridian-inv-1001.pdf",
  "mime_type": "application/pdf",
  "byte_size": 184320,
  "page_count": 2,
  "extraction_status": "extracted",
  "extraction_confidence": 91,
  "extraction_error": null,
  "extracted_at": "2026-08-14T09:12:44.318Z",
  "confirmed_at": null,
  "fields": {
    "vendor_name": "Meridian Components Ltd",
    "doc_number": "INV-1001",
    "doc_date": "2026-08-14",
    "po_ref": "PO-88213",
    "subtotal": 11500.00,
    "tax_amount": 850.00,
    "total": 12350.00,
    "currency": "USD"
  },
  "line_items": [
    { "id": "…", "line_no": 1, "description": "Hex bolt M8x40, zinc", "sku": "HB-M8-40Z",
      "quantity": 200.0000, "uom": "EA", "unit_price": 61.0500, "line_total": 12210.00 }
  ],
  "warnings": [],
  "created_at": "2026-08-14T09:12:31.002Z"
}
```

Note `id`, not `document_id` — 02 §3a's trace used `document_id`, 03 §2's column is `id`, and every other resource in this API uses `id`. One name.

**Failure paths:** see §A.4. `201` with `extraction_status: "failed"` and null fields is the expected degraded response, not an error. The client branches on `extraction_status`, never on the HTTP code.

**The `contract` document type.** 01 gives it `extract: false` — Node stores the file and never calls Python. It gets `extraction_status: "manual"` with `extraction_error: null` and all-null fields. `[NEEDS CONFIRMATION — see §F.4]`

**Status codes:** `201` · `400 malformed_request` · `415 unsupported_file_type` · `500 internal_error`

### B.1.2 `PATCH /documents/:id`

The confirm step. Overwrites the extracted fields and line items with what the user actually confirmed — including the case where they typed everything by hand because extraction failed.

```json
{
  "fields": {
    "vendor_name": "Meridian Components Ltd",
    "doc_number": "INV-1001",
    "doc_date": "2026-08-14",
    "po_ref": "PO-88213",
    "subtotal": 11500.00,
    "tax_amount": 850.00,
    "total": 12350.00
  },
  "line_items": [
    { "line_no": 1, "description": "Hex bolt M8x40, zinc", "sku": "HB-M8-40Z",
      "quantity": 200.0000, "uom": "EA", "unit_price": 61.0500, "line_total": 12210.00 }
  ]
}
```

- **`line_items` is a full replace**, not a patch. Delete-all + insert-all inside one transaction. Line-level diffing buys nothing when the whole table is on screen and editable.
- Omitting `line_items` entirely leaves them untouched. Sending `[]` deletes them.
- `currency` is not editable (01 §Cross-cutting, single currency).
- Sets `confirmed_at = now()`.

**`extraction_status` transitions here**, and this is the only place it moves after creation:

| Before | After | Meaning |
|---|---|---|
| `extracted` | `extracted` | User reviewed machine output, possibly edited it. `confirmed_at` is what records that they looked. |
| `failed` | `manual` | User typed it in. This is the degraded path completing successfully. |
| `pending` | `manual` | Shouldn't occur in sync v1 — extraction always resolves inside the request. Handled defensively. |

**Reads/writes:** writes `documents`, `line_items`. **Response `200`** — same shape as B.1.1.

**Status codes:** `200` · `400` · `404 not_found` · `422 validation_failed` (e.g. duplicate `line_no`, `total` not a number) · `500`

### B.1.3 `POST /reconciliations`

Run the match. Synchronous — returns the finished record (02 §2).

```json
{
  "document_ids": [
    "9f4c1a2e-6b30-4f7a-9c11-2d8e5a7b0c33",
    "b1d7…",
    "c3e9…"
  ],
  "tax_rate": 8.50,
  "actual_sla": 97.20
}
```

**There is no `match_mode` in this request.** 02 §4's trace had one; 03 §6 makes it derived — `n = count(*)` over `reconciliation_documents` excluding `contract`, label = `n + "-way"`. **The document set is the match mode.** Sending both would let them disagree, and the doc set is the one the matcher actually uses.

`tax_rate` and `actual_sla` stay on the payload as **v1 shortcuts, both flagged unresolved in 01 §5** — `actual_sla` should come from vendor data and there is no vendor data (03 §5), `tax_rate` should come from the extracted invoice's `tax_amount`. Neither is fixed here; this contract just doesn't hide them.

**Validation, in this order:**

| Check | Failure |
|---|---|
| Every id resolves to a `documents` row | `404 not_found`, `details.document_ids: [...]` |
| Exactly one document has `document_type = 'invoice'` | `422 missing_invoice_document` |
| No two documents share a `document_type` | `409 duplicate_document_type`, `details.document_type` (03 §6 unique constraint) |
| Every document has `confirmed_at is not null` | `422 document_not_confirmed`, `details.document_ids: [...]` |
| No document already appears in `reconciliation_documents` | `409 document_already_used`, `details.document_ids: [...]` |

`contract` documents are accepted in `document_ids`, stored in `reconciliation_documents`, excluded from the N-way count and never matched against (01 cut #1).

**Reads/writes:** reads `documents`, `line_items`, `settings`. Writes `reconciliations`, `reconciliation_documents`, `stages`, `mismatches`, `audit_log` (one `kind='system'` row recording the status the matcher set — 03 §9, "without it the timeline starts mid-story"). All in one transaction.

**Response `201`** — the full record, byte-identical in shape to `GET /reconciliations/:id` (§B.3.1). The client navigates to `/reconciliations/:id` and can seed its cache from this response instead of refetching.

**Status codes:** `201` · `400` · `404` · `409 duplicate_document_type` · `409 document_already_used` · `422 missing_invoice_document` · `422 document_not_confirmed` · `500`

**The `processing` escape hatch** (02 §2) lives on the read endpoint — §B.3.2.

### B.1.4 `GET /settings/tolerances`

The wizard's match-strategy step reads `default_match_doc_types` from here rather than hardcoding 3-way (01 §Upload). Same endpoint as the Settings screen — §B.2.1. One query key, two consumers.

---

## §B.2 — Settings screen (`MatchingRulesSettings.jsx`) — build step 4

Two endpoints on one resource.

**Naming note:** 01 §Settings fixed the path as `/settings/tolerances`, but the payload carries `auto_approve_confidence`, `auto_escalate_variance` and `default_match_doc_types` — which aren't tolerances. The path stays as written in 01; the resource is the whole single-row `settings` table (03 §4). Not worth a rename to be pedantic about.

### B.2.1 `GET /settings/tolerances`

**Reads:** `settings` (the single row).

```json
{
  "tolerance_price_pct": 2.00,
  "tolerance_quantity_units": 0,
  "tolerance_date_days": 5,
  "tolerance_tax_pct": 1.00,
  "auto_approve_confidence": 90,
  "auto_escalate_variance": 500.00,
  "default_match_doc_types": ["po", "grn"],
  "updated_at": "2026-08-02T11:41:09.220Z",
  "updated_by": "P. Sharma"
}
```

- No `tolerance_currency_pct` — dropped, single currency (01 §Settings, 03 §4).
- `default_match_doc_types` is the **supporting** doc-type set; the invoice is implied. `["po","grn"]` is a 3-way run (01 §3.1). It is not the string `"3-way"`, because `"4-way"` alone doesn't say whether the fourth document is Quality or Service Entry (03 §Decisions #5).
- `tolerance_tax_pct` gets a real UI control here — it was in the mock with no UI (01 §Settings).

**Status codes:** `200` · `500`

### B.2.2 `PUT /settings/tolerances`

Full replace of the row. Not `PATCH` — there's one row with eight editable fields all rendered on one form, and a partial update semantics buys nothing.

**Request:** same body as the `GET` response, minus `updated_at` and `updated_by` (server-set from `now()` and `X-Actor-Name`).

**Validation** — `422 validation_failed` with `details.fields`:

| Field | Rule |
|---|---|
| `tolerance_price_pct`, `tolerance_tax_pct` | `0 ≤ x ≤ 100` |
| `tolerance_quantity_units` | `≥ 0` |
| `tolerance_date_days` | integer `≥ 0` |
| `auto_approve_confidence` | integer `0–100` (03 §1 `confidence_score`) |
| `auto_escalate_variance` | `≥ 0` |
| `default_match_doc_types` | non-empty array, every element in the `document_type` domain, **excluding `invoice`** (implied) and **excluding `contract`** (never matched, 01 cut #1) |

**Reads/writes:** writes `settings`. Nothing else — **no bulk re-match** (01 §Cross-cutting: "Tolerance changes affect future runs only"). Historical reconciliations keep their `tolerance_snapshot` (03 §5) and stay explainable.

**Response `200`** — the updated row, same shape as the `GET`.

**Status codes:** `200` · `400` · `422 validation_failed` · `500`

There is no settings history endpoint — cut in 01 §Settings, `updated_by` is the whole audit.

---

## §B.3 — Invoice Detail screen (`ReconciliationDetail.jsx`) — build step 5

### B.3.1 `GET /reconciliations/:id`

The one that fixes 02 §9 — the page currently calls `useParams()` and ignores the id. **Every deep link in the app is unverified until this ships.**

**Reads:** `reconciliations`, `reconciliation_documents`, `documents`, `line_items`, `stages`, `mismatches`, `audit_log`. One endpoint, one round trip, the whole screen.

```json
{
  "id": "7a1c…",
  "invoice_number": "INV-1001",
  "vendor_name": "Meridian Components Ltd",
  "status": "human_review",
  "confidence": 74,
  "confidence_driver_stage": "grn_match",

  "invoice_total": 12350.00,
  "expected_payable": 12260.00,
  "total_variance": 90.00,
  "currency": "USD",

  "tax_rate": 8.50,
  "actual_sla": 97.20,

  "match_mode": { "n": 3, "document_types": ["invoice", "po", "grn"] },

  "tolerance_snapshot": {
    "tolerance_price_pct": 2.00,
    "tolerance_quantity_units": 0,
    "tolerance_date_days": 5,
    "tolerance_tax_pct": 1.00,
    "auto_approve_confidence": 90,
    "auto_escalate_variance": 500.00
  },

  "human_summary": "Billed quantity exceeds received quantity on line 1…",
  "vendor_message": "Hi Meridian — we've held INV-1001 pending a GRN discrepancy…",

  "duplicate_check": { "flagged": false, "matches": [] },

  "documents": [
    {
      "id": "9f4c…", "document_type": "invoice", "source": "upload",
      "original_filename": "meridian-inv-1001.pdf", "page_count": 2,
      "extraction_status": "extracted", "extraction_confidence": 91,
      "fields": { "vendor_name": "…", "doc_number": "INV-1001", "doc_date": "2026-08-14",
                  "po_ref": "PO-88213", "subtotal": 11500.00, "tax_amount": 850.00,
                  "total": 12350.00, "currency": "USD" },
      "line_items": [ { "line_no": 1, "description": "…", "sku": "…", "quantity": 200.0000,
                        "uom": "EA", "unit_price": 61.0500, "line_total": 12210.00 } ]
    }
  ],

  "stages": [
    { "stage_key": "po_match",          "status": "passed",  "confidence": 96, "sort_order": 1,
      "detail": "3 of 3 lines matched within tolerance" },
    { "stage_key": "grn_match",         "status": "warning", "confidence": 74, "sort_order": 2,
      "detail": "Billed 200 EA, received 198 EA on line 1" },
    { "stage_key": "price_validation",  "status": "passed",  "confidence": 98, "sort_order": 3,
      "detail": "Unit prices within ±2% of PO" },
    { "stage_key": "duplicate_scan",    "status": "passed",  "confidence": 100, "sort_order": 4,
      "detail": "No exact match on vendor + invoice number" },
    { "stage_key": "decision",          "status": "passed",  "confidence": 74, "sort_order": 5,
      "detail": "Confidence 74 below auto-approve threshold 90" }
  ],

  "mismatches": [
    {
      "id": "e2b8…",
      "stage_key": "grn_match",
      "scope": "line",
      "field": "quantity",
      "invoice":  { "document_id": "9f4c…", "line_no": 1, "value_num": 200.0000, "value_text": null },
      "expected": { "document_id": "c3e9…", "line_no": 3, "value_num": 198.0000, "value_text": null },
      "variance": 2.0000,
      "variance_pct": 1.0101,
      "tolerance": { "type": "units", "value": 0 },
      "within_tolerance": false
    }
  ],

  "audit_log": [
    { "id": "…", "kind": "system", "action": null, "from_status": null,
      "to_status": "human_review", "body": "Matcher set status from confidence rollup",
      "actor_id": "system", "actor_name": "system",
      "created_at": "2026-08-14T09:14:02.771Z" }
  ],

  "created_at": "2026-08-14T09:13:58.004Z",
  "matched_at": "2026-08-14T09:14:02.771Z",
  "decided_at": null
}
```

Things worth pointing at:

- **`stages` is an ordered array with explicit `sort_order`** — not an object keyed by display name (02 §3b). A 3-way run has no `quality_match` and no `service_entry_match` **row at all** — absent, not null (03 §7). The frontend must not assume a fixed stage list.
- **No stage labels.** `"GRN Match"` comes from the frontend map in 01 §3.3.
- **`mismatches[]` carries an independent `line_no` on each side.** This is the entire point of 02 §3d — the side-by-side viewer highlights line 1 on the left and line 3 on the right from one row. The old `field: "line.unit_price"` dotted paths and `highlightFields={['line_0']}` positional keys are both retired.
- **`tolerance` is structured, not `"±2%"`.** The display string is rendered from `type` + `value` (03 §Derived).
- **Rows where `within_tolerance: true` are included.** The grid filters; the audit needs to show what was checked and passed (03 §8).
- **`match_mode` returns `n` and the doc types, not `"3-way"`.** Same rule as status and stage labels — the frontend formats `n + "-way"` (01 §3.1).
- **`documents[]` is what feeds the side-by-side compare.** Extracted structured data on both sides — no PDF rendering in v1 (01 §Cross-cutting, cut #5).
- **`duplicate_check.matches` has at most one entry in v1**, because 03 §5 stores a single `duplicate_of_id`. It's an array so the shape doesn't change when exact-match-against-many arrives. Entries are `{ id, invoice_number, vendor_name, invoice_total, created_at }`.
- **`human_summary` / `vendor_message` are stored, generated once at match time** (02 §1, 03 §5). No regenerate endpoint in v1.

**Status codes:** `200` · `400` (bad uuid) · `404 not_found` · `500`

Not in scope on this screen, and therefore not in this response: `contractIntelligence` (01 cut #1), download-source-docs, flag-for-audit (01 §Invoice Detail — no handlers, no endpoints).

**The Vendor Snapshot card** stays on the screen with its "View Full Profile" link dropped (01 §Invoice Detail) — but there is **no `vendors` table** (03 §Decisions #6) and no vendor endpoint. It can render `vendor_name` and this invoice's own numbers, and nothing else. `[NEEDS CONFIRMATION — see §F.5]`

### B.3.2 `GET /reconciliations/:id` as the poll endpoint — the `processing` escape hatch

Same endpoint. 02 §2: if `POST /reconciliations` comes back with `status: "processing"`, the client polls this every 1s until it isn't. **~20 lines of insurance so that moving matching to a background job later is a server-side change with no frontend rewrite.**

```js
// client, both after POST and on mount
while (res.status === "processing") { await sleep(1000); res = await get(`/reconciliations/${id}`); }
```

Three things to be precise about:

1. **`"processing"` is not a value in the `reconciliation_status` domain** (03 §1 — five values, none of them this). It is a **transport-level status only**. If matching ever goes async, either the domain gains a value (`ALTER DOMAIN`) or the row doesn't exist until matching finishes and the poll is served from job state. **Not decided, not needed in v1** — flagging it so nobody assumes 03 already covers it.
2. **In v1 the server never emits it.** `POST /reconciliations` always returns `201` with a terminal status. The async future is `202 Accepted` + `{ "id", "status": "processing" }`, and the client already handles that.
3. **The client must handle it anyway.** That's the whole point. Ship the loop, never exercise it.

### B.3.3 `POST /reconciliations/:id/notes`

Internal notes (01 §Invoice Detail). Notes and the override log are **one table with a `kind` field** (03 §9), normalising the two shapes `ActivityTimeline` currently papers over with `entry.author || entry.actor` (02 §3f).

```json
{ "body": "Called Meridian, they're re-issuing the GRN." }
```

- `body` required, non-blank after trim → else `422 validation_failed`.
- Writes one `audit_log` row: `kind='note'`, `action=null`, `from_status=null`, `to_status=null`, actor from the headers.
- **Does not change `status`.** A note is not a decision.

**Response `201`:** the created entry, plus the full log so the timeline re-renders from one response:

```json
{
  "entry": { "id": "…", "kind": "note", "action": null, "from_status": null, "to_status": null,
             "body": "Called Meridian, they're re-issuing the GRN.",
             "actor_id": "u_dev_stub", "actor_name": "P. Sharma",
             "created_at": "2026-08-14T11:02:19.400Z" },
  "audit_log": [ … ]
}
```

**Status codes:** `201` · `400` · `404` · `422 validation_failed` · `500`

`audit_log` is append-only, enforced by grant (03 §9). There is no edit and no delete endpoint, and there won't be one.

### B.3.4 `POST /reconciliations/:id/decision`

Shared with the Exceptions screen — same endpoint, same body, same transitions. Documented in full at §B.4.2 because that's the screen it's the core loop of.

---

## §B.4 — Exceptions screen (`ExceptionsQueue.jsx`) — build step 6

01: *"the screen furthest from done — approve/reject/escalate is 0% built."*

### B.4.1 `GET /exceptions`

**Reads:** `reconciliations` (the partial index `where status in ('human_review','escalated')` — 03 §5), plus `mismatches` for the derived reason.

**There is no `exceptions` table.** It's this query.

```
GET /api/v1/exceptions?status=escalated&reason_stage_key=grn_match&limit=1000&offset=0
```

| Param | Type | Notes |
|---|---|---|
| `status` | `human_review` \| `escalated` | Optional. Absent = both. **Filter on the enum, never the label** (01 §3.2 — this is the §6 bug). |
| `reason_stage_key` | `stage_key` | Optional. The reason filter chips. |
| `limit`, `offset` | integer | Accepted, defaults `1000` / `0`. No real paging in v1. |

```json
{
  "rows": [
    {
      "id": "7a1c…",
      "invoice_number": "INV-1001",
      "vendor_name": "Meridian Components Ltd",
      "status": "human_review",
      "confidence": 74,
      "invoice_total": 12350.00,
      "total_variance": 90.00,
      "currency": "USD",
      "reason": { "stage_key": "grn_match", "field": "quantity" },
      "created_at": "2026-08-14T09:13:58.004Z"
    }
  ],
  "total": 1
}
```

- **Every row carries both `id` and `invoice_number`** so no screen has to derive one from the other (02 §3a). This kills the `row.invoice_id.replace('INV-','6650a')` string substitution that invents a record id.
- **No `ageLabel`, no `ageOld`, no aging tile counts.** `created_at` only; the labels and the four aging tiles are derived client-side (01 §Exceptions, 02 §3f). A returned age label is stale the moment it's fetched.
- **`reason` is derived, not stored.** 03 has no reason column. Defined here as: the `stage_key` and `field` of the **highest-absolute-variance mismatch where `within_tolerance = false`**; `null` when there are none (an escalated record can have zero mismatches if `auto_escalate_variance` fired on the total). `[NEEDS CONFIRMATION — see §F.6]`
- **`total` is the row count**, and it is what the sidebar badge renders. **No separate count endpoint** — with no pagination the array length *is* the count, and 02 §10 wants one query key feeding all three places (sidebar badge, Dashboard KPI, Exceptions header). One fetch, one cache entry, one invalidation after a decision.

**Status codes:** `200` · `400` (bad enum value in a filter) · `500`

### B.4.2 `POST /reconciliations/:id/decision`

The core loop. Also the header buttons on Invoice Detail (§B.3.4).

```json
{ "action": "escalate", "note": "GRN short by 2 units, sending back to procurement." }
```

| Field | Type | Required |
|---|---|---|
| `action` | `approve` \| `reject` \| `escalate` (03 §1 `decision_action`) | yes |
| `note` | string | **Required and non-blank for `reject` and `escalate`** (01 §Exceptions). Optional for `approve`. |

A blank or missing note on reject/escalate is `422 note_required`. This is also a DB check constraint (03 §9) — Node validates first so the user gets a sane message instead of a constraint violation.

**Transitions:** see §C. An illegal one is `409 illegal_transition`:

```json
{
  "error": {
    "code": "illegal_transition",
    "message": "Cannot escalate a record that is already escalated.",
    "details": {
      "from_status": "escalated",
      "action": "escalate",
      "allowed_actions": ["approve", "reject"]
    }
  }
}
```

`details.allowed_actions` is what the client uses to disable the wrong buttons after a stale-cache collision, instead of guessing.

**Reads/writes:**
- Reads `reconciliations` (current `status`).
- Writes `reconciliations.status`, `reconciliations.decided_at`.
- Writes one `audit_log` row: `kind='decision'`, `action`, `from_status`, `to_status`, `body = note`, actor from the headers.
- Both in one transaction. **Row-locked (`select … for update`)** so two reviewers clicking at once produce one decision and one `409`, not two audit rows.

**Response `200`:**

```json
{
  "id": "7a1c…",
  "status": "escalated",
  "decided_at": "2026-08-14T11:20:03.912Z",
  "audit_log": [ … ]
}
```

Deliberately not the full record — the two screens that call this both re-fetch what they need via cache invalidation, and 02 §4 step 28 already scoped the response to `{ status, audit_log[] }`.

**Cache invalidation the client must do** (01 §Exceptions — *"cache invalidation so the sidebar badge and Dashboard KPIs update"*): `GET /exceptions`, `GET /reconciliations` (the Dashboard list), `GET /dashboard/kpis`, and `GET /reconciliations/:id`. With TanStack Query (02 §10) that's four `invalidateQueries` calls in one `onSuccess`.

**No role check in v1.** 02 §8 asked *"can an `escalated` record be approved? by whom?"* — the "which" is answered in §C, the "by whom" is not, because auth is stubbed (01 §Cross-cutting). Any actor can perform any legal transition; `actor_id` is recorded on every one. When roles land, they gate §C's table, and the audit log from day one is what makes that retrofit possible.

**Bulk actions are cut** (01 §Exceptions). There is no `POST /decisions/bulk`. If you're writing partial-failure handling, you're building a cut feature.

**Status codes:** `200` · `400` · `404 not_found` · `409 illegal_transition` · `422 note_required` · `500`

---

## §B.5 — Dashboard (`Dashboard.jsx`) — build step 7

Built last. Most existing code, least real backing (01 §Dashboard).

Date Range is the only surviving filter — Region, Dashboard View (CFO / Procurement / Internal Audit) and the Pipeline Status strip are all out (01 §Dashboard). So every endpoint here takes the same two params:

| Param | Type | Notes |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | Optional, inclusive, against `reconciliations.created_at` |
| `date_to` | `YYYY-MM-DD` | Optional, inclusive |

### B.5.1 `GET /dashboard/kpis`

**Reads:** `reconciliations`, `mismatches`, `audit_log`. Aggregates, no rollup tables, no materialised views (03 §10).

**02 §3e is the rule: numbers plus a unit. Never `"$1,842,930"`, never `"<2 min"`.**

```json
{
  "kpis": {
    "total_payable":       { "value": 1842930.00, "unit": "currency" },
    "touchless_rate":      { "value": 42.0,  "unit": "percent", "target": 85, "target_direction": "at_least" },
    "avg_processing_time": { "value": 5.2,   "unit": "minutes", "target": 2,  "target_direction": "at_most"  },
    "open_exceptions":     { "value": 17,    "unit": "count" },
    "total_variance":      { "value": 8412.55, "unit": "currency" }
  },
  "date_from": "2026-08-01",
  "date_to": "2026-08-31"
}
```

**The shape, exactly:**

| Key | Type | Present |
|---|---|---|
| `value` | number | always |
| `unit` | `currency` \| `percent` \| `minutes` \| `count` | always |
| `target` | number | only on KPIs the mock gives a target |
| `target_direction` | `at_least` \| `at_most` | only alongside `target` |

`target_direction` exists because `"<2 min"` is unparseable (02 §3e) and dropping the `<` silently inverts the traffic light. Two enum values, no parsing.

**What each one means, since three of them are ambiguous:**

- `total_payable` — `sum(expected_payable)` over the range. Not `invoice_total` — the payable is what survived matching.
- `touchless_rate` — **records that reached `touchless_approved` with no `audit_log` row where `kind = 'decision'`, over all records in range, ×100.** This matters: 01 §3.2 fixes five status values and none of them is "manually approved", so a human approving an exception writes `touchless_approved` (§C). Counting the status alone would let every reviewer click inflate the touchless rate. The absence of a decision row is what makes it touchless. See §E.4.
- `avg_processing_time` — mean of `matched_at − created_at` in minutes, over records with `matched_at not null`. Not time-to-decision; that's a different number and nothing in 01 asks for it.
- `open_exceptions` — same query as `GET /exceptions` with no filters. One number, three places (02 §10).

Unformatted, unsorted, unlocalised — `Dashboard.jsx`'s `KPI_LIST` formats. That ~30-line change happens **before** this endpoint is written, not after (02 §3e).

**Status codes:** `200` · `400` (unparseable date) · `500`

### B.5.2 `GET /reconciliations`

The recent-reconciliations table with its status filter chips.

```
GET /api/v1/reconciliations?status=touchless_approved&date_from=…&date_to=…&limit=1000&offset=0
```

| Param | Notes |
|---|---|
| `status` | Any value of `reconciliation_status`, repeatable (`?status=a&status=b`). **The chip's value is the enum; the label comes from `StatusBadge`'s map.** This is the fix for 02 §6 — `touchless_approved.replace('_',' ')` is `"touchless approved"`, which never contains `"auto-approved"`, so the Auto-Approved chip currently returns an empty table. |
| `date_from`, `date_to`, `limit`, `offset` | As above |

```json
{
  "rows": [
    { "id": "7a1c…", "invoice_number": "INV-1001", "vendor_name": "Meridian Components Ltd",
      "status": "human_review", "confidence": 74,
      "invoice_total": 12350.00, "total_variance": 90.00, "currency": "USD",
      "created_at": "2026-08-14T09:13:58.004Z", "decided_at": null }
  ],
  "total": 1
}
```

**Reads:** `reconciliations` only. Both `id` and `invoice_number` on every row (02 §3a) — this is what kills `navigate('/invoice-reconciliation/' + r._id)`. `_id` is retired.

Numbers are numbers. `DataGridViewer` sorts raw values, so a `"18%"` string sorts as a string (02 §Tier 4).

**Status codes:** `200` · `400` · `500`

### B.5.3 `GET /dashboard/charts`

Three charts, one request — one screen, one fetch. All three are real aggregates (01 §Dashboard).

**Reads:** `reconciliations`, `mismatches`.

```json
{
  "processing_volume":   [ { "date": "2026-08-01", "count": 34 } ],
  "exception_breakdown": [ { "stage_key": "grn_match", "count": 11 } ],
  "variance_trend":      [ { "date": "2026-08-01", "total_variance": 412.90 } ],
  "date_from": "2026-08-01",
  "date_to": "2026-08-31"
}
```

- `processing_volume` — count of `reconciliations` per day by `created_at`.
- `exception_breakdown` — count per `reason.stage_key`, using the same derivation as §B.4.1 so the chart and the filter chips can't disagree. `[NEEDS CONFIRMATION — see §F.6]`
- `variance_trend` — `sum(total_variance)` per day.

Buckets are daily. Empty days are omitted, not zero-filled — the chart handles gaps. No `pipelineStatus`: system health, no data source, hidden in v1 (01 §Dashboard, 02 §3c).

**Status codes:** `200` · `400` · `500`

---

# §C — Status transition table

01 §Exceptions requires "a legal-transition check". Here it is, concretely. The state machine lives in Node, not in a trigger (03 §9).

Statuses are the five from 01 §3.2. Actions are the three from 03 §1 `decision_action`.

| From ↓ / Action → | `approve` | `reject` | `escalate` |
|---|---|---|---|
| `human_review` | → `touchless_approved` | → `rejected` | → `escalated` |
| `escalated` | → `touchless_approved` | → `rejected` | ✗ already escalated |
| `duplicate_flagged` | → `touchless_approved` | → `rejected` | → `escalated` |
| `touchless_approved` | ✗ terminal | ✗ terminal | ✗ terminal |
| `rejected` | ✗ terminal | ✗ terminal | ✗ terminal |

Every ✗ is `409 illegal_transition`, with `details.allowed_actions` listing what *is* legal from that status.

Four notes on why it looks like this:

1. **`approve` lands on `touchless_approved` even when a human did it.** There is no `manually_approved` in the enum and 01 §3.2 is final — the backend emits exactly those five strings or the badge renders `"Unknown"`. The touchless-rate KPI therefore keys off the *absence of a decision audit row*, not the status (§B.5.1). Ugly, honest, no migration. See §E.4.
2. **`touchless_approved` and `rejected` are terminal.** Reversing a decision means a "reopen" concept — a new action, a new transition set, a question about whether the payment already went out. Nothing in 01 asks for it. `[NEEDS CONFIRMATION — see §F.7]`
3. **`duplicate_flagged` is decidable even though it never appears in the Exceptions queue** (01 §Exceptions scopes the queue to `human_review, escalated`). It's reachable by deep link from the Dashboard list, the Detail header buttons are there, and a wrongly-flagged duplicate needs a way out. `[NEEDS CONFIRMATION — see §F.7]`
4. **`escalate` from `escalated` is illegal, not a no-op.** Returning `200` for a click that changed nothing writes a misleading audit row.

Every legal transition writes exactly one `audit_log` row with `kind='decision'`, `from_status`, `to_status`, `action`, the note, and the actor (03 §9). `reconciliations.decided_at` is set on every one, including a second decision on a record that was already decided once (`human_review` → `escalated` → `rejected` sets it twice — the audit log holds the history, `decided_at` holds the latest).

---

# §D — Coverage cross-check against 01

Every IN SCOPE item from 01, and what serves it. **Three gaps, marked.**

## Upload

| 01 §Upload — in scope | Served by |
|---|---|
| Extract-then-confirm for **every** doc type | `POST /documents` + `PATCH /documents/:id`, type-agnostic |
| `invoice`, `po`, `grn`, `service_entry`, `quality` | `document_type` domain (03 §1) |
| `contract` — store only, no matching | `POST /documents` skips Python; excluded from N-way count and from matching |
| Per-type accepted formats | Client `DOC_TYPES.accepts` + server check → `415 unsupported_file_type` |
| Editable confirm form with line-item table | `PATCH /documents/:id`, `line_items` full replace |
| Match strategy default from Settings | `GET /settings/tolerances` → `default_match_doc_types` |
| Submit → sync, returns finished record | `POST /reconciliations` → `201` full record |
| 5-stage animation | Client-side flourish, no endpoint (02 §2) |
| `timesheet` → `service_entry` | Enum value, everywhere |

## Settings

| 01 §Settings — in scope | Served by |
|---|---|
| Persisted tolerances | `GET` / `PUT /settings/tolerances` |
| Price %, quantity units, date days, **tax %** | Four fields on that resource |
| Auto-approve confidence, auto-escalate variance | Same resource |
| `default_match_doc_types` with a control, wizard reads it | Same resource, consumed by §B.1.4 |
| Org-level only | Single row (03 §4) |

## Invoice Detail

| 01 §Invoice Detail — in scope | Served by |
|---|---|
| Fetch by route param | `GET /reconciliations/:id` |
| Financial summary | `invoice_total`, `expected_payable`, `total_variance` |
| Line-item mismatch grid, tolerance stamped per row | `mismatches[]` with `tolerance: { type, value }` |
| Pipeline as ordered array | `stages[]` with `sort_order` |
| Side-by-side compare, one canonical `{line_no, field}` | `documents[]` + `mismatches[].invoice` / `.expected` |
| Approve / Reject / Escalate from the header | `POST /reconciliations/:id/decision` |
| AI Summary + Vendor Message | `human_summary`, `vendor_message` |
| Internal notes + audit log, one shape | `POST /reconciliations/:id/notes`, `audit_log[]` with `kind` |
| Duplicate scan card wired to `flagged` | `duplicate_check: { flagged, matches[] }` |
| Print Summary | `window.print()`, no endpoint |
| Vendor Snapshot card (minus the profile link) | **GAP — §F.5.** No `vendors` table (03 §Decisions #6), no endpoint. Card can only render `vendor_name` and this invoice's numbers. |

## Exceptions

| 01 §Exceptions — in scope | Served by |
|---|---|
| List where `status IN (human_review, escalated)` | `GET /exceptions` |
| Approve / Reject / Escalate, one at a time | `POST /reconciliations/:id/decision` |
| Required note on reject and escalate | `422 note_required` + 03 §9 check |
| Legal-transition check | §C, `409 illegal_transition` |
| Audit row with `actor_id` | `X-Actor-Id` header → `audit_log` |
| Cache invalidation | Client-side, four query keys (§B.4.2) |
| Reason filter chips | `?reason_stage_key=` — **derived, §F.6** |
| Aging labels + four aging tiles | Client-side from `created_at`, no endpoint |
| Live sidebar badge count | `GET /exceptions` → `total`, same cache entry |

## Dashboard

| 01 §Dashboard — in scope | Served by |
|---|---|
| KPI strip, `{ value, unit }` | `GET /dashboard/kpis` |
| Recent reconciliations + status chips filtering on the enum | `GET /reconciliations?status=` |
| Processing volume / exception breakdown / variance trend | `GET /dashboard/charts` |
| Date Range filter | `date_from` / `date_to` on all three |
| "+ New Reconciliation" | Client navigation |

## Three gaps

1. **Vendor Snapshot card has no data source.** §F.5.
2. **The sidebar's second badge (`badge: 1`, duplicates)** — 02 §8 wants it live, but Duplicate Detection is out of scope (01 §2) and no endpoint serves it. **Hide that badge in v1.** Its route is demo-only anyway; a live count next to a mock screen is worse than no count.
3. **`ModuleShell`'s global search** navigates to `/history?q=…` and `ReconciliationHistory` never reads it (02 §9). History is out of scope, so there is no search endpoint. **Disable or hide the global search box in v1**, or scope it to the Dashboard grid's existing client-side filter. Do not build `GET /search`.

None of the three is a missing endpoint. All three are frontend elements pointing at scope that was cut — fix them by hiding, not by building.

---

# §E — Decisions this document had to make

Same convention as 03 §Decisions. Challenge these now.

1. **`/api/v1` as the base path.** Never picked anywhere. Not the frontend `basename`.
2. **Actor travels as `X-Actor-Id` / `X-Actor-Name` headers**, and a mutating request without them is a `400`. 03 §9 makes both columns `not null` and 02 §3f has no user model — something had to carry them. Headers, not a body field, so the swap to session-derived values touches one middleware.
3. **`POST /reconciliations` does not take `match_mode`.** 02 §4's trace had one; 03 §6 derives it from the document set. Sending both lets them disagree.
4. **A human approval writes `touchless_approved`, and the touchless-rate KPI excludes anything with a decision audit row.** The alternative — adding `manually_approved` to the enum — contradicts 01 §3.2, which is final, and would render as `"Unknown"` in `StatusBadge`. This is the decision most likely to produce a quietly wrong number, so it's spelled out in both §B.5.1 and §C.
5. **A header-only extraction degrades matching rather than failing the run**, with the affected stage capped at confidence 60 so it structurally cannot auto-approve (§A.5). Failing outright would throw away a user's six uploads over one bad OCR pass.
6. **`extraction_status: 'failed'`, not 02's `"extraction_failed"`.** 03's check constraint wins; the API must not carry a fifth spelling of an enum this project has already spelled three ways.
7. **`POST /documents` returns `201` on extraction failure.** Extraction failure is a shipping path (01 §Cross-cutting), so the client branches on `extraction_status`, never on the HTTP code.
8. **`GET /exceptions` returns `total` and there is no separate count endpoint.** No pagination means length is the count, and 02 §10 wants one cache entry feeding all three places the number appears.
9. **`POST /.../decision` returns `{ id, status, decided_at, audit_log }`, not the full record.** Both callers invalidate and refetch anyway (02 §4 step 28–29).

---

# §F — `[NEEDS CONFIRMATION]`

Seven. Each says what was assumed, so whoever builds the Python side or reviews this can overrule with one line rather than reverse-engineering intent.

| # | Item | Assumed | Who decides |
|---|---|---|---|
| **F.1** | Auth on the Node → Python hop | None. Service-to-service on a private network. If it needs a shared secret or mTLS, that's a header on §A.2 and changes nothing else. | Python team + whoever owns the network |
| **F.2** | The `warnings[]` vocabulary in `/extract` | Free-form `{code, detail}`. Only `document_type_mismatch` and `no_line_items` are referenced by this contract, and **nothing in v1 branches on either.** If Python has a fixed code list, we take theirs. | Python team |
| **F.3** | Confidence cap of **60** on a degraded (header-only) stage | Picked so it sits below the `auto_approve_confidence` default of 90 (03 §4) with room to spare. Any value under 90 works; 60 is a guess, not arithmetic. | Product / whoever owns the auto-approve rate |
| **F.4** | `extraction_status` for a `contract` document | `'manual'`, since nothing extracts and nothing will be typed in. The cleaner answer is a `'skipped'` value — but that's an `ALTER DOMAIN` on 03 §2's check constraint and this doc doesn't get to change the schema. | Whoever owns 03 |
| **F.5** | What the Vendor Snapshot card renders | `vendor_name` plus this invoice's own numbers, and nothing else. There is no `vendors` table (03 §Decisions #6). If the card needs vendor history, that's Vendor Intelligence and it's out of scope (01 §2) — **the honest fix may be hiding the card, not feeding it.** | Product |
| **F.6** | How `reason` is derived on an exception row | `stage_key` + `field` of the highest-absolute-variance mismatch with `within_tolerance = false`; `null` when there are none. 03 stores no reason column, so it has to be derived from something. Alternatives: first-failed stage by `sort_order`, or the `confidence_driver_stage` already on the record. Same derivation feeds the filter chips and the exception-breakdown chart, so changing it changes both. | Product |
| **F.7** | Two rows of the transition table (§C) — `touchless_approved` / `rejected` terminal, and `duplicate_flagged` decidable | Terminal because reversal needs a "reopen" concept nothing asked for. Decidable because a wrongly-flagged duplicate otherwise has no way out and the Detail header buttons are already there. | Product |

Owner: ______  ·  Answer by: ______

---

# Sign-off

Agreeing to this document means agreeing to:

- **One Python endpoint.** Node sends `document_type`; Python never detects it. Node parses CSV/XLSX itself and never calls Python for them. `line_items` is required and may be empty.
- **60s timeout, and a failed extraction is a `201`, not a `5xx`** — manual entry is the shipping path.
- **Thirteen Node endpoints**, one error envelope, `{ value, unit }` KPIs, no pagination, no bulk actions, no search.
- **The transition table in §C** is what the decision endpoint enforces, including the fact that a human approval writes `touchless_approved` and the touchless-rate KPI has to work around it.
- **Three frontend elements get hidden, not built**: the duplicate sidebar badge, the global search box, and — probably — the Vendor Snapshot card.

| Name | Role | Agreed |
|---|---|---|
| | | |
| | | |
| | | |

*Basis: `01-SCOPE.md`, `02-ARCHITECTURE.md`, `03-DATA-MODEL.md`. No code was read for this document.*
