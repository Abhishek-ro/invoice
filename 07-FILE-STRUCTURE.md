# 07 — File Structure

What is actually on disk right now, what every file is for, and the three
places the layout is wrong. Tree captured 2026-09-09. Byte sizes are real,
not estimates — they're here because a few of them are the finding.

This doc describes the repo as-is. Where the as-is is wrong, §6 says what it
should be instead. Nothing here changes code; it's a map.

---

# 1. TOP LEVEL

```
invoice/
├── .env                        40 B    VITE_API_BASE_URL=http://localhost:4000
├── .gitignore                  23 B    node_modules / dist / .env
├── 01-SCOPE.md                 19 KB   v1 scope contract — five screens
├── 02-ARCHITECTURE.md          38 KB   Node↔Python boundary, record shape, known conflicts
├── 03-DATA-MODEL.md            29 KB   tables, enums, derived-vs-stored
├── 04-API-CONTRACT.md          58 KB   Part A (Node↔Python), Part B (FE↔Node)
├── 05-MATCHING-RULES.md        59 KB   per-field rules, line pairing ladder, confidence
├── 06-BUILD-ROADMAP.md          7 KB   phases 0–6
├── 07-FILE-STRUCTURE.md                this file
├── index.html                 940 B    Vite entry, theme bootstrap, Inter font
├── vite.config.js             136 B    react plugin, nothing else
├── package.json               480 B    frontend deps only
├── package-lock.json           79 KB
├── node_modules/                       165 packages (61 prod / 105 dev)
│
├── src/                                3 files. Entry point + theme only.
├── invoice-reconciliation/             THE ENTIRE FRONTEND APP. Not under src/.
└── invoice-backend/                        Node stand-in backend. No node_modules yet.
```

## 1.1 The thing that's off

`src/` holds three files:

```
src/
├── main.jsx              654 B    ReactDOM root, BrowserRouter, two routes
├── theme.css           7,646 B    design tokens, light/dark via [data-theme]
└── ThemeToggle.jsx     2,490 B    floating toggle, writes localStorage 'ir-theme'
```

That's it. The other ~250 KB of application code sits in
`invoice-reconciliation/`, a **sibling of `src/`**, one level below the repo
root — next to `node_modules/`, `package-lock.json` and the markdown docs.

So `src/main.jsx` line 5 reads:

```js
import InvoiceReconApp from '../invoice-reconciliation/routes/index.jsx';
```

It climbs *out* of `src/` to find the app it's mounting. Vite compiles this
fine — the folder is still inside the project root, so the dev server and the
build both resolve it. It is not broken. It is just not where anyone will look
for it, and it costs you three specific things:

1. **No `src/` boundary.** `src/` normally means "everything that ships."
   Here it means "the three files that boot it." Any new dev opens `src/`,
   sees a theme toggle, and has to be told where the app is.
2. **Deep relative imports everywhere.** `vite.config.js` is 136 bytes — no
   `resolve.alias`. So components reach each other with `../../analytics/KpiTileAnimated`
   and `../../shared/DataGridViewer`. Move one file and you fix five imports
   by hand.
3. **The build input is ambiguous.** `dist` is gitignored and `node_modules` is
   gitignored, but `invoice-reconciliation/` sits at the same level as both,
   so the folder that *is* the product looks like a peer of the folders that
   are disposable.

The original intent was `src/features/invoice-reconciliation/` — the sub-folder
names (`components / context / data / hooks / pages / routes / styles`) are
exactly a feature-folder layout. It got hoisted to the root and never moved
back. §6.1 has the fix.

---

# 2. FRONTEND — `invoice-reconciliation/`

```
invoice-reconciliation/
├── api/                    ← network layer. Added last (2026-09-09 05:36).
│   ├── apiClient.js          3,462 B   request(), ApiError, BASE_URL, actor headers
│   ├── index.js                634 B   barrel — pages import from '../api', never deeper
│   ├── documents.js          1,107 B   uploadDocument, confirmDocument
│   ├── reconciliations.js    2,156 B   create, get, list, addNote, postDecision
│   ├── settings.js             484 B   getTolerances, updateTolerances
│   ├── exceptions.js           424 B   listExceptions
│   └── dashboard.js            555 B   getDashboardKpis, getDashboardCharts
│
├── routes/
│   └── index.jsx             2,017 B   <InvoiceReconApp> — sidebar + 11 <Route>s
│
├── pages/                  ← one file per screen. 11 screens.
│   ├── Dashboard.jsx        18,085 B   LIVE
│   ├── NewReconciliation.jsx 40,360 B  LIVE  ← biggest file in the repo
│   ├── ReconciliationDetail.jsx 18,274 B LIVE
│   ├── ReconciliationHistory.jsx 5,761 B LIVE
│   ├── ExceptionsQueue.jsx   9,642 B   LIVE
│   ├── MatchingRulesSettings.jsx 10,988 B LIVE
│   ├── VendorIntelligence.jsx 8,926 B  MOCK — imports MOCK_VENDOR_DIRECTORY
│   ├── VendorProfile.jsx     3,691 B   MOCK — imports MOCK_VENDOR_PROFILE
│   ├── DuplicateDetection.jsx 6,273 B  MOCK — imports MOCK_DUPLICATES
│   ├── AnalyticsReports.jsx  3,661 B   MOCK — via its four tab components
│   └── ErpConfig.jsx         5,750 B   NEITHER — pure local useState, no data source
│
├── components/
│   ├── layout/
│   │   ├── IRSidebar.jsx     3,002 B   left nav, NavLink per route
│   │   └── ModuleShell.jsx   3,369 B   <Outlet> wrapper, breadcrumb/back
│   ├── shared/             ← used by the LIVE pages
│   │   ├── DataGridViewer.jsx      4,429 B  table + column toggle + xlsx export
│   │   ├── DocumentComparisonViewer.jsx 3,347 B  side-by-side doc fields
│   │   ├── ActivityTimeline.jsx    4,299 B  audit trail + add-note box
│   │   └── StatusBadge.jsx           688 B  status enum → coloured pill
│   ├── analytics/          ← used ONLY by AnalyticsReports (all mock)
│   │   ├── GlobalFilterBar.jsx          6,657 B
│   │   ├── KpiTileAnimated.jsx          1,960 B  also used by vendor tabs
│   │   ├── OperationalOverviewTab.jsx  11,017 B
│   │   ├── CfoDashboardTab.jsx          5,106 B
│   │   ├── ProcurementDashboardTab.jsx  4,755 B
│   │   └── InternalAuditDashboardTab.jsx 4,705 B
│   └── vendors/            ← used ONLY by VendorProfile (all mock)
│       ├── VendorHeader.jsx  3,698 B
│       └── tabs/
│           ├── VendorOverviewTab.jsx     6,117 B
│           ├── VendorTrendsTab.jsx       5,993 B
│           ├── VendorContractTab.jsx     5,082 B
│           ├── VendorFinancialTab.jsx    4,124 B
│           ├── VendorPerformanceTab.jsx  3,548 B
│           └── VendorRiskTab.jsx         3,558 B
│
├── context/
│   └── AnalyticsFilterContext.jsx 1,547 B  provider + useAnalyticsFilters()
├── hooks/
│   └── useCountUp.js           568 B   number ticker for KPI tiles
├── data/                   ← hardcoded mock data. See §4.
│   ├── mockData.js           8,119 B   7 exports, 1 still used
│   ├── mockAnalyticsData.js  8,457 B   4 exports, all still used
│   └── mockVendorData.js     9,541 B   2 exports, both still used
└── styles/
    └── invoice-reconciliation.css 12,601 B  every class in the module
```

## 2.1 How a request actually flows

```
page (e.g. ReconciliationDetail.jsx)
  → import { getReconciliation } from '../api'      ← barrel
    → api/reconciliations.js                        ← per-resource wrapper
      → apiClient.js  request()                     ← the only fetch() in the app
        → VITE_API_BASE_URL + '/api/v1' + path      ← .env, one-line swap point
          → invoice-backend (now) / real Node backend (later)
```

`apiClient.js` is the only file in the frontend that calls `fetch`. Nothing
else hardcodes a URL. That part is done right — swapping to the real backend
is one line in `.env` and zero component changes.

It also stamps `X-Actor-Id: u_dev_stub` / `X-Actor-Name: P. Sharma` on every
non-GET, because §0 of the contract requires an actor on mutations and there's
no auth yet. That's the line to delete when auth lands.

## 2.2 The route table (`routes/index.jsx`)

Mounted under `/invoice-reconciliation/*` by `src/main.jsx`.

| Path                | Page                    | Data     | In v1 scope? |
|---------------------|-------------------------|----------|--------------|
| `/`                 | Dashboard               | live     | yes          |
| `/new`              | NewReconciliation       | live     | yes          |
| `/exceptions`       | ExceptionsQueue         | live     | yes          |
| `/:id`              | ReconciliationDetail    | live     | yes          |
| `/settings/rules`   | MatchingRulesSettings   | live     | yes          |
| `/history`          | ReconciliationHistory   | live     | no           |
| `/vendors`          | VendorIntelligence      | mock     | no           |
| `/vendors/:vendorId`| VendorProfile           | mock     | no           |
| `/duplicates`       | DuplicateDetection      | mock     | no           |
| `/analytics`        | AnalyticsReports        | mock     | no           |
| `/settings/erp`     | ErpConfig               | none     | no           |

`01-SCOPE.md` says v1 is five screens. Eleven are mounted and reachable from
the sidebar. The six extras are not a bug — they're the previous dev's work,
and they're the reason the folder looks bigger than the scope doc reads. But
right now nothing in the tree marks which is which, so the split only exists
in `01-SCOPE.md`, not on disk.

---

# 3. BACKEND — `invoice-backend/`

A stand-in Node backend that implements exactly `04-API-CONTRACT.md` Part B.
In-memory only; every restart resets to seed. It is not the real backend and
is not meant to become it — it exists so the frontend can be built and demoed
network-real before the Python/Node work lands.

```
invoice-backend/
├── package.json     617 B   express ^4.19.2, cors ^2.8.5, multer ^2.3.0
├── README.md      4,389 B   how to run it, what it fakes
├── server.js      1,795 B   app wiring — cors, json, actor guard, 5 routers, 404, error handler
│
├── routes/                ← one file per resource. Each exports an express Router.
│   ├── documents.js       5,745 B   POST /documents (multer), PATCH /documents/:id
│   ├── reconciliations.js 7,614 B   POST, GET list, GET :id, POST :id/notes, POST :id/decision
│   ├── settings.js        2,155 B   GET + PUT /settings/tolerances
│   ├── exceptions.js      1,077 B   GET /exceptions
│   └── dashboard.js       3,902 B   GET /dashboard/kpis, GET /dashboard/charts
│
└── lib/
    ├── db.js             17,380 B  the in-memory store + all seed data
    ├── matcher.js        10,205 B  runMatch() — the MOCK matching engine
    ├── extractor.js       5,228 B  fakeExtract() — stands in for the Python OCR hop
    ├── errors.js          2,744 B  ApiError, Errors catalogue, requireActor, asyncRoute
    └── derive.js          1,637 B  deriveReason, toListRow, toExceptionRow, inDateRange
```

## 3.1 Endpoints — all 12

Everything is under `/api/v1`. Non-GET requires `X-Actor-Id` + `X-Actor-Name`
or it 400s (`server.js`, the middleware above the router).

| Method | Path                            | File                  | Frontend caller           |
|--------|---------------------------------|-----------------------|---------------------------|
| POST   | `/documents`                    | routes/documents.js   | NewReconciliation         |
| PATCH  | `/documents/:id`                | routes/documents.js   | NewReconciliation         |
| POST   | `/reconciliations`              | routes/reconciliations.js | NewReconciliation     |
| GET    | `/reconciliations`              | routes/reconciliations.js | Dashboard, History    |
| GET    | `/reconciliations/:id`          | routes/reconciliations.js | ReconciliationDetail  |
| POST   | `/reconciliations/:id/notes`    | routes/reconciliations.js | ReconciliationDetail  |
| POST   | `/reconciliations/:id/decision` | routes/reconciliations.js | ReconciliationDetail  |
| GET    | `/settings/tolerances`          | routes/settings.js    | MatchingRulesSettings **only** — see §5.3 |
| PUT    | `/settings/tolerances`          | routes/settings.js    | MatchingRulesSettings     |
| GET    | `/exceptions`                   | routes/exceptions.js  | ExceptionsQueue           |
| GET    | `/dashboard/kpis`               | routes/dashboard.js   | Dashboard                 |
| GET    | `/dashboard/charts`             | routes/dashboard.js   | Dashboard                 |

Twelve endpoints, six live pages. Every endpoint has a caller and every live
page has its endpoints. No orphans on either side.

## 3.2 `lib/db.js` — what the 17 KB actually is

Four exports (`documents`, `reconciliations`, `genId`, `nowISO`) plus
`settings`/`setSettings`. Two `Map`s. The rest of the file — roughly 14 KB of
it — is five hand-built seed reconciliations:

1. The `04-API-CONTRACT.md` §B.3.1 worked example, reproduced field-for-field,
   so the contract's sample response *is* what the server returns.
2. Clean touchless approval — no PO/GRN issues.
3. Escalated on a large variance.
4. Already rejected — terminal, carries a decision audit row.
5. `duplicate_flagged`.

That's deliberate and it's the good kind of fixture: the five records cover the
five terminal states the UI has to render, so every screen has something real
to show on a cold start.

## 3.3 What `matcher.js` is and is not

`runMatch({ docs, settings, existingReconciliations })` — 10 KB. It produces
contract-shaped output (stages, mismatches, confidence, `expected_payable`)
so the frontend can render a real reconciliation. It does **not** implement
`05-MATCHING-RULES.md`, which is 59 KB / 757 lines of per-field rules, the
four-rung line-pairing ladder, and the confidence rollup formula.

Ratio worth keeping in view: the rules doc is ~6× the size of the code that
currently stands in for it. That gap is Phase 3 of the roadmap, not a defect —
but don't read `matcher.js` as an implementation of `05`.

---

# 4. THE DATA-SOURCE SPLIT

The single most confusing thing in the tree for anyone new. Two complete,
parallel data systems are live at the same time, and which one a page uses is
not visible from its filename or its folder.

```
                      ┌─ api/ ──→ apiClient ──→ invoice-backend  (6 pages)
   pages/ ────────────┤
                      └─ data/mock*.js  (hardcoded, in-bundle)  (4 pages)
                         + ErpConfig, which uses neither         (1 page)
```

**Live — reads `../api`:**
Dashboard, NewReconciliation, ReconciliationDetail, ReconciliationHistory,
ExceptionsQueue, MatchingRulesSettings

**Mock — reads `../data/*`:**
VendorIntelligence (`MOCK_VENDOR_DIRECTORY`), VendorProfile (`MOCK_VENDOR_PROFILE`),
DuplicateDetection (`MOCK_DUPLICATES`), AnalyticsReports (via its four tab
components, each importing from `mockAnalyticsData`)

**Neither:** ErpConfig — local `useState` only, nothing saved anywhere.

This maps almost exactly onto the v1 scope line: the six live pages are the
five in-scope screens plus History. The mock ones are all out of scope. So the
split is *coherent* — it just isn't labelled, and `data/` sitting as a normal
sibling of `api/` implies both are current infrastructure when only one is.

---

# 5. DEAD AND DRIFTING

## 5.1 `data/mockData.js` — 6 of 7 exports are dead

| Export                      | Still imported? |
|-----------------------------|-----------------|
| `MOCK_DUPLICATES`           | yes — DuplicateDetection |
| `MOCK_DASHBOARD`            | no — Dashboard went live |
| `MOCK_RECONCILIATION_DETAIL`| no — Detail went live |
| `MOCK_EXCEPTIONS`           | no — ExceptionsQueue went live |
| `MOCK_SETTINGS`             | no — MatchingRulesSettings went live |
| `MOCK_VENDORS`              | no — superseded by mockVendorData.js |
| `MOCK_ANALYTICS`            | no — superseded by mockAnalyticsData.js |

~8 KB of the file, all still bundled. These are the leftovers of the six pages
that got wired to the API on 09-09; nobody went back and deleted the fixtures
they replaced. `mockAnalyticsData.js` and `mockVendorData.js` are fully live —
don't touch those.

## 5.2 `invoice-backend/` has never been installed

There is no `invoice-backend/node_modules/`. `express`, `cors` and `multer` are
declared in its `package.json` and were never installed, which means the
backend has not been run since it was written. The frontend's six "live" pages
have therefore been wired against a server that hasn't started.

```
cd invoice-backend && npm install && npm run dev     # → http://localhost:4000
```

Do this before trusting any of §2.2's "live" column.

## 5.3 Contract §B.1.4 is unimplemented on the frontend

`04-API-CONTRACT.md` §B.1.4 puts `GET /settings/tolerances` on the Upload
screen — the idea being that Upload shows the tolerances a run will use.
`invoice-backend/routes/settings.js` serves it. `api/settings.js` wraps it.
`NewReconciliation.jsx` never imports it; it sends `tax_rate` and `actual_sla`
from local state instead (lines 201–202, with a `TODO(04 §B.1.3)` at line 498).

So the endpoint exists on both sides of the wire and has one caller instead of
two. This is the same complaint `02-ARCHITECTURE.md` §7 makes ("tolerance
inputs are split across two screens and neither persists") — the settings
screen half is now fixed, the upload half is not.

## 5.4 Repo hygiene

- **Not a git repo.** No `.git/`. There is a `.gitignore` sitting there doing
  nothing. Three people are supposed to work on this and there is no history,
  no branches, and no way to undo a bad day.
- **`npm audit`: 5 vulnerabilities, 2 high.** `xlsx@0.18.5` (prototype
  pollution + ReDoS) has `fixAvailable: false` — SheetJS stopped publishing
  patches to npm, so the registry copy stays vulnerable permanently. It's
  imported by `DataGridViewer.jsx` for the export button. `vite`/`esbuild`
  carry a high-severity dev-server issue; fix is a major bump.

---

# 6. WHAT THE LAYOUT SHOULD BE

Ranked by payoff per minute spent. There are 9–10 working days on this; only
the first two items are worth doing before the deadline, and both are cheap.
The rest is listed so it's written down, not so it gets done this sprint.

## 6.1 Do now — `git init` (2 minutes)

Nothing else on this list matters if a bad merge or a bad afternoon can delete
the work. `.gitignore` is already correct (`node_modules`, `dist`, `.env`).

```
git init && git add -A && git commit -m "invoice reconciliation: frontend + mock server"
```

## 6.2 Do now — move the app under `src/` (about 15 minutes)

Roadmap Phase 1 already says "frontend refactor, network-free, do this while
it's cheap." It is cheapest today and gets more expensive every day the other
two engineers write imports against the current paths.

Target:

```
invoice/
├── index.html
├── vite.config.js          ← add resolve.alias '@' → /src
├── package.json
├── docs/                   ← 01..07 move here, off the root
├── invoice-backend/            ← stays put, it's a separate service
└── src/
    ├── main.jsx
    ├── ThemeToggle.jsx
    ├── styles/theme.css
    └── features/
        └── invoice-reconciliation/
            ├── api/
            ├── routes/
            ├── pages/
            ├── components/{layout,shared,analytics,vendors}
            ├── context/
            ├── hooks/
            ├── data/            ← rename to __fixtures__/ so it reads as temporary
            └── styles/
```

The move itself:

```
mkdir -p src/features
git mv invoice-reconciliation src/features/invoice-reconciliation
```

Then one import changes in `src/main.jsx`:

```js
import InvoiceReconApp from './features/invoice-reconciliation/routes/index.jsx';
```

Every other import inside the feature is relative *within* the folder, so they
all survive the move untouched. That's the whole refactor — one line — because
the folder is already internally consistent.

Add the alias while you're in `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

New imports can then be `@/features/invoice-reconciliation/components/shared/DataGridViewer`
instead of `../../shared/DataGridViewer`. Don't rewrite the existing ones —
let them convert as files get touched.

## 6.3 Do when it's in the way — delete the dead fixtures

The six unused exports in `mockData.js` (§5.1). Safe to delete, but they cost
nothing except confusion, so do it the next time someone opens that file, not
as its own task.

## 6.4 Do not do this sprint

- Splitting `NewReconciliation.jsx` (40 KB). It's the biggest file in the repo
  by a factor of two and it will need to come apart eventually — the upload
  flow, the extraction-review table and the submit step are three components
  wearing a trenchcoat. But it's also the file most likely to be under active
  edit for Phase 2, and refactoring a file while rewriting it is how you spend
  a day and ship nothing.
- Chasing `npm audit` to zero. `xlsx` has no fix on npm; the real options are
  drop the export button, switch to `exceljs`, or accept it and note it. All
  three are post-demo decisions.
- Separating in-scope from out-of-scope screens into different folders. The
  §2.2 table does that job on paper for now.

---

# 7. ONE-SCREEN SUMMARY

| | |
|---|---|
| Frontend app lives in | `invoice-reconciliation/` at repo root, **not** `src/` |
| `src/` contains | 3 files — entry, theme, toggle |
| Screens mounted | 11 |
| Screens in v1 scope | 5 (`01-SCOPE.md`) |
| Pages on the real API | 6 |
| Pages on hardcoded mock | 4 |
| Pages on nothing | 1 (ErpConfig) |
| Backend endpoints | 12, all with a caller |
| Backend installed? | No — `invoice-backend/node_modules` missing |
| Under version control? | No |
| npm audit | 5 vulns, 2 high, 1 unfixable (`xlsx`) |
| Biggest file | `NewReconciliation.jsx`, 40,360 B |
| Largest doc vs its code | `05-MATCHING-RULES.md` 59 KB vs `matcher.js` 10 KB |
