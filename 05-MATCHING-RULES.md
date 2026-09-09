# 05 — Matching Rules

The algorithm inside `POST /reconciliations` (04 §B.1.3), between "load the documents" and "write the record".
Takes `01-SCOPE.md`, `02-ARCHITECTURE.md`, `03-DATA-MODEL.md` and `04-API-CONTRACT.md` as final. Defines behaviour, changes no schema and no endpoint.

Everything here runs **in Node, synchronously, over JSON already in the database** (02 §1, §2). No network calls, no OCR, no model. Arithmetic and joins.

**Ten decisions this document had to make** — §10. **Eight `[NEEDS CONFIRMATION]` numbers** — §11, same convention as 04 §F.

---

# §0 — The two axes, stated once

Almost everything below hangs off one distinction, so it goes first.

**Confidence measures how much we failed to verify. Variance measures how much money is at stake.** They are different questions, they are measured in different things, and they are never mixed.

| | `reconciliations.confidence` | `reconciliations.total_variance` |
|---|---|---|
| Denominated in | **comparisons** — ratios, unit-free, always 0–100 | **currency** — signed, `numeric(14,2)` |
| Answers | "did every check the match set demanded actually run and come back clean?" | "how far apart are the invoice and what we think we owe?" |
| Threshold | `settings.auto_approve_confidence` (default 90) | `settings.auto_escalate_variance` (default 500.00) |
| Rolls up by | **MIN** across stages (03 §Confidence rollup) | Single computation, §3 |

A dollar amount never enters a confidence number. A comparison count never enters a variance. They meet in exactly one place — the decision ladder in §8 — and §8 defines what happens when they disagree.

**One note on 04's example JSON.** The `confidence` values and `detail` strings in 04 §B.3.1 (`96`, `74`, `"Unit prices within ±2% of PO"`) were illustrative payload, not a spec of what each stage checks or what number it produces. §4 and §5 here are the spec. Where they differ, this document is right and 04's example is decoration.

---

# §1 — Per-field comparison rules

## §1.1 — The comparison primitive

Every comparison in this document is the same six steps. Nothing is special-cased outside this shape.

```
1. resolve  — pick the invoice-side value and the counterpart-side value
2. normalize — text only; numbers and dates are used as stored
3. skip     — if either side is null, no comparison happens and no mismatch row is written
4. compare  — produce `variance` (and `variance_pct` where meaningful)
5. judge    — within_tolerance = |variance| <= tolerance, per the field's tolerance type
6. write    — one `mismatches` row, whether it passed or failed
```

**Step 3 is load-bearing.** A null on either side is *not* a mismatch — it's an absence. A GRN has no `tax_amount` and comparing it to the invoice's would manufacture a finding out of nothing. Absences reduce the stage's **coverage** instead (§4), which lowers confidence without inventing a variance. 04 §A.3 already told Python to send `null` rather than `0` for exactly this reason.

**Step 6 writes rows for passes too.** 03 §8: *"the audit needs to show what was checked and passed, not only what failed."* The Detail grid filters; the row exists either way.

**`tolerance_type` is nullable, and null means exact.** 03 §8's check is `tolerance_type text check (tolerance_type in ('percent','absolute','units','days'))` with no `NOT NULL` — there is no `'exact'` value and this document does not add one. An exact-match field writes `tolerance_type = null, tolerance_value = null`, and 04 §B.3.1's `tolerance: { type, value }` comes back as `{ "type": null, "value": null }`. The frontend renders that as `"exact"`, the same way it renders `{percent, 2}` as `"±2%"` (03 §Derived).

## §1.2 — Numeric fields

| Field | Scope | Counterpart | Tolerance type | Settings field | Within tolerance when |
|---|---|---|---|---|---|
| `unit_price` | line | PO line | `percent` | `tolerance_price_pct` (2.00) | `\|variance_pct\| <= tolerance_price_pct` |
| `quantity` | line | GRN / Quality / Service Entry / PO line | `units` | `tolerance_quantity_units` (0) | `\|variance\| <= tolerance_quantity_units` |
| `line_total` | line | PO line | `percent` | `tolerance_price_pct` (2.00) | `\|variance_pct\| <= tolerance_price_pct` |
| `subtotal` | header | the invoice itself | `absolute` | none — §1.7 | `\|variance\| <= 0.01 × line_count` |
| `tax_amount` | header | the invoice itself | `percent` | `tolerance_tax_pct` (1.00) | `\|variance_pct\| <= tolerance_tax_pct` |
| `total` | header | the invoice itself, or PO in a degraded run | `absolute` / `percent` | none / `tolerance_price_pct` | see §5.5 |

In every row: `variance = invoice_value − expected_value`, **signed**. `variance_pct = 100 × variance / expected_value`.

Three edge rules, because they will otherwise be discovered in production:

- **`expected_value = 0`** → `variance_pct = null` (division by zero), and `within_tolerance` falls back to exact equality: `invoice_value = 0` passes, anything else breaches. A percentage tolerance around zero is meaningless and `numeric(7,4)` overflows long before it's useful.
- **`variance_pct` is capped at ±999.9999**, the domain limit of `numeric(7,4)` (03 §8). A 10,000% variance stores as the cap. `within_tolerance` is computed before the cap, so the judgement is never affected — only the displayed number is.
- **`tolerance_quantity_units` defaults to `0`**, which means quantity comparison is exact by default. That is deliberate (03 §4) and correct: a partial delivery is a real event a human should see, not float noise.

## §1.3 — Text fields

Text normalization before comparison, in this order: **trim → collapse internal whitespace to one space → uppercase**. Nothing else. This is deterministic, has no threshold, and is not fuzzy matching — see §1.5.

| Field | Scope | Counterpart | Rule |
|---|---|---|---|
| `sku` | line | PO / GRN line | Exact after normalization. **Only written when the pair was made by something other than SKU** — a SKU-paired line matches by construction (§2.1) and a row saying so is noise. |
| `uom` | line | PO / GRN / Quality / Service Entry line | Exact after normalization. A breach **suppresses the quantity comparison on that pair** — see below. |
| `po_ref` | header | PO's `doc_number` | Exact after normalization. This is the "does this invoice actually reference this PO" check. |
| `vendor_name` | header | PO / GRN | §1.5 — its own section. |
| `description` | — | — | **Never compared.** §1.6. |
| `doc_number` | — | — | **Never compared across documents.** §1.6. |

**The UOM rule matters more than it looks.** If the invoice bills `200 EA` and the PO says `2 BOX`, the raw quantity variance is `198` — a confidently wrong number that would drive `expected_payable` into nonsense. So:

- A `uom` breach writes its own mismatch row (`tolerance_type = null`, `within_tolerance = false`).
- The `quantity` row for that same pair is still written, with `variance = null` and `within_tolerance = false`. `variance` is nullable in 03 §8; null here reads as **"not comparable"**, which is the truth.
- That line contributes **nothing** to `expected_payable` (§3) — it drops out the same way an unpaired line does.

**There is no UOM conversion table in v1.** No `EA`↔`BOX`, no `KG`↔`G`. Conversion needs a per-vendor, per-SKU pack-size table, which is vendor master data, which is Vendor Intelligence, which is out of scope (01 §2, 03 §Decisions #6). *Re-add signal:* reviewers start seeing the same UOM pair rejected week after week.

## §1.4 — `doc_date`

Stored in `_value_text` as ISO (03 §8), compared as dates.

```
variance = days(invoice.doc_date − counterpart.doc_date)      -- signed, whole days
within_tolerance = (0 <= variance <= settings.tolerance_date_days)
tolerance_type = 'days',  tolerance_value = settings.tolerance_date_days
variance_pct = null
```

**Signed, and the negative side is not symmetric.** An invoice dated *after* the goods receipt by up to `tolerance_date_days` is normal billing lag. An invoice dated *before* the goods receipt is an invoice for goods that hadn't arrived yet — a real finding at any magnitude, so any negative variance breaches. `[NEEDS CONFIRMATION — §11.4]`

**`doc_date` is compared against the GRN, not the PO.** This is a deliberate narrowing and it is the only per-field rule here that overrides an obvious reading of 03 §4:

`tolerance_date_days` defaults to **5**. A PO is raised days-to-weeks before the vendor invoices against it — a 30-day gap is a normal procurement cycle, not a data problem. Applying a 5-day tolerance to the PO→invoice gap would breach on nearly every real invoice, drag `po_match` confidence down on all of them, and make the setting useless by making it always fire. The GRN→invoice gap is genuinely a data-quality signal: goods received, then billed, and a large gap or an inversion is worth a look.

One setting, two very different real-world gaps. Rather than silently applying it to both, it applies to the one where it means something. `[NEEDS CONFIRMATION — §11.3]`

## §1.5 — `vendor_name`, and why it stays exact

The field the task flags as fuzzy by nature. It stays exact, and the reasoning matters more than the rule.

### What is compared

Both sides are reduced by:

1. `documents.vendor_name_normalized` — the stored generated column (03 §2): lowercase, whitespace-collapsed, trimmed. Maintained by Postgres, already there.
2. **plus, in memory at match time:** strip punctuation (`. , & ' -` and parentheses), then strip a trailing **legal-entity suffix** from a closed list: `ltd, limited, llc, l.l.c, inc, incorporated, corp, corporation, co, company, plc, pvt, private, llp, gmbh, bv, sa, ag, pte`. Repeat once, so `"pvt ltd"` reduces. `[NEEDS CONFIRMATION — §11.1]`

Then **exact string equality**. Equal → pass. Not equal → mismatch row, `tolerance_type = null`, `within_tolerance = false`.

`"Meridian Components Ltd."`, `"MERIDIAN  COMPONENTS LIMITED"` and `"meridian components pvt ltd"` all reduce to `meridian components` and match. `"Meridian Components"` and `"Meridian Componentz"` do not, and never will in v1.

### Why this is not the fuzzy matching that 01 cut #3 cut

This is the part worth being precise about, because "normalize harder" and "match fuzzily" look similar from a distance and are not the same thing.

01 cut #3 cut **similarity scoring**: 94%-match flagging, a tuned threshold, a false-positive review flow, and its own screen. The reason given was not "similarity is bad" — it was that a threshold has to be tuned against real data you don't have yet, and a tuned threshold needs a review flow for what it gets wrong, and that flow is a feature on its own.

The test for whether something is the cut feature:

| | Normalization (§1.5) | Similarity scoring (cut #3) |
|---|---|---|
| Has a tunable number | No | Yes — the threshold |
| Two different inputs can collide | Only if they reduce identically, deterministically | Yes, and how often depends on the number |
| Reviewable | Read the suffix list in a code review | Only against real data |
| Needs a false-positive flow | No | Yes |
| Output | equal / not equal | a score |

**Normalization has no tunable number.** The suffix list is a closed list of literals you can read in a diff. Adding `gmbh` to it is a code change with a knowable effect; moving a similarity threshold from 0.94 to 0.91 is not. 03 §2 already drew this line for the stored column — *"This is normalisation, not fuzzy matching"* — and §1.5 stays on the same side of it.

**So: no Levenshtein, no trigram similarity, no soundex, no token-set ratio, anywhere in v1** — not on vendor names, not on descriptions (§2.4), not in the duplicate scan (§7). The moment any of those appears, cut #3 has been rebuilt without the review flow that made it a real feature.

*Re-add signal:* reviewers start approving vendor-name mismatches at a rate that makes the check noise rather than signal. At that point the fix is a **vendor alias table** — an explicit, human-curated mapping — not a similarity score. An alias table has no threshold either.

### Why a vendor mismatch fails the stage

A `vendor_name` breach between the invoice and the PO does not mean "the OCR was a bit off". It means **the user attached the wrong PO** — and in v1 the user attaches every document by hand (01 §Upload, ERP source cut). Every downstream comparison in that stage is then comparing two unrelated documents, and its variances are fiction.

So a `vendor_name` breach sets the stage's `status` to `'failed'` (§4.3), which forces `human_review` by the decision ladder (§8) regardless of what the numbers say. Same for `po_ref`.

### What the stored column is still for

`documents.vendor_name_normalized` and `reconciliations.vendor_name_normalized` stay exactly as 03 defines them, and the **duplicate scan uses the stored column alone** — no suffix stripping (§7.2). Two different jobs:

- §1.5 compares **two strings already in hand**. It can afford the extra reduction; there's no index to satisfy.
- §7 scans **the whole table**, and must be served by 03 §5's `(vendor_name_normalized, invoice_number)` index. Suffix-stripping at match time would make that index useless and 03 is final — no new index gets added here.

The consequence is real and should be known: a vendor whose name is stored inconsistently across two invoices (`"Meridian Ltd"` vs `"Meridian Limited"`) will match in §1.5 and **miss in §7**. That is the conservative failure — a missed duplicate flag, which a reviewer can still catch, rather than a false one that blocks a legitimate payment.

## §1.6 — Fields in `matchable_field` that raise no mismatch in v1

Two of the thirteen. Both stay in the domain; neither produces a row.

**`description`** — free text from two different systems. `"Hex bolt M8x40, zinc"` against `"BOLT HEX M8 X 40 ZN"` is the normal case, not the exception, and a mismatch on it tells a reviewer nothing they can act on. It is used for **pairing** (§2.1 rung 3) and it is displayed in the side-by-side compare. It is never compared to produce a finding.

**`doc_number`** — the invoice's `doc_number` is `INV-1001` and the PO's is `PO-88213`. They are *supposed* to differ; comparing them would breach on every single run. The real check is the invoice's `po_ref` against the PO's `doc_number`, and that is written under the `po_ref` field (§1.3). `doc_number` is read by the duplicate scan (§7), which writes to `duplicate_of_id` rather than to `mismatches`.

Both stay in `matchable_field` because that domain is the addressing vocabulary for the whole app (03 §1) — the side-by-side viewer's `{line_no, field}` references, the mismatch grid's columns — not a list of things that get compared. Same reason `contract` sits in `document_type` and is never extracted (04 §A.2).

## §1.7 — The self-consistency tolerances have no settings field, on purpose

`subtotal` and `total` are checked against the invoice's own arithmetic (§5.5). Their tolerance is `absolute`, value `0.01 × line_count`, floor `0.01`.

There is no setting for it and there should not be. Per-line rounding is float noise, not a business decision — a 40-line invoice can legitimately be 40 cents off from the sum of its lines and nobody in AP has an opinion about that number. `tolerance_price_pct` is a commercial tolerance ("how much price drift do we accept from this vendor"); this is not the same kind of thing and giving it a slider would invite someone to widen it to $500 and silently disable the check. `[NEEDS CONFIRMATION — §11.2]`

---

# §2 — Line-level reconciliation

03 §3d is the constraint: **invoice line 1 is not necessarily PO line 1**, and the schema stores `invoice_line_no` and `expected_line_no` as independent columns for exactly that reason.

Pairing is computed **once per (invoice, counterpart) document pair**, before any stage runs, and every stage that touches that counterpart reuses the same pairing. `po_match` and `price_validation` both compare invoice↔PO and must never disagree about which line is which.

## §2.1 — The pairing ladder

Deterministic, first rung that produces a pair wins, each line pairs at most once.

**Rung 1 — SKU, unique on both sides.** Normalize both `sku` values (§1.3). If a normalized SKU appears exactly once on the invoice and exactly once on the counterpart, those two lines pair. This is the case that should cover most real documents and it is the only rung with no ambiguity at all.

**Rung 2 — SKU, repeated.** If a normalized SKU appears more than once on either side, pair the occurrences **in ascending `line_no` order** — invoice's 1st occurrence to counterpart's 1st, 2nd to 2nd, and so on. Surplus occurrences on either side stay unpaired. Deterministic, and `line_no` is stable because 04 §A.3 requires Python to preserve the printed order.

**Rung 3 — normalized description, unique on both sides.** Normalize `description` the same way as any text field (§1.3), then apply the same rule as rung 1: exact equality, unique on both sides. This catches the very common case where both systems carry the same description string copied from the same catalogue. **Exact after normalization — not similar.** No threshold, so this is not cut #3 (§1.5).

**Rung 4 — position, and only under two conditions together.** Pair invoice line *n* to counterpart line *n*, but **only if** every one of the following holds:

- neither document has a usable `sku` on any line (all null or empty after normalization), **and**
- both documents have the same number of lines, **and**
- no pairs were made by rungs 1–3.

`[NEEDS CONFIRMATION — §11.7]`

**Rung 5 — unpaired.** Everything else. §2.2.

### Why rung 4 is that restrictive

Because a wrong pair is worse than no pair. A wrong pair produces a confident, specific, precisely-wrong variance — "line 3 billed at $61.50 against $12.00 ordered" — which a reviewer has to unpick by hand, and which flows into `expected_payable` as a real number. An unpaired line produces a visible hole that the reviewer sees immediately and that lowers confidence honestly (§4.2).

If the line counts differ and there are no SKUs, any positional mapping is a guess dressed up as arithmetic. So it doesn't happen.

The cost is real: documents with no SKUs and unequal line counts pair nothing and the run degrades to `human_review`. That is the safe failure, and it is the same bias 01 states everywhere — *"the failure mode of being too strict is a reviewer clicking approve, and the failure mode of being too loose is paying a wrong invoice."*

## §2.2 — An unpaired invoice line is not a mismatch row

**It cannot be one.** 03 §8 makes `expected_document_id` `NOT NULL`, and adds `check (scope <> 'line' or (invoice_line_no is not null and expected_line_no is not null))`. A line with no counterpart has no expected document and no expected line number. There is no legal row to write, and this document does not change the schema to make one.

So an unpaired invoice line is expressed three ways, none of which is a `mismatches` row:

1. **It reduces the stage's coverage**, which lowers stage confidence directly (§4.2). This is the mechanism — an unverifiable line makes the stage less confident, which is exactly what confidence means (§0).
2. **It is named in `stages.detail`**: `"2 of 12 invoice lines had no matching PO line (lines 4, 9)"`. The Detail page renders that string as-is (03 §7 — no label column, the detail *is* the text).
3. **It contributes zero to `expected_payable`** (§3), so its full amount lands in `total_variance`. An invoice line with no PO backing is a line nothing authorised — the expected payable for it is nothing.

Point 3 is the one that matters commercially. A single unpaired $50,000 line on a 500-line invoice produces `confidence ≈ 99` and `total_variance = 50,000`, which is precisely the case the decision ladder's variance rule exists for (§8.3).

## §2.3 — An unpaired counterpart line is not a finding

A PO line the invoice never bills is **under-billing**, and under-billing is not a payment risk. Partial delivery and partial invoicing are normal. So:

- No mismatch row.
- **Does not reduce coverage** and does not affect confidence.
- Named in `stages.detail` for the reviewer: `"3 PO lines not billed on this invoice"`.

Coverage is asymmetric on purpose: it measures **how much of the invoice we managed to verify**, not how much of the PO got used. You hold a payment because you can't verify what's being charged, never because the vendor charged you for less than you ordered.

## §2.4 — What is deliberately not here

- **Description similarity for pairing.** Needs a threshold; a threshold is cut #3's shape (§1.5). Rung 3 is exact-after-normalization and stops there. *Re-add signal:* SKU-less documents become common enough that rung 4 is failing regularly on unequal line counts.
- **Quantity-aware pairing** (splitting one invoice line across two PO lines, or merging). Real, and out of scope — it needs an allocation model, not a pairing key.
- **UOM conversion** during pairing (§1.3).

---

# §3 — `expected_payable` and `total_variance`

03 §Derived says `reconciliations.total_variance` is *"Sum over `mismatches`"*. That one-liner cannot be implemented as written, and this is the largest thing this document has to resolve.

**Why it can't:** `mismatches.variance` holds whatever unit the field is in. A `quantity` row's variance is `2` (units). A `doc_date` row's is `−3` (days). A `unit_price` row's is `0.45` (dollars per unit). A `line_total` row's is `90.00` (dollars). Summing them produces a number with no unit, and `reconciliations.total_variance` is `numeric(14,2)` sitting on the Detail page next to `invoice_total` and `expected_payable` — it is unambiguously money.

So `total_variance` is defined here as a money computation, and the two derived money columns are defined together.

## §3.1 — Per-line payable

For each invoice line **L**, after pairing (§2):

```
qty_payable(L)   = min( L.quantity, and every counterpart quantity paired to L )
price_payable(L) = min( L.unit_price, PO line unit_price paired to L )
payable(L)       = qty_payable(L) × price_payable(L)
```

with these overrides, in order:

| Condition | `payable(L)` |
|---|---|
| L has no PO line paired to it | `0` |
| L's pair breached `uom` (§1.3) | `0` |
| No PO in the match set at all | `L.line_total` |
| A counterpart quantity is null | that counterpart drops out of the `min`, the others still apply |

"Every counterpart quantity paired to L" means the GRN's, the Quality doc's and the Service Entry's, whichever are in the match set. **This is what makes 3-way, 4-way and 5-way matching actually mean something financially**: you pay for the lower of what was ordered, received, accepted and billed, at the lower of the agreed and billed rate. Adding a document to the match set can only ever lower the payable, never raise it — which is the same monotonicity property 03 gives the confidence rollup.

## §3.2 — The two columns

```
expected_payable = Σ payable(L) over all invoice lines  +  invoice.tax_amount
total_variance   = invoice.total − expected_payable
```

- **Signed.** Positive = the invoice asks for more than we think we owe. Negative = it asks for less. The sign is load-bearing in §8.3.
- **Tax passes straight through.** A `tax_amount` breach (§5.5) writes its own mismatch row and drags confidence down, but it does not re-price the vendor's tax line inside `expected_payable`. Recomputing someone's tax and calling the result "expected payable" is a different product.
- **Header-only / degraded runs** (04 §A.5, no line items on one side): `expected_payable = PO.total + 0` when a PO is present with a usable `total`, otherwise `invoice.total` — in which case `total_variance = 0` and the run carries no money signal at all. That is honest: nothing priced it. The degraded stage is already capped at confidence 60 (04 §A.5), so the run cannot auto-approve and a human sees it.

## §3.3 — What this fixes

The Detail page's financial summary (01 §Invoice Detail: *"invoice total, expected payable, total variance"*) becomes three numbers that add up:

```
invoice_total  −  expected_payable  =  total_variance
```

Under 03's literal reading they would not have. Every stage's finding still lands in `total_variance`, but through `payable(L)` rather than through a unit-mixing sum: a quantity breach lowers `qty_payable`, a price breach lowers `price_payable`, an unpaired line zeroes the term. The `mismatches` rows remain the **explanation** of the variance; they are not the arithmetic of it.

---

# §4 — Stage confidence: one definition, so MIN means something

03 §Confidence rollup takes `MIN(stages.confidence)`. The task's objection is correct and it is the sharpest problem in this document: **if `po_match` confidence means "how many lines paired" and `duplicate_scan` confidence means "how sure we are it isn't a duplicate", the minimum of the two is a category error.** MIN is only valid across quantities that measure the same thing on the same scale.

So every stage produces its confidence with the **same formula over the same two ratios**. No stage gets its own scheme.

## §4.1 — The definition

> **A stage's confidence is the percentage of the checking it was supposed to do that it actually did, and that came back clean.**

Both terms in that sentence are **counts of comparisons**. Never dollars, never units, never days. That is what makes MIN across stages legitimate: every stage is answering "how much of my job did I complete successfully", and the minimum is "the stage that verified the least".

## §4.2 — The formula

Every stage computes exactly this:

```
expected_comparisons  = the comparisons this stage should have made, given the documents in the match set
made_comparisons      = the comparisons it actually made (both sides non-null, §1.1 step 3)
breached_comparisons  = of those, how many came back within_tolerance = false

severity_coverage = 1 − (made_comparisons / expected_comparisons)      -- 0 if expected = 0
severity_breach   = breached_comparisons / made_comparisons             -- 0 if made = 0

raw = 100 × (1 − max(severity_coverage, severity_breach))
```

then two caps, applied in order:

```
if the stage ran degraded (header-only, 04 §A.5):   raw = min(raw, 60)
if breached_comparisons > 0:                        raw = min(raw, settings.auto_approve_confidence − 1)

confidence = round(clamp(raw, 0, 100))
```

**`max`, not a weighted sum.** Same reasoning 03 gives for MIN over stages: it's the weakest link that decides whether a human should look, and an average lets good coverage mask a breach rate.

**The breach cap is the important one.** Without it, one breach on a 200-line invoice gives `severity_breach = 0.005` → confidence 99 → auto-approved. A single line outside tolerance would auto-approve the whole invoice, purely because the invoice was long. With the cap, **any stage with any out-of-tolerance comparison is arithmetically incapable of auto-approving**, and the property "confidence ≥ threshold ⟺ nothing needed a human" becomes true by construction instead of by luck. `[NEEDS CONFIRMATION — §11.5]`

**Unpaired invoice lines enter through `expected_comparisons`, not `breached`.** A stage comparing 3 fields across 12 invoice lines has `expected_comparisons = 36`; if 2 lines never paired, `made_comparisons` is at most 30 and `severity_coverage = 0.167` → confidence 83. Nothing breached, but a sixth of the job didn't get done, and the number says so.

## §4.3 — `stages.status`

The four values in 03 §1, with no overlap:

| Value | When | Confidence |
|---|---|---|
| `passed` | `severity_coverage = 0` and `breached_comparisons = 0` | 100 |
| `warning` | The stage ran and found breaches, **or** ran with incomplete coverage, **or** ran degraded | per §4.2 |
| `failed` | A **structural** problem makes the whole stage's output untrustworthy — see below | per §4.2 |
| `skipped` | In the match set, but the counterpart document has no non-null value for any field this stage compares | `null` |

**`failed` is reserved for exactly three conditions**, all of which mean "the wrong document is attached", not "the numbers are off":

1. `vendor_name` breach against this stage's counterpart (§1.5)
2. `po_ref` breach (invoice references a different PO than the one attached)
3. Both documents have line items and **zero pairs were produced** (§2.1 rung 5 for everything)

A stage that merely found variances is `warning`, however large they are. Magnitude is `total_variance`'s job (§0), not status's.

**`skipped` carries `confidence = null` and is excluded from the MIN** — 03 §Confidence rollup says *"over all stages with confidence not null"*. That creates a hole: a run where `grn_match` couldn't run at all would otherwise score identically to one where it passed, which is exactly backwards. It is closed by a hard rule in the decision ladder rather than by faking a number: **any `skipped` stage forces `human_review`** (§8.2, rule 3). The confidence number stays honest and the decision stays safe.

## §4.4 — The `decision` stage is not part of its own rollup

`decision` reports the rollup as its own confidence (matching 04 §B.3.1's example, where both are 74). To keep that from being circular:

```
reconciliations.confidence          = MIN(confidence) over all stages except 'decision', where confidence is not null
reconciliations.confidence_driver_stage = the argmin — ties broken by lowest sort_order
stages['decision'].confidence       = that same value
```

`confidence_driver_stage` is a `stage_key` domain value (03 §5) and can therefore never be `'decision'` in practice, which is what makes 03's promise work — *"the Detail page can say 'confidence is 74 because GRN Match is 74' and point at the row."* Pointing at the decision row would be pointing at itself.

## §4.5 — The one stage where n = 1

`duplicate_scan` makes exactly one comparison (§7). `made = 1`; `breached` is 0 or 1; confidence is therefore 100 or 0. Binary, and that is not an exception to §4.1 — it is the same ratio with a denominator of one. It reads correctly under MIN too: a duplicate hit drops the record's confidence to 0, which is the right thing for "do not pay this", and the status override in §8.2 makes the decision regardless.

---

# §5 — Stage execution

Ownership, so no two stages compare the same thing:

| Stage | Counterpart | Header fields | Line fields |
|---|---|---|---|
| `po_match` | PO | `vendor_name`, `po_ref` | `sku`, `uom`, `quantity` |
| `grn_match` | GRN | `vendor_name`, `doc_date` | `uom`, `quantity` |
| `quality_match` | Quality | — | `quantity` |
| `service_entry_match` | Service Entry | — | `uom`, `quantity` |
| `price_validation` | PO (money) + the invoice itself | `subtotal`, `tax_amount`, `total` | `unit_price`, `line_total` |
| `duplicate_scan` | prior reconciliations | — | — |
| `decision` | — | — | — |

**All money lives in `price_validation`. All quantities and identity live in the match stages.** That split is why `price_validation` is `Always` in 03 §1 — the invoice's own arithmetic is checkable with no counterpart at all — and it means every `mismatches` row that feeds `payable(L)`'s price term carries one `stage_key`, which makes the Detail grid groupable by cause.

`sort_order` (03 §7) follows this table top to bottom, renumbered over the stages that actually ran, starting at 1.

## §5.1 — `po_match`

**Runs when** a `po` document is in the match set (§6).

**Pairs** invoice lines to PO lines (§2.1). The resulting pairing is cached and reused by `price_validation`.

**Compares:** `vendor_name` (invoice ↔ PO, §1.5) · `po_ref` (invoice's `po_ref` ↔ PO's `doc_number`, §1.3) · per pair: `sku` (only when the pair came from rungs 3–4), `uom`, `quantity` (invoice billed vs PO ordered, `tolerance_quantity_units`).

**`expected_comparisons`** = 2 header + (2 or 3 per invoice line, depending on whether the SKU check applies) × invoice line count.

**Status:** `failed` on a `vendor_name` or `po_ref` breach, or on zero pairs. `warning` on any other breach or incomplete coverage. `passed` otherwise.

**Detail string** names the unpaired lines on both sides (§2.2, §2.3) and the breach count.

## §5.2 — `grn_match`

**Runs when** a `grn` document is in the match set.

**Compares:** `vendor_name` · `doc_date` (invoice ↔ GRN, `tolerance_date_days`, signed, §1.4) · per pair: `uom`, `quantity` — **billed vs received**.

**One-sided in the money, two-sided in the finding.** Billing *more* than was received is the classic 3-way failure and it lowers `qty_payable` (§3.1). Billing *less* than was received is also written as a mismatch row (it's a real discrepancy, and `tolerance_quantity_units` defaults to 0 so it breaches), but `min()` means it cannot raise the payable. Under-billing is a finding, never a cost.

**No price fields.** A GRN is a receipt note; it carries no rates. If Python returns `unit_price` on a GRN line it is ignored here and sits in `raw_extraction`.

**Status:** `failed` on `vendor_name` breach or zero pairs. `warning` on breaches or partial coverage. `passed` otherwise.

## §5.3 — `quality_match`

**Runs when** a `quality` document is in the match set.

**Compares:** per pair, `quantity` — **billed vs accepted**. The quality document's `line_items.quantity` is read as the *accepted* (inspection-passed) quantity; there is no `accepted_quantity` field in the extract schema (04 §A.3) and this document does not add one. `[NEEDS CONFIRMATION — §11.8]`

Feeds `qty_payable` through the same `min()` as every other counterpart (§3.1). Billing above the accepted quantity is the finding this stage exists for.

**No `vendor_name` check** — an inspection report is frequently issued by an internal QA function or a third-party inspector, not the vendor, so its vendor field is unreliable and comparing it would breach routinely.

## §5.4 — `service_entry_match`

**Runs when** a `service_entry` document is in the match set.

Structurally identical to `grn_match` for services: `quantity` is confirmed hours or milestone units, `uom` matters (hours vs days is the classic error), and the confirmed quantity feeds `qty_payable`. `quantity` is `numeric(14,4)` precisely because service hours come in fractions (03 §Conventions).

**No `doc_date` check** — a service entry covers a period rather than a delivery event, and there is no period model in the schema.

## §5.5 — `price_validation`

**Always runs** (03 §1). Two groups of checks; the second group needs no counterpart, which is why the stage can always run.

**Group A — against the PO** (only when a PO is in the match set), reusing `po_match`'s pairing:

| Comparison | Tolerance | Setting |
|---|---|---|
| invoice `unit_price` ↔ PO `unit_price` | `percent` | `tolerance_price_pct` |
| invoice `line_total` ↔ PO `line_total` | `percent` | `tolerance_price_pct` |

Both are written even though `line_total` is arithmetically implied by `quantity × unit_price`. They answer different reviewer questions — *"were we overcharged per unit"* vs *"how much is this line out by"* — and only the second is in money. Neither is summed into `total_variance`; that comes from `payable(L)` (§3.1), so there is no double-counting.

**Group B — the invoice against itself**, `expected_document_id = invoice_document_id`, `expected_line_no = invoice_line_no`:

| Comparison | Tolerance | Setting |
|---|---|---|
| `line_total` vs `quantity × unit_price` | `absolute`, `0.01` | none (§1.7) |
| `subtotal` vs `Σ line_total` | `absolute`, `0.01 × line_count` | none |
| `total` vs `subtotal + tax_amount` | `absolute`, `0.01 × line_count` | none |
| `tax_amount` vs `subtotal × (reconciliations.tax_rate / 100)` | `percent` | `tolerance_tax_pct` |

Group B is what catches an OCR digit drop — a `total` that doesn't equal its own parts is a broken read of the document, not a vendor dispute, and it should not be quietly paid. Both sides of these rows point at the same document, which is legal (03 §8 constrains `expected_document_id` to `NOT NULL`, not to a *different* document).

**The tax check is skipped when `reconciliations.tax_rate` is null.** It defaults to `0` in the wizard today and 01 §5 flags that as unresolved — *"every run today claims zero tax"*. Comparing a real tax amount against a computed zero would breach on every invoice and make the check noise. Null in, no comparison, coverage reduced, nothing invented. When 01 §5's `tax_rate` question is settled the check starts meaning something with no change here.

**Degraded mode** (no line items on the invoice, 04 §A.5): Group A is dropped, Group B keeps only the `total` vs `subtotal + tax_amount` and `tax_amount` rows, the stage is capped at confidence 60, and — when a PO is present — one extra header comparison runs, invoice `total` ↔ PO `total` at `tolerance_price_pct`.

**Status:** `warning` on any breach or when degraded. `passed` otherwise. Never `failed` — this stage has no way to detect a wrong document; that's `po_match`'s job.

## §5.6 — `duplicate_scan`

Always runs. §7.

## §5.7 — `decision`

Always runs, always last. §8. Its `detail` is the one-line reason the status was chosen, and the same string goes into the `kind='system'` audit row that `POST /reconciliations` writes (04 §B.1.3).

---

# §6 — Which stages run

**The attached documents decide. `settings.default_match_doc_types` does not.**

```
match_set = { distinct document_type in reconciliation_documents }  −  { 'invoice', 'contract' }
```

| Stage | Row written when |
|---|---|
| `po_match` | `'po' ∈ match_set` |
| `grn_match` | `'grn' ∈ match_set` |
| `quality_match` | `'quality' ∈ match_set` |
| `service_entry_match` | `'service_entry' ∈ match_set` |
| `price_validation` | always |
| `duplicate_scan` | always |
| `decision` | always |

A stage not in that list gets **no row at all** — absent, not null, not `'skipped'` (03 §7). A 3-way run's `stages` array has five entries and the frontend must not assume a fixed set (04 §B.3.1).

## §6.1 — Why the setting doesn't decide

`settings.default_match_doc_types` seeds the **wizard's checkboxes** and nothing else (01 §Upload, 04 §B.1.4). It is a default, and the user can change it on the Review step before submitting.

More decisively: `POST /reconciliations` does not accept a `match_mode` at all (04 §B.1.3, §E.3) — the request is a list of `document_ids`. There is nothing to read the setting against at match time, and reading it anyway would create the exact failure it was removed to prevent: a user who attaches a GRN under a `{po}` default would watch their GRN be stored, counted in the N-way label, and silently never matched.

**The document set is the match mode** (03 §6). The setting decides what the wizard suggests; the attachments decide what runs.

## §6.2 — `contract` documents

Excluded from `match_set`, excluded from the N-way count (03 §6), never compared against anything (01 cut #1). A `contract` in `reconciliation_documents` affects nothing in this document except that it is stored and displayed.

## §6.3 — `skipped` vs absent

`'skipped'` is for a stage that **was** in the match set and couldn't run: the counterpart document has no non-null value for any field the stage compares. In practice this needs a document that failed extraction (04 §A.4) and was then confirmed by the user without any fields typed in — rare, since 04 §B.1.3 requires `confirmed_at`, but reachable.

A `skipped` stage writes its row with `confidence = null`, a detail string naming the document, and forces `human_review` (§8.2 rule 3).

A counterpart that has header fields but no line items is **not** `skipped` — that's the degraded path: `warning`, capped at 60 (04 §A.5).

---

# §7 — `duplicate_scan`, concretely

## §7.1 — What counts as a hit

01 cut #3 keeps exact detection and defines it: *"same vendor + same invoice number, or same vendor + same amount + same date"*. Two conditions, evaluated in this order:

**Condition A — vendor + invoice number.**

```sql
select id from reconciliations
where vendor_name_normalized = :invoice_vendor_normalized
  and upper(btrim(invoice_number)) = :invoice_number_normalized
  and status <> 'rejected'
order by created_at desc
limit 1
```

Served by 03 §5's `(vendor_name_normalized, invoice_number)` index. This is the strong signal — the same vendor billing the same invoice number twice.

**Condition B — vendor + amount + date**, only if A found nothing.

```
reconciliations.vendor_name_normalized  =  this invoice's normalized vendor
reconciliations.invoice_total           =  this invoice's total          (exact, to the cent)
the prior record's invoice document doc_date = this invoice's doc_date   (exact)
status <> 'rejected'
```

**Condition B is not index-backed and needs a join.** `reconciliations` has no `doc_date` column (03 §5 has `created_at`, `matched_at`, `decided_at` — none of which is the invoice's date), so B joins `reconciliation_documents → documents` to reach it. At v1 volume that's fine, and it's the same posture 03 §10 takes for Dashboard aggregates. *Re-add signal:* the same one 03 §10 gives — when it exceeds ~500ms, add a functional index; not before.

**Both conditions are exact.** No similarity, no shifted-invoice-number patterns, no 94% anything — that is cut #3 and §1.5 explains why it stays cut.

**Normalization used here is the stored column only** — no legal-suffix stripping (§1.5). The index is on the stored column and 03 is final. The consequence is a conservative miss rather than a false block, which is the right direction for a check that stops payments.

**`rejected` records are excluded** from both conditions. A rejected invoice that the vendor corrects and re-issues is a resubmission, not a double payment — nothing was paid the first time. Everything else is included, `touchless_approved` and `duplicate_flagged` alike. `[NEEDS CONFIRMATION — §11.6]`

## §7.2 — What happens on a hit

**It runs alongside. It does not block.** Every other stage runs in full and writes its rows.

Three reasons: the reviewer deciding whether this is a genuine duplicate or a legitimate re-issue needs the whole mismatch picture, not an empty record; a blocked run would produce a `reconciliations` row with no `stages`, which breaks the Detail page's pipeline timeline (01 §Invoice Detail); and `duplicate_scan` is one stage in an ordered list (03 §7), not a gate in front of the list.

On a hit:

| | |
|---|---|
| `reconciliations.duplicate_of_id` | the `id` of the matched prior reconciliation |
| `stages['duplicate_scan'].status` | `'failed'` |
| `stages['duplicate_scan'].confidence` | `0` (§4.5) |
| `stages['duplicate_scan'].detail` | `"Exact match on vendor + invoice number: INV-1001, 2026-07-02"` |
| `reconciliations.status` | forced to `duplicate_flagged` (§8.2 rule 1) |
| `mismatches` | **no rows** — a duplicate is not a field variance |

On no hit: `status = 'passed'`, `confidence = 100`, `duplicate_of_id` stays null, detail `"No exact match on vendor + invoice number or vendor + amount + date"`.

## §7.3 — `duplicate_of_id` is a single FK

03 §5 gives one nullable self-reference, so **the most recent hit wins** — condition A first, then B, `order by created_at desc limit 1`. 04 §B.3.1's `duplicate_check.matches[]` is an array with at most one entry in v1, and that is why.

The scan never considers the record being created (it doesn't exist yet at match time — `duplicate_scan` runs before the insert, inside the same transaction).

---

# §8 — The decision stage

## §8.1 — Inputs

| Input | From |
|---|---|
| `confidence` | the rollup, §4.4 |
| `total_variance` | §3.2, **signed**, currency |
| `auto_approve_confidence` | `settings`, default 90 |
| `auto_escalate_variance` | `settings`, default 500.00 |
| duplicate hit | §7 |
| any stage `status = 'failed'` | §4.3 |
| any stage `status = 'skipped'` | §4.3 |

Both thresholds are read from the **`tolerance_snapshot`** written onto this reconciliation (03 §5), not re-read from `settings` later. That's what makes an old decision explainable after someone moves a slider (01 §Cross-cutting).

## §8.2 — The ladder

First rule that matches wins. This *is* the answer to "what happens when the two thresholds disagree" — the ordering is the answer.

| # | Condition | `status` |
|---|---|---|
| 1 | `duplicate_of_id is not null` | `duplicate_flagged` |
| 2 | any stage `status = 'failed'` | `human_review` |
| 3 | any stage `status = 'skipped'` | `human_review` |
| 4 | `total_variance > auto_escalate_variance` | `escalated` |
| 5 | `confidence >= auto_approve_confidence` | `touchless_approved` |
| 6 | otherwise | `human_review` |

`decision` stage: `status = 'passed'` for rule 5, `'warning'` for rules 2/3/6, `'failed'` for rules 1 and 4. `detail` is the reason, one line, and the same string goes into the system audit row.

Rules 2 and 3 sit **above** the numeric rules on purpose. A `failed` stage means the wrong document is attached (§4.3) and a `skipped` stage means something in the match set was never checked — in both cases the numbers below are describing a comparison that shouldn't be trusted, so no threshold gets to override them.

## §8.3 — When the two thresholds disagree

The four quadrants, explicitly.

**High confidence, high variance → `escalated`** (rule 4 fires before rule 5).

This is the case the second threshold exists for, and it is reachable: **unpaired lines lower coverage but are not breaches** (§2.2, §4.2), so one unpaired $50,000 line on a 500-line invoice gives `severity_coverage ≈ 0.002` → confidence 99, no breach cap applies, and `total_variance = 50,000`. Confidence says "we verified nearly everything". Variance says "fifty thousand dollars has no PO behind it". **Money wins.** Confidence is a ratio and ratios wash out on long documents; variance is the amount actually at risk and does not.

**Low confidence, high variance → `escalated`.** Rule 4 again, no tension.

**Low confidence, low variance → `human_review`** (rule 6), not `escalated`. Many small breaches, nothing much at stake — a reviewer clicks approve and moves on. Escalating it would push a $12 discrepancy up a management chain, which is how an exceptions queue becomes something people stop reading.

**High confidence, low variance → `touchless_approved`** (rule 5). The happy path, and note that §4.2's breach cap means it genuinely required **zero** out-of-tolerance comparisons anywhere — not "few enough to average out".

## §8.4 — `total_variance > threshold` is signed, deliberately

Not `abs(total_variance)`. A large **negative** variance means the vendor billed less than the PO authorised — under-billing, partial delivery, an early-milestone invoice. It is not a payment risk and it does not escalate. It still shows in the financial summary and its underlying quantity breaches still lower confidence, so it lands in `human_review` via rule 6 if anything actually breached.

This is easy to "fix" into `abs()` during a code review and it should not be. Flagged here so the reasoning is on paper.

## §8.5 — The threshold that will cause an argument

`auto_escalate_variance` defaults to `500.00` — **a flat amount**, while every price tolerance is a **percentage**. On a large invoice these disagree by construction:

> A $60,000 invoice, every line within the 2% price tolerance, nothing breached anywhere, confidence 100 — and a legitimate 1.5% drift is $900. Rule 4 fires. **A completely clean run escalates.**

That is not a bug in the ladder; it is two thresholds measuring different things, which is the point. But it means the touchless rate on large invoices trends toward zero, and the touchless rate is a headline Dashboard KPI (04 §B.5.1). Whoever owns that KPI needs to know before the first demo. `[NEEDS CONFIRMATION — §11.6]`

## §8.6 — What the decision stage does not do

- **No auto-reject.** `rejected` is only ever reached through `POST /reconciliations/:id/decision` by a human (04 §C). The matcher never rejects an invoice.
- **No auto-`touchless_approved` on a duplicate hit**, whatever the confidence — rule 1 is first.
- **No role or amount-based routing.** Auth is stubbed (01 §Cross-cutting) and 04 §B.4.2 leaves "by whom" open.

---

# §9 — Worked example

The 3-way physical-goods path from 02 §4, end to end. Numbers chosen to exercise the parts that are easy to get wrong.

**Documents:** invoice `INV-1001` (3 lines), PO `PO-88213` (4 lines), GRN `GRN-5567` (2 lines). Settings at defaults.

| Doc | Line | SKU | Qty | UOM | Unit price | Line total |
|---|---|---|---|---|---|---|
| Invoice | 1 | HB-M8-40Z | 200 | EA | 61.50 | 12,300.00 |
| Invoice | 2 | WS-M8-ZN | 500 | EA | 2.10 | 1,050.00 |
| Invoice | 3 | FRT-STD | 1 | EA | 240.00 | 240.00 |
| PO | 1 | WS-M8-ZN | 500 | EA | 2.10 | 1,050.00 |
| PO | 2 | — | 0 | EA | 0.00 | 0.00 |
| PO | 3 | HB-M8-40Z | 200 | EA | 61.05 | 12,210.00 |
| PO | 4 | PKG-CRT | 4 | EA | 15.00 | 60.00 |
| GRN | 1 | HB-M8-40Z | 198 | EA | — | — |
| GRN | 2 | WS-M8-ZN | 500 | EA | — | — |

Invoice `subtotal` 13,590.00 · `tax_amount` 1,155.15 · `total` 14,745.15 · `tax_rate` 8.50.

**Pairing (§2.1).** Rung 1 pairs invoice 1↔PO 3 and invoice 2↔PO 1 by SKU — note the line numbers differ, which is 03 §3d's whole point. Invoice 3 (`FRT-STD`, freight) has no PO line and stays **unpaired**. PO 2 and PO 4 are unpaired on the counterpart side. Against the GRN, rung 1 pairs invoice 1↔GRN 1 and invoice 2↔GRN 2.

**`po_match`.** 2 header comparisons (`vendor_name` pass, `po_ref` pass) + 2 per pair (`uom`, `quantity`) × 3 invoice lines expected = 8 expected, 6 made (invoice line 3 contributed none). All 6 within tolerance. `severity_coverage = 1 − 6/8 = 0.25`, `severity_breach = 0` → **confidence 75**, status `warning`, detail `"1 of 3 invoice lines had no matching PO line (line 3); 2 PO lines not billed"`.

**`grn_match`.** `vendor_name` + `doc_date` + 2 per pair × 3 lines expected = 8, made 6. Invoice line 1 billed 200, received 198 → breach (`tolerance_quantity_units = 0`). `severity_coverage = 0.25`, `severity_breach = 1/6 = 0.167` → max 0.25 → raw 75 → **breach cap applies**: `min(75, 90−1) = 75` → **confidence 75**, status `warning`.

**`price_validation`.** Group A: 2 comparisons × 3 lines expected = 6, made 4. Invoice line 1 at 61.50 vs PO 61.05 → `variance_pct = 0.737%`, within the 2% tolerance → **passes**. `line_total` 12,300 vs 12,210 → 0.737% → passes. Line 2 exact. Group B: 3 line-arithmetic + 3 header = all pass. `severity_coverage = 1 − 10/12 = 0.167`, `severity_breach = 0` → **confidence 83**, status `warning`.

**`duplicate_scan`.** No hit → `passed`, **confidence 100**.

**Money (§3).**

```
line 1:  qty_payable = min(200, 198) = 198     price_payable = min(61.50, 61.05) = 61.05   → 12,087.90
line 2:  qty_payable = min(500, 500) = 500     price_payable = min(2.10, 2.10)   = 2.10    →  1,050.00
line 3:  no PO pair                                                                        →      0.00

expected_payable = 13,137.90 + 1,155.15 (tax) = 14,293.05
total_variance   = 14,745.15 − 14,293.05      =    452.10
```

**Rollup (§4.4).** MIN(75, 75, 83, 100) = **75**, driver `po_match` (tie with `grn_match`, broken by lower `sort_order`).

**Decision (§8.2).** Rule 1 no. Rules 2, 3 no. Rule 4: `452.10 > 500.00`? **No** — under the threshold. Rule 5: `75 >= 90`? No. Rule 6 → **`human_review`**. Detail: `"Confidence 75 below auto-approve threshold 90 (driver: po_match)"`.

Worth noticing what drove that outcome: the two breaches that a reviewer will care about are the **2 units short-received** and the **$240 freight line with no PO behind it** — and the freight line, which raises no mismatch row at all, is the larger of the two in money. It reaches the reviewer through coverage and through `expected_payable`, exactly as §2.2 describes. If the freight line had been $600 instead of $240, `total_variance` would be $812.10 and rule 4 would have escalated it instead — with the confidence number completely unchanged.

---

# §10 — Decisions this document had to make

1. **`total_variance = invoice_total − expected_payable`**, not the literal "sum over mismatches" of 03 §Derived — which cannot be implemented, because mismatch variances are in dollars, units and days at the same time (§3).
2. **`expected_payable` is `Σ min-of-quantities × min-of-prices`**, with unpaired invoice lines contributing zero (§3.1). This is what makes adding a document to the match set financially meaningful and monotonic.
3. **Stage confidence is denominated in comparisons, never amounts** — `max(severity_coverage, severity_breach)`, identical formula in every stage. Without this, 03's `MIN` over stages is a category error (§4).
4. **Any breach caps a stage at `auto_approve_confidence − 1`**, so no stage with an out-of-tolerance comparison can auto-approve regardless of document length (§4.2).
5. **The rollup excludes the `decision` stage**, which then reports the rollup as its own confidence — otherwise `confidence_driver_stage` can point at itself (§4.4).
6. **An unpaired invoice line is not a `mismatches` row** — 03 §8's `NOT NULL` on `expected_document_id` makes it impossible. It surfaces through coverage, `stages.detail`, and a zeroed payable (§2.2).
7. **`doc_date` is compared against the GRN only, not the PO** — `tolerance_date_days = 5` would breach on nearly every real PO→invoice gap and make the setting noise (§1.4).
8. **Vendor matching is normalized-exact with a closed legal-suffix list**, and no similarity scoring appears anywhere in v1 — that is 01 cut #3's shape and rebuilding it here would ship it without the false-positive review flow that made it a real feature (§1.5).
9. **`match_set` comes from the attached documents, not `settings.default_match_doc_types`** — the setting seeds the wizard's checkboxes and nothing else (§6.1).
10. **`duplicate_scan` runs alongside and flags; it never blocks the run** (§7.2), and `total_variance > auto_escalate_variance` is evaluated **signed**, so under-billing never escalates (§8.4).

---

# §11 — `[NEEDS CONFIRMATION]`

Eight numbers and rules that no prior document fixed. Each has a reasoned default so the algorithm is implementable as written — none of them is a blocker, all of them are one line to overrule.

| # | Item | Default here | Reasoning / what changes if overruled |
|---|---|---|---|
| **11.1** | The legal-entity suffix list (§1.5) | `ltd, limited, llc, l.l.c, inc, incorporated, corp, corporation, co, company, plc, pvt, private, llp, gmbh, bv, sa, ag, pte` — stripped once, repeated once for `pvt ltd` | Closed list, so it's reviewable in a diff. Risk is over-stripping a vendor whose name genuinely ends in one of these (`"The Bolt Co"` → `"the bolt"`), which only matters if two such vendors collide. Add or remove entries freely; do not replace with a pattern. |
| **11.2** | Rounding tolerance for `subtotal` and `total` self-checks (§1.7) | `absolute`, `0.01 × line_count`, floor `0.01` | Rounding error is per-line, so the tolerance scales per-line. A flat value is either too tight for a 60-line invoice or too loose for a 3-line one. Deliberately has **no setting** — a slider here invites someone to widen it to $500 and disable the check. |
| **11.3** | `doc_date` compared against GRN only, not PO (§1.4) | GRN only | `tolerance_date_days = 5` against a PO→invoice gap that is normally weeks would breach on nearly everything. Alternatives: raise the default to ~45, or add a second setting — which is an `ALTER TABLE` on 03 §4 and not this document's call. |
| **11.4** | Any negative `doc_date` variance breaches, with no grace (§1.4) | No grace — invoice dated before the GRN is always a finding | A 1-day inversion from timezone or date-entry noise is plausible. If it turns out to be common, the fix is `−1 <= variance <= tolerance_date_days`, not widening the positive side. |
| **11.5** | Breach cap at `auto_approve_confidence − 1` (§4.2) | Cap applied | Makes "confidence ≥ threshold" mean "nothing needed a human" by construction. The alternative — letting one breach on a 200-line invoice score 99 and auto-approve — is the failure mode 01 says costs the most. Removing the cap makes touchless rate a function of invoice length. |
| **11.6** | `auto_escalate_variance` as a flat 500.00 against percentage tolerances (§8.5) | Kept flat, per 03 §4 | A clean $60,000 invoice with 1.5% legitimate drift escalates. Touchless rate on large invoices trends to zero. Fixes are: raise the default, or make it percentage-based — the second is a schema change (03 §4) and not this document's call. **Whoever owns the touchless-rate KPI should see this before the first demo.** |
| **11.7** | Positional pairing requires *both* SKU-less sides *and* equal line counts (§2.1 rung 4) | Both conditions | Conservative: a wrong pair produces a confidently wrong variance that flows into `expected_payable`; an unpaired line produces an honest hole. Loosening to "equal counts alone" is the obvious first relaxation if real documents pair too rarely. |
| **11.8** | Quality doc `line_items.quantity` read as the *accepted* quantity (§5.3) | Read as accepted | The extract schema (04 §A.3) has one `quantity` per line and no `accepted_quantity`. If inspection reports actually carry *rejected* quantity instead, the `min()` in §3.1 is inverted and every quality match is wrong — **ask before building this stage.** |

Also carried forward, not re-opened: the **degraded-stage cap of 60** is 04 §F.3 and stays there.

Owner: ______  ·  Answer by: ______

---

# Sign-off

Agreeing to this document means agreeing to:

- **Confidence counts comparisons; variance counts money.** They never mix, they roll up separately, and they meet only in §8's ladder.
- **One confidence formula in every stage**, so 03's `MIN` compares like with like — plus a breach cap that makes a stage with any breach incapable of auto-approving.
- **Line pairing is SKU → SKU-with-duplicates → exact normalized description → position-under-two-conditions → unpaired**, and an unpaired invoice line is a coverage hole and a zeroed payable, not a mismatch row.
- **`expected_payable` is the lower of ordered / received / accepted / billed, at the lower of agreed / billed rate**, and `total_variance` is the invoice total minus it.
- **Vendor matching is normalized-exact with a closed suffix list.** No similarity scoring anywhere in v1 — that is 01 cut #3 and it stays cut.
- **The attached documents decide which stages run**, not the settings default.
- **Duplicates flag and never block**; escalation is on signed variance; the matcher never rejects.

| Name | Role | Agreed |
|---|---|---|
| | | |
| | | |
| | | |

*Basis: `01-SCOPE.md`, `02-ARCHITECTURE.md`, `03-DATA-MODEL.md`, `04-API-CONTRACT.md`. No code was read for this document.*
