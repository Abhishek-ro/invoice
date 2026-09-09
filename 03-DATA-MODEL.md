# 03 — Data Model

Turns the decisions in `01-SCOPE.md` and `02-ARCHITECTURE.md` into a schema. Nothing here re-opens those decisions.
Tables are ordered by the build sequence in 02 §Suggested build order, so what gets built first is at the top.

**Six places where this document had to decide something the prior two left open** — listed in §8 at the end. Read that section before you object to something.

---

## Before anything: which database?

**This schema is written for PostgreSQL 13+.** Flagging it because that choice was never actually made.

- The mocks use `_id` (`"6650a1"`), which implies Mongo.
- 02 §3a says don't carry that name into the API — but it only rules out the *naming*, not the engine.
- 02's end-to-end trace writes "Postgres" at every storage step. **That was an assumption in the diagram, not a team decision.** Nobody ratified it.

This needs a yes/no alongside the other open items in 01 §5. If the answer is Mongo, §9 says what changes.

---

## Conventions

- **Primary keys are `uuid`**, `default gen_random_uuid()`. Encodes 02 §3a — `id` is the only thing used as a route param, and sequential integers in URLs leak invoice volume to anyone counting. `_id` is retired.
- **`invoice_number` is a label, never a key.** Displayed, searched, never joined on. (02 §3a)
- **All timestamps are `timestamptz`.** Age labels are derived from `created_at` (02 §3f) and reviewers won't all be in one timezone.
- **Money is `numeric(14,2)`.** Unit prices and quantities are `numeric(14,4)` — the mock already has `61.05`, and service hours come in fractions.
- **Enums are `DOMAIN`s over `text` with a CHECK**, not native PG enum types. Native enums can't drop a value and `ALTER TYPE ... ADD VALUE` is awkward to run in a migration transaction. Document types are explicitly config-driven in 01 (`DOC_TYPES`), so the list will change. A domain constraint is one `ALTER DOMAIN` to change and still shows up in `\d`.
- **Append-only tables get `UPDATE`/`DELETE` revoked**, not just a convention.

```sql
create extension if not exists pgcrypto;  -- gen_random_uuid(); built in from PG13
```

---

## 1. Enums (domains)

Every one of these comes from a definition in 01 §3. None are free text.

```sql
-- 01 §3.2 — canonical status enum, from StatusBadge.jsx.
-- The backend emits exactly these; anything else renders as "Unknown" in the UI.
create domain reconciliation_status as text
  check (value in (
    'touchless_approved',
    'human_review',
    'escalated',
    'rejected',
    'duplicate_flagged'
  ));

-- 01 §3.5 — document type keys. 'timesheet' is retired in favour of 'service_entry'.
create domain document_type as text
  check (value in ('invoice','po','grn','service_entry','quality','contract'));

-- 01 §3.3 — canonical stage keys. Replaces all three competing vocabularies
-- (stageTraces keys, pipelineStatus labels, "Layer 1"/"Layer 2").
create domain stage_key as text
  check (value in (
    'po_match',
    'grn_match',
    'quality_match',
    'service_entry_match',
    'price_validation',
    'duplicate_scan',
    'decision'
  ));

create domain stage_status as text
  check (value in ('passed','warning','failed','skipped'));

-- 0-100 integer, used for both per-stage and record-level confidence (02 §3f).
create domain confidence_score as integer
  check (value between 0 and 100);

-- Fields a mismatch can be raised on. This IS the canonical field vocabulary
-- for the {line_no, field} addressing in 02 §3d — nothing else is addressable.
create domain matchable_field as text
  check (value in (
    -- line-level (columns on line_items)
    'description','sku','quantity','uom','unit_price','line_total',
    -- header-level (columns on documents)
    'vendor_name','doc_number','doc_date','po_ref','subtotal','tax_amount','total'
  ));

create domain audit_kind as text
  check (value in ('note','decision','system'));

create domain decision_action as text
  check (value in ('approve','reject','escalate'));
```

**No label columns anywhere.** Labels live in the frontend map, exactly like `StatusBadge`'s already does. Renaming "GRN Match" to "Goods Receipt Match" is a frontend change, not a migration. (02 §3b)

---

## 2. `documents` — build step 3

One row per uploaded document. Created by `POST /documents` **before** any reconciliation exists.

```sql
create table documents (
  id                      uuid primary key default gen_random_uuid(),
  document_type           document_type not null,

  -- 01 §Upload: ERP fetch is cut for v1, but the column stays so adding it
  -- later isn't a migration. Everything is 'upload' in v1.
  source                  text not null default 'upload'
                          check (source in ('upload','erp')),
  file_uri                text,          -- null when source='erp'
  original_filename       text,
  mime_type               text,
  byte_size               bigint,

  -- 02 §2 — 'failed' is a shipping path, not an error state. 'manual' means
  -- the user typed the fields in because extraction failed.
  extraction_status       text not null default 'pending'
                          check (extraction_status in ('pending','extracted','failed','manual')),
  extraction_confidence   confidence_score,
  extraction_error        text,
  extracted_at            timestamptz,
  page_count              integer,

  -- Header fields. Written by extraction, then overwritten by the user in the
  -- confirm step. What's here is what the user confirmed, not what OCR guessed.
  vendor_name             text,
  vendor_name_normalized  text generated always as (
                            lower(btrim(regexp_replace(coalesce(vendor_name,''), '\s+', ' ', 'g')))
                          ) stored,
  doc_number              text,
  doc_date                date,
  po_ref                  text,
  subtotal                numeric(14,2),
  tax_amount              numeric(14,2),
  total                   numeric(14,2),
  currency                char(3) not null default 'USD',

  -- Exactly what Python returned, untouched. Cheap, and it means re-normalising
  -- our mapping never requires re-running extraction.
  raw_extraction          jsonb,

  confirmed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index on documents (vendor_name_normalized, doc_number);  -- exact duplicate scan
create index on documents (created_at desc);
create index on documents (extraction_status) where extraction_status in ('pending','failed');
```

Notes:

- **`vendor_name_normalized` is a stored generated column** because exact duplicate detection (01 cut #3 keeps exact, cuts fuzzy) means "same vendor + same invoice number", and vendor names come out of OCR with inconsistent whitespace and casing. Lowercased, whitespace-collapsed, trimmed. This is normalisation, not fuzzy matching.
- **No `bbox` column.** 01 cut #5. If Python starts emitting coordinates, they land in `raw_extraction` for free and get promoted to real columns then.
- **Orphan documents are expected** — uploaded, never submitted. A nightly job deletes `documents` older than N days with no row in `reconciliation_documents`.

---

## 3. `line_items` — build step 3

One row per line on a document. Every document type has them, not just invoices.

```sql
create table line_items (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,

  -- 1-based, as printed on the document. This is the line_no in the
  -- {line_no, field} addressing from 02 §3d.
  line_no      integer not null check (line_no > 0),

  description  text,
  sku          text,
  quantity     numeric(14,4),
  uom          text,
  unit_price   numeric(14,4),
  line_total   numeric(14,2),
  raw          jsonb,
  created_at   timestamptz not null default now(),

  unique (document_id, line_no)
);

create index on line_items (document_id, line_no);
```

- Lines belong to a **document**, not to a reconciliation. Invoice line 1 and PO line 1 are separate rows on separate documents — which is the whole point of §3d: line 1 on the invoice is not line 1 on the PO, and the schema must not pretend otherwise.
- The addressable column names here are exactly the line-level values in the `matchable_field` domain. Keep them in sync.

---

## 4. `settings` — build step 4

One row, org-level. 01 §Settings: no per-vendor overrides, no change history.

```sql
create table settings (
  id                        boolean primary key default true check (id),  -- single-row guard

  tolerance_price_pct       numeric(5,2) not null default 2.00,
  tolerance_quantity_units  numeric(10,2) not null default 0,
  tolerance_date_days       integer      not null default 5,
  tolerance_tax_pct         numeric(5,2) not null default 1.00,
  -- no tolerance_currency_pct: dropped in 01 §Settings (single currency)

  auto_approve_confidence   confidence_score not null default 90,
  auto_escalate_variance    numeric(14,2)    not null default 500.00,

  -- 01 §3.1 — stored as the supporting doc-type set, not the string "3-way".
  -- "4-way" alone doesn't say whether the 4th document is Quality or Service
  -- Entry. The invoice is implied; the "N-way" label is derived (see §6).
  default_match_doc_types   text[] not null default '{po,grn}',

  updated_at                timestamptz not null default now(),
  updated_by                text
);

insert into settings (id) values (true) on conflict do nothing;
```

- `tolerance_tax_pct` gets a column **and** a UI control — 01 §Settings. It was in the mock with no UI.
- `default_match_doc_types` defaults to `{po,grn}` = 3-way, resolving the `"4-way"`-vs-3-way contradiction the audit found (02 §7).

---

## 5. `reconciliations` — build step 5

```sql
create table reconciliations (
  id                      uuid primary key default gen_random_uuid(),

  -- 02 §3a — human label, displayed and searched, never joined on.
  invoice_number          text not null,
  vendor_name             text not null,
  vendor_name_normalized  text generated always as (
                            lower(btrim(regexp_replace(coalesce(vendor_name,''), '\s+', ' ', 'g')))
                          ) stored,

  status                  reconciliation_status not null,
  confidence              confidence_score not null,
  confidence_driver_stage stage_key,       -- which stage produced the rollup (§7)

  invoice_total           numeric(14,2) not null,
  expected_payable        numeric(14,2) not null,
  total_variance          numeric(14,2) not null,
  currency                char(3) not null default 'USD',

  -- Per-run matching inputs. Both are flagged as unresolved in 01 §5.
  tax_rate                numeric(5,2),
  actual_sla              numeric(5,2),

  -- Settings exactly as they were when this ran. Without it you cannot explain
  -- an old decision after someone moves a slider — and 02 §3 requires every
  -- mismatch to carry the tolerance that was applied.
  tolerance_snapshot      jsonb not null,

  human_summary           text,           -- generated in Node (02 §1)
  vendor_message          text,

  -- Exact duplicate only. No similarity score column: 01 cut #3.
  duplicate_of_id         uuid references reconciliations(id),

  created_at              timestamptz not null default now(),
  matched_at              timestamptz,
  decided_at              timestamptz
);

-- The Exceptions queue. There is no exceptions table — it's this query.
create index on reconciliations (status, created_at desc)
  where status in ('human_review','escalated');

create index on reconciliations (created_at desc);
create index on reconciliations (vendor_name_normalized, invoice_number);
```

**There is no `exceptions` table.** The Exceptions screen is `where status in ('human_review','escalated')`, served by the partial index above. A separate table would need syncing with `status` and would drift.

**There is no `vendors` table.** Vendor master data belongs to Vendor Intelligence, which is out of scope (01 §2). `vendor_name` is denormalised from the confirmed extraction — which is exactly what the Detail page displays. Re-add trigger: when vendor name normalisation stops being good enough for duplicate detection, or Vendor Intelligence comes into scope.

---

## 6. `reconciliation_documents` — build step 5

```sql
create table reconciliation_documents (
  reconciliation_id  uuid not null references reconciliations(id) on delete cascade,
  document_id        uuid not null references documents(id),
  document_type      document_type not null,

  primary key (reconciliation_id, document_id),

  -- 01 §Upload: one document per type per reconciliation.
  unique (reconciliation_id, document_type)
);

create index on reconciliation_documents (document_id);
```

**Why a junction table and not `documents.reconciliation_id`:** documents are uploaded and extracted at build step 3, before any reconciliation exists (build step 5). A FK on `documents` would have to be nullable, which makes "one per type" unenforceable and lets a document belong to a reconciliation it was never submitted to. The junction also makes the "one per type" rule a real constraint instead of a code comment.

**What the DB can't enforce:** that every reconciliation has exactly one `invoice` row. That's a cross-row rule — enforce it in the insert transaction in Node and add a data-quality check, don't try to trigger it.

**Match mode is derived here, not stored:** `n = count(*)` over this table, label = `n || '-way'`. That's 01 §3.1 — N counts documents with the invoice included, and `contract` rows are excluded from the count since nothing matches against them (01 cut #1).

---

## 7. `stages` — build step 5

The array from 02 §3b. Not an object keyed by display name.

```sql
create table stages (
  id                 uuid primary key default gen_random_uuid(),
  reconciliation_id  uuid not null references reconciliations(id) on delete cascade,
  stage_key          stage_key not null,
  status             stage_status not null,
  detail             text,
  confidence         confidence_score,

  -- Explicit. The UI must not depend on insertion order (02 §3b).
  sort_order         integer not null,

  created_at         timestamptz not null default now(),

  unique (reconciliation_id, stage_key)
);

create index on stages (reconciliation_id, sort_order);
```

- **Stages are absent, not null, when they don't apply.** A 3-way run has no `grn_match`... it has no `quality_match` or `service_entry_match` row at all. `'skipped'` exists for a stage that was in the match set but couldn't run.
- No `label` column — see §1.

---

## 8. `mismatches` — build step 5

This is where 02 §3d gets enforced: **both sides carry their own document and line number.**

```sql
create table mismatches (
  id                     uuid primary key default gen_random_uuid(),
  reconciliation_id      uuid not null references reconciliations(id) on delete cascade,
  stage_key              stage_key not null,

  scope                  text not null check (scope in ('header','line')),
  field                  matchable_field not null,

  -- Invoice side. Column names match the "INVOICE VAL" grid column.
  invoice_document_id    uuid not null references documents(id),
  invoice_line_no        integer,
  invoice_value_num      numeric(14,4),
  invoice_value_text     text,

  -- The document it was compared against — PO, GRN, service entry.
  -- Its line_no is independent: invoice line 1 can be PO line 3.
  expected_document_id   uuid not null references documents(id),
  expected_line_no       integer,
  expected_value_num     numeric(14,4),
  expected_value_text    text,

  variance               numeric(14,4),
  variance_pct           numeric(7,4),

  -- 02 §3 — "±2%" was a display string. Stored structured; the string is derived.
  tolerance_type         text check (tolerance_type in ('percent','absolute','units','days')),
  tolerance_value        numeric(10,4),
  within_tolerance       boolean not null,

  created_at             timestamptz not null default now(),

  -- line-scoped mismatches must carry line numbers; header-scoped must not
  check (scope <> 'line'   or (invoice_line_no is not null and expected_line_no is not null)),
  check (scope <> 'header' or (invoice_line_no is null     and expected_line_no is null))
);

create index on mismatches (reconciliation_id);
create index on mismatches (reconciliation_id, within_tolerance) where not within_tolerance;
```

- **`invoice_line_no` and `expected_line_no` are separate columns on purpose.** This is the entire point of §3d — the side-by-side viewer highlights line 1 on the left and line 3 on the right from a single row.
- `*_value_num` / `*_value_text`: `field` decides which is populated. Numeric for `quantity`/`unit_price`/`line_total`/`subtotal`/`tax_amount`/`total`; text for `description`/`sku`/`uom`/`doc_number`/`po_ref`/`vendor_name`; `doc_date` goes in `_text` as ISO. Ugly but honest — a single `jsonb` value column would make sorting and variance arithmetic worse.
- **Rows are written for matches within tolerance too** (`within_tolerance = true`). The grid filters; the audit needs to show what was checked and passed, not only what failed.

---

## 9. `audit_log` — build step 6

**This is one table, not two.** The task brief listed `decisions` and `audit_log` separately; 02 §3f asked for notes and the override log to be normalised server-side into one shape with a `kind` field. Merging them is that decision, not a new one.

```sql
create table audit_log (
  id                 uuid primary key default gen_random_uuid(),
  reconciliation_id  uuid not null references reconciliations(id) on delete cascade,

  kind               audit_kind not null,          -- note | decision | system
  action             decision_action,              -- only when kind='decision'
  from_status        reconciliation_status,
  to_status          reconciliation_status,
  body               text,                         -- note text, or decision note

  -- 02 §3f — no users table in v1 (stub auth), but a real actor from day one.
  -- No FK until users exists. actor_name is denormalised so the timeline
  -- renders without a join.
  actor_id           text not null,
  actor_name         text not null,

  created_at         timestamptz not null default now(),

  -- a decision must record what it did and where it moved the record
  check (kind <> 'decision' or (action is not null and to_status is not null)),

  -- 01 §Exceptions — note required on reject and escalate
  check (kind <> 'decision' or action = 'approve' or nullif(btrim(body), '') is not null)
);

create index on audit_log (reconciliation_id, created_at);

revoke update, delete on audit_log from public;
```

- **Append-only, enforced by grant, not by convention.** An audit log you can edit isn't one.
- The status state machine (which transitions are legal) lives in Node, not in a trigger. `from_status` / `to_status` records what happened; the app decides what's allowed.
- `kind = 'system'` covers matcher events — status set at creation, auto-escalation firing. Without it the timeline starts mid-story.

---

## 10. No new tables for the Dashboard — build step 7

The Dashboard's KPIs are aggregates over `reconciliations`, `mismatches` and `audit_log`. No rollup tables, no materialised views in v1: at v1 volume a `GROUP BY` is fine, and a rollup table is a cache-invalidation problem you don't need yet.

Re-add trigger: when a Dashboard query exceeds ~500ms, add a materialised view refreshed on decision — not before.

---

# Derived vs stored

02 and 01 both call out fields that must be computed at read time. Consolidated here, plus the ones this schema stores deliberately.

## Never stored — computed at read time

| Field | Rule | Source |
|---|---|---|
| KPI values | API returns `{ value: 1842930, unit: "currency" }`. Never `"$1,842,930"`, never `"<2 min"`. Formatting is the frontend's job | 02 §3e |
| `ageLabel` (`"4h"`), `ageOld` | Derived from `created_at` in the browser. Stale the moment it's fetched otherwise | 02 §3f |
| Aging bucket counts | Same — derived from the same timestamps, not four stored counters | 02 §3f |
| Status display labels | From `StatusBadge`'s map. **Filter on the enum, never the label** | 01 §3.2 |
| Stage display labels | From the 01 §3.3 table | 02 §3b |
| `"N-way"` match mode label | `count(*)` over `reconciliation_documents` excluding `contract`, then `n \|\| '-way'` | 01 §3.1 |
| `tolerance_applied` (`"±2%"`) | Rendered from `tolerance_type` + `tolerance_value` | 02 §3 |
| Mismatch count | `count(*)` over `mismatches where not within_tolerance` | — |
| Open-exception badge count | Same query as the Exceptions list | 01 §Exceptions |

## Stored, but derived once at match time

These are denormalised on purpose: the Exceptions list sorts and filters on them, and recomputing a sum per row in a list query is wasteful. **Written once by the matcher, never edited afterwards.**

| Column | Derived from |
|---|---|
| `reconciliations.total_variance` | Sum over `mismatches` |
| `reconciliations.expected_payable` | The matched PO/GRN line totals |
| `reconciliations.confidence` | Rollup over `stages` — formula below |
| `reconciliations.confidence_driver_stage` | Which stage produced that number |
| `reconciliations.tolerance_snapshot` | `settings` as of `matched_at` |
| `documents.vendor_name_normalized` | Generated column, maintained by Postgres |

## The confidence rollup — formula

02 §3f left this open and said it can't be vague, because it gates auto-approval. Defining it here:

```
reconciliations.confidence          = MIN(stages.confidence) over all stages with confidence not null
reconciliations.confidence_driver_stage = the stage_key that produced that minimum
```

Why minimum and not a weighted average:

- **It's the weakest link that determines whether a human should look.** An average lets a 99% SLA check mask a 61% GRN match — which is exactly the compounding-variance case the mock's own summary describes.
- **It's explainable.** The Detail page can say "confidence is 74 because GRN Match is 74" and point at the row. A weighted average is a number nobody can argue with or debug.
- **It's monotonic.** Adding a stage can only lower confidence, never raise it. A 5-way run is never *more* confident than the 3-way subset of the same documents.
- It matches the mock, where the record-level `61` equals the lowest stage.

Auto-approve gate: `confidence >= settings.auto_approve_confidence`. With MIN this is strict, which is the right bias for v1 — the failure mode of being too strict is a reviewer clicking approve, and the failure mode of being too loose is paying a wrong invoice.

If minimum turns out to route too much to review, tune `auto_approve_confidence` **down** first. Don't change the rollup to average — that hides the signal instead of adjusting the threshold.

---

# What is NOT in this schema

Every one of these maps to something explicitly cut. If you find yourself adding one of these columns, you're building a cut feature.

| Mock field / concept | Cut | Verdict |
|---|---|---|
| `contractIntelligence.clauses[]` (clause, contractTerms, observed, status) | 01 cut #1 — contract-based validation | **Dropped.** No table, no columns. `contract` documents can be uploaded and stored, but nothing matches against them and the Detail card is hidden |
| Rate card / contracted unit price | 01 cut #1 | **Dropped.** Price validation compares against the **PO**, which is already a stored document with real line rates |
| SLA threshold / compliance % | 01 cut #1 | **Dropped** as a stored contract term. `actual_sla` stays as a per-run input only |
| Vendor auto-prediction, PO suggestion | 01 cut #2 | **Dropped.** No prediction columns, no confidence-of-match-to-vendor |
| `similarity: 94`, `matchType: "Fuzzy — ..."`, flagged pairs | 01 cut #3 — fuzzy duplicates | **Dropped.** Exact only, via `duplicate_of_id` + the `(vendor_name_normalized, invoice_number)` index |
| Fraud score, anomaly score, `"SLA / Fraud Check"` as real data | 01 cut #4 | **Dropped.** It's a label in a fake progress bar with nothing behind it |
| `riskScore`, `riskTier`, `mismatchRate`, `avgCycleTime`, `contractCompliancePct`, `openDisputes`, `totalHistoricalSpend` | 01 §2 — Vendor Intelligence out of scope | **Dropped.** No `vendors` table at all |
| `bbox` / page coordinates | 01 cut #5 | **Dropped as columns.** If Python emits them they land in `documents.raw_extraction` for free |
| ERP connection config, OAuth tokens, sync state | 01 §2 — ERP Config out of scope | **Dropped.** Only `documents.source` survives |
| Analytics `savedViews`, filter state, `dateScale` | 01 §2 — Analytics out of scope | **Dropped.** That's frontend state, and the page is demo-only |
| `tolerance_currency_pct` | 01 §Settings — single currency | **Dropped** |
| Settings change history / who-changed-what | 01 §Settings | **Dropped.** `settings.updated_by` is the whole audit for v1 |
| Per-vendor or per-category tolerance overrides | 01 §Settings | **Dropped** |
| `_id` | 02 §3a | **Retired.** `id uuid` |
| `stageTraces` as an object keyed by display name | 02 §3b | **Retired.** `stages` table with explicit `sort_order` |
| `"Layer 1"` / `"Layer 2"` | 01 §3.3 | **Retired.** Mismatches reference a `stage_key` |
| `pipelineStatus` (system health) | 01 §Dashboard — hidden in v1 | **Dropped.** No table. It was never per-invoice data |

---

# Decisions this document had to make

These weren't settled in 01 or 02. Flagging them so they get challenged now rather than discovered in review.

1. **`audit_log` is one table, not `decisions` + `audit_log`.** 02 §3f asked for notes and the override log normalised into one shape with a `kind` field; two tables would re-create the split it asked to remove. What you lose: a dedicated decisions table would let the DB enforce the transition state machine. That lives in Node instead.
2. **Confidence rollup = MIN over stages.** Reasoning above. This is the one with real product consequences — it decides how much gets auto-approved.
3. **A `currency char(3)` column exists despite single-currency scope.** It's constant `'USD'` in v1, not exposed in the UI, not a filter. Storing a constant costs nothing; adding a currency column to four tables after there's data in them costs a migration. This is not the cut multi-currency feature, it's the absence of a future migration. Say so if you disagree.
4. **`tolerance_snapshot jsonb` on every reconciliation.** Not in either prior doc. Without it, a tolerance change makes every historical decision unexplainable — and 02 §3 requires each mismatch to carry the tolerance that was applied. Cheap, and it's what makes "tolerance changes affect future runs only" (01 §Cross-cutting) actually verifiable.
5. **`settings.default_match_doc_types` is an array, not the string `"3-way"`.** 01 §3.1 set the default to 3-way; storing the doc-type set is the precise form of that same decision, since `"4-way"` alone doesn't say whether the fourth document is Quality or Service Entry.
6. **No `vendors` table.** Vendor name is denormalised text from the confirmed extraction. Consequence: exact duplicate detection relies on `vendor_name_normalized`, which is OCR output with casing and whitespace cleaned up. Good enough for v1; it's the first thing that breaks if vendor names arrive inconsistently.

---

# If the answer is Mongo, not Postgres

Only relevant if §Before anything comes back the other way. Rough shape of the change:

- `reconciliation_documents` disappears — documents become an embedded array on the reconciliation, and "one per type" stops being enforceable by the database.
- `line_items`, `stages` and `mismatches` embed into their parent documents. `stages` and `mismatches` are fine embedded (bounded, always read with the parent). `line_items` is fine too.
- The domains in §1 become application-level validation. Nothing stops a bad `status` string reaching the collection, which is precisely the failure mode 02 §3f warns about (`"Unknown"` badges).
- The generated `vendor_name_normalized` column becomes something the app must remember to write on every update.
- `revoke update, delete on audit_log` has no equivalent — append-only becomes a convention again.
- 02 §3d's requirement that both sides of a mismatch carry independent document and line references still holds and still works; it just isn't enforced.

The relational version is a better fit for this data — it's five tables of joins around one record — but the real cost of getting it wrong is picking one after there's data in it. **Decide it this week, with the other open items in 01 §5.**

---

*Basis: `01-SCOPE.md` and `02-ARCHITECTURE.md`. No code was re-read for this document.*
