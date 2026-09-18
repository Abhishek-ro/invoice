# Invoice Reconciliation App — Project Context

Read this first in any new session before touching this repo.

## What this is

AI-powered 4-way/5-way invoice reconciliation platform, built for DataUrix
Labs. Assigned to Abhi by the CTO (Dr. Ambuj Kathuria). It started as a
feature buried in the main company app and is now being pulled out and
built as its own standalone product — a full AP (accounts payable)
automation tool: multi-channel invoice ingestion, AI-based matching against
PO/GRN/contract docs, fraud/exception detection, and dashboards for
CFO/Procurement/Audit roles.

Team: Abhi (frontend + Node backend), Aditya (Python backend — extraction/
AI matching service), Rahul Sharma + Abhishek Swain (backend, contract-
matching), Tushar Patil (prompt engineering), CTO Dr. Ambuj Kathuria
(product owner, reviews and redirects scope frequently).

## Repo layout — this is TWO apps in one folder

- Root = the React frontend (Vite). `npm run dev` from root.
- `invoice-backend/` = a SEPARATE, self-contained Express server. Its own
  `package.json`, own `npm install`, own `npm start` (port 4000).
- They are not coupled by imports — only by HTTP. Root `.env` has
  `VITE_API_BASE_URL=http://localhost:4000` pointing the frontend at it.

## The backend here is a stand-in, not a mock file

`invoice-backend` is real Express + in-memory `Map`s (state resets on
restart), deliberately built so the frontend can't tell it apart from a
real backend — real HTTP, real status codes, real statefulness (e.g. a
decision actually flips status and can't be re-applied).

- `lib/extractor.js` → `fakeExtract()` stands in for Python's real
  `/extract` endpoint (OCR/AI document extraction).
- `lib/matcher.js` → stands in for the real matching engine.
- `lib/db.js` → in-memory seed data, 5 hand-authored reconciliations.
- `routes/*.js` → one file per resource, mirrors `04-API-CONTRACT.md`
  section numbers in comments.

**Migration path to the real backend is meant to be one line**: swap
`VITE_API_BASE_URL` — nothing in `src/` should need to change, because
every screen goes through `features/invoice-reconciliation/api/*.js` →
`apiClient.js`'s `request()`, never a raw `fetch()`.

## Backend ownership split (the actual architecture)

- **Python** — owns a single stateless `/extract` endpoint. OCR + AI
  extraction only. No matching logic.
- **Node** (`invoice-backend`, eventually the real Node service) — owns
  everything else: matching, tolerances, reconciliation state, exceptions,
  audit log.

## ⚠️ Missing docs — find these before doing backend work

`06-BUILD-ROADMAP.md` at the repo root is a checklist that cites five spec
docs by section number for every single decision:
`01-SCOPE.md`, `02-ARCHITECTURE.md`, `03-DATA-MODEL.md`,
`04-API-CONTRACT.md`, `05-MATCHING-RULES.md`.

**None of these 5 docs are actually in this repo or this folder.** Only the
roadmap (which cites them) survived. Ask Abhi where they live (another
chat export, Claude Docs, Notion, etc.) before making backend/data-model
decisions — the roadmap alone is checkboxes without the reasoning behind
them, and the checklist has already flagged several as unresolved
(DB engine not actually confirmed, line-items-in-extract-response not
confirmed, tax rate silently defaults to 0, router mount point unset).

## Frontend structure

```
src/
  main.jsx, theme.css (global design tokens — don't hardcode colors), ThemeToggle.jsx
  features/
    landing/                    marketing/public site
    invoice-reconciliation/     the actual product
      pages/                    NewReconciliation.jsx is the big one (wizard)
      components/
        new-reconciliation/     DocumentUploadStep, MatchingStrategyStep
        layout/                 GlobalTopNav, IRSidebar, ModuleShell
        analytics/, vendors/, shared/
      api/                      apiClient.js + one file per resource — ALL network calls go through here
      context/, hooks/, data/   mock data still used by not-yet-wired screens
      routes/index.jsx
```

The "New Reconciliation" wizard is the core flow: Invoice → Matching
Strategy → PO → Goods Receipt → Review. Step 1 supports 5 ingestion
channels via a segmented control (Upload File is the only real one; Email/
EDI/API/ERP are UI-only setup-dialog placeholders using real vendor-spec
fields, not invented ones).

## Product decisions already locked in (don't relitigate these)

- Must be global/multi-language — validation & match results shown in both
  original language and English.
- Branding: "Cortex AI reconciliation" everywhere, never generic
  "AI reconciliation."
- Contracts are **never** manually uploaded — always auto-fetched via a
  vendor knowledge graph. The old manual "Contract" upload section is
  renamed "SLA and Acceptance Criteria."
- No generic naming — packages/modules/functions/files should be
  self-explanatory (CTO standard, enforced repo-wide).
- Contract matching: don't diff every clause — first pull the 10-20
  relevant financial clauses via a GPT call, then semantically compare
  only those against invoice line items.
- Nav direction is moving AWAY from the sidebar toward dashboard feature
  cards + a consolidated Settings dropdown, with Vendors broken out as its
  own section and a public landing page in front of the logged-in app.
  Don't assume sidebar-first nav in new screens without checking current
  status.

## Current state, honestly

This is pre-production. Nothing here is backend-verified yet — the
frontend is a mostly-complete UI running against the fake `invoice-backend`
so design and flow can be iterated on before the real Python/Node services
exist. Expect scope and direction to keep shifting after CTO reviews (it
has repeatedly — "that was not the app" was said once already). Treat this
file as the fast-orientation layer; `06-BUILD-ROADMAP.md` is the actual
execution checklist once the missing 01-05 docs are back in hand.
