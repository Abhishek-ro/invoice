# Mock backend — recon-app-v2

This is a real, standalone HTTP server implementing exactly the endpoints in
`04-API-CONTRACT.md` Part B. It's not a mock *data file* — it's Express +
an in-memory datastore, so the frontend talks to it over `fetch()` and a
real network tab, exactly like it will talk to the eventual Node backend.

**Why Express + in-memory instead of MSW or a JSON file:** the goal was
that the frontend genuinely cannot tell this apart from a real backend
later — real HTTP, real status codes, real statefulness (a PUT to
`/settings/tolerances` actually changes what a later GET returns, a
decision actually transitions status and cannot be re-applied). MSW
intercepts at the service-worker/fetch layer instead of being a real
server, which works for tests but not for "open two tabs and see the same
state" or "watch it in the Network tab like a junior dev would." Express
was already the path of least setup for a days-not-weeks timeline — no
new language, no schema/ORM, just routes and a couple of `Map`s.

## Running it

```
cd mock-server
npm install
npm start        # or: npm run dev   (restarts on file changes)
```

Listens on `http://localhost:4000`. All routes are under
`http://localhost:4000/api/v1/...`.

In another terminal, run the frontend as usual (`npm run dev` from the
project root). The frontend already points at this server by default — see
`.env` at the project root (`VITE_API_BASE_URL=http://localhost:4000`).
**That one line is the entire migration path to a real backend**: point it
at the real Node server's URL when it exists, and nothing in `src/` or
`invoice-reconciliation/` needs to change, because every page goes through
`invoice-reconciliation/api/*.js` → `apiClient.js`'s `request()`, never a
hardcoded `fetch()`.

## What's in here

- `server.js` — Express app, CORS, the `X-Actor-Id`/`X-Actor-Name` header
  gate on mutating requests (§0), and the single error handler that turns
  every thrown `ApiError` into the `{ error: { code, message, details } }`
  envelope §0 specifies.
- `lib/db.js` — in-memory `Map`s for documents and reconciliations, plus
  5 hand-authored seed reconciliations covering the interesting statuses
  (touchless, human_review, escalated, rejected, duplicate_flagged) so the
  app isn't empty on first load. **Restarting this server resets everything
  to these seeds** — there's no real persistence, by design.
- `lib/extractor.js` — `fakeExtract()`, a deterministic fake OCR step.
  **Everything this returns is standing in for Python's real `/extract`
  output** (Part A of 04) — see the comment at the top of that file and in
  `routes/documents.js`. When the real Python service exists, only this
  file's internals change; the shape it returns is already the contract
  shape.
- `lib/matcher.js` — a simplified, clearly-commented approximation of
  `05-MATCHING-RULES.md`'s real matching engine. It produces
  contract-shaped, internally-consistent, plausibly varied results (not
  just one static fixture) — different confidences, some passing stages,
  occasional escalation/duplicate — so there's something real to build the
  UI against. **This file, not the routes, is what a real matching engine
  replaces.**
- `lib/derive.js` — the two derivations 04 explicitly requires stay
  IDENTICAL across endpoints (`deriveReason`, used by both
  `GET /exceptions` and `GET /dashboard/charts`'s `exception_breakdown` —
  the contract calls out that these disagreeing is a bug class of its own).
- `routes/*.js` — one file per resource, matching 04 §B.1–§B.5 section
  numbers in comments at the top of each route.

## Known gaps (see the frontend's own TODO comments for the full list)

- No auth — `X-Actor-Id`/`X-Actor-Name` are hardcoded client-side stand-ins
  per 04 §0's own note that this is expected pre-auth.
- No bulk decisions, no saved views, no bulk approve/escalate — none of
  these exist anywhere in 04, so neither the mock server nor the frontend
  invented them.
- Vendor Intelligence, Vendor Profile, Analytics & Reports, Duplicate
  Detection, and ERP Config screens are **not wired to this server at
  all** — 04 has no corresponding endpoints for them, so they were left on
  their original static mock data rather than having shapes invented for
  them. If/when 04 grows sections for these, they're the next thing to
  move over.
