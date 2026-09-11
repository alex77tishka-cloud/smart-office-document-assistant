# PROMPTS.md — Claude Code Prompt Log

A running record of every Claude Code prompt used to build **Smart Office Document Assistant – Application Layer**, what it produced, and what was decided.

## How to use this file

- One `## Prompt N` section per prompt, newest appended at the bottom.
- Record the prompt **verbatim** — including mistakes and corrections. A cleaned-up prompt is a useless record.
- Fill in *Result*, *Files touched* and *Decisions* immediately after the run, while it is still accurate.
- *Follow-ups* becomes the seed of the next prompt.
- Never paste secrets, API keys or real Sheet contents into this file. Environment variable **names** only.

### Template

```
## Prompt N — <short title>

- **Date:** YYYY-MM-DD
- **Phase:** <0 Spec | 1 Mock data | 2 GET /documents | 3 process-document | 4 review>
- **Goal:** one sentence.

### Prompt (verbatim)

> ...

### Result
What Claude actually did.

### Files touched
- `path` — created / modified / deleted

### Decisions
Choices locked in by this run.

### Deviations
Where the result differed from the prompt, and why.

### Follow-ups
Open items for the next prompt.
```

---

## Prompt 1 — Project specification, contract and prompt log

- **Date:** 2026-09-10
- **Phase:** 0 — Specification (no application code)
- **Goal:** Establish SPEC.md, CONTRACT.md and PROMPTS.md before any React or Express code is written.

### Prompt (verbatim)

> We are building a project called "Smart Office Document Assistant – Application Layer".
>
> Do not build or modify the React application yet.
>
> First, create these three files in the project root:
>
> 1. SPEC.md
> 2. CONTRACT.md
> 3. PROMPTS.md
>
> Architecture:
> - Frontend: React + Vite
> - Backend/proxy: small Express server
> - n8n remains responsible for all document processing, AI, Google Sheets, Google Drive, Gmail, urgency logic and review logic.
> - The application must never reimplement the n8n business logic.
> - The n8n API key must never be exposed in browser code. It will later be stored as a server-side environment variable.
>
> Current production n8n endpoints:
>
> A. POST /webhook/process-document-v2
> Purpose: upload and process a document.
> Request:
> {
>   "file_name": string,
>   "mime_type": string,
>   "file_base64": string
> }
>
> Response includes:
> {
>   "status": "processed",
>   "document_id": string,
>   "file_name": string,
>   "file_link": string,
>   "received_at": string,
>   "fields": {
>     "customer": string,
>     "end_customer": string,
>     "project_or_program": string,
>     "request_type": string,
>     "te_part_numbers": string,
>     "competitor_part_numbers": string,
>     "product_family": string,
>     "quantity": string,
>     "target_price": string,
>     "required_delivery": string,
>     "response_deadline": string,
>     "competitor": string,
>     "summary": string,
>     "requested_action": string,
>     "responsible_team": string,
>     "urgency": string,
>     "strategic_opportunity": string
>   },
>   "notification_sent": boolean
> }
>
> B. GET /webhook/documents
> Purpose: return all processed documents from Google Sheets.
> Returns a JSON array ordered newest first.
> The current response uses the actual Google Sheet column names, including:
> row_number,
> Received At,
> Customer,
> End Customer,
> Project / Program,
> Request Type,
> TE Part Number(s),
> Competitor Part Number(s),
> Product Family,
> Quantity,
> Target Price,
> Required Delivery,
> Response Deadline,
> Competitor,
> Summary,
> Requested Action,
> Responsible Team,
> Urgency,
> Strategic Opportunity,
> File Name,
> File Link,
> Status,
> Document ID,
> Reviewed By,
> Review Note.
>
> C. POST /webhook/review
> Purpose: record a human review.
> Request:
> {
>   "document_id": string,
>   "status": "Reviewed" or "Needs Review",
>   "reviewed_by": string,
>   "review_note": string
> }
>
> Successful response:
> {
>   "success": true,
>   "document_id": string,
>   "status": string,
>   "reviewed_by": string,
>   "review_note": string
> }
>
> Important:
> - Google Sheets is the single source of truth for the dashboard.
> - Do not create another database.
> - Do not put any real API key or secret value in these files.
> - Refer only to environment variable names.
> - The application must support document upload, processing state, result view, dashboard, search/filter, document detail/review, empty states and readable error states.
> - We will build against mock data first, then connect GET /documents, then process-document, then review.
> - Note in SPEC.md that process-document-v2 is temporary because /process-document is currently occupied by another n8n workflow.
>
> PROMPTS.md:
> Record this prompt as Prompt 1 and leave a structure for documenting later Claude Code prompts and results.
>
> After creating the three files, stop and summarize what you created. Do not start implementing screens or API calls yet.

### Result

Created three root documents. No application code written or modified; the existing Vite + React 19 scaffold (`src/`, `index.html`, `vite.config.js`) was left untouched.

- **SPEC.md** — purpose, hard non-goals (no reimplemented n8n logic, no second database, no key in the browser, no secrets in the repo), architecture diagram, environment variable **names** only, the `-v2` temporary-path note, application-facing data model, required functionality (upload, processing state, result view, dashboard, search/filter, detail/review, empty states, error states), the four build phases, an acceptance checklist and open questions.
- **CONTRACT.md** — the three upstream n8n webhooks exactly as given; the `/api/*` proxy routes the browser may call; the full Sheet-column → internal-field mapping table; the upload-response mapping; the frontend API layer rule; and a normalised error contract with codes and HTTP statuses.
- **PROMPTS.md** — this log, with a reusable template and Prompt 1 recorded verbatim.

### Files touched

- `SPEC.md` — created
- `CONTRACT.md` — created
- `PROMPTS.md` — created

### Decisions

1. **Four-phase build order** — mock data → `GET /documents` → `process-document` → `review`. Each phase ships complete before the next starts.
2. **Proxy route naming** — the frontend calls `/api/process-document`; the temporary `-v2` upstream path is declared once, server-side, so freeing `/webhook/process-document` is a one-line change.
3. **Single normaliser** — Sheet column names are mapped to camelCase internal fields in exactly one module; components never read raw Sheet keys, so a column rename touches one table.
4. **`documentId` is identity** — `row_number` is a Sheet artefact and must not be used as a React key or for routing.
5. **`status` collision made explicit** — processing status (`"processed"`) is kept separate from review status (`Reviewed` / `Needs Review`) in the internal model.
6. **Values stay strings** — `quantity` and `targetPrice` are formatted for display only, never coerced for logic.
7. **Structured error contract** — the server returns `{ error: { code, message, detail } }` with sanitised detail; the UI switches on `code`, never on message text.
8. **Mocks are permanent** — mock data stays in the repo behind `VITE_USE_MOCKS` so the UI remains developable without n8n access.

### Deviations

None in scope. Two additions beyond the literal prompt, both documentation-only:

- Added a `/api/health` route to the contract so misconfiguration is detectable without exposing env values.
- Added an error-code table, since "readable error states" needs a defined server-side shape to render against.

### Follow-ups

Open questions recorded in SPEC.md §8 — the n8n auth header name, upload size ceiling, supported MIME types, empty-Sheet response shape, n8n's own error shape, `Document ID` uniqueness on older rows, and when `/webhook/process-document` is freed.

Next prompt: **Phase 1** — mock data plus the full UI (dashboard, search/filter, detail/review, upload with simulated processing, all empty and error states), no network calls.

---

## Prompt 2 — Confirmed facts folded into SPEC and CONTRACT

- **Date:** 2026-09-10
- **Phase:** 0 — Specification (still no application code)
- **Goal:** Record four confirmed facts — auth header name, supported upload types, review 404, legacy rows without a Document ID — in SPEC.md and CONTRACT.md before Phase 1 begins.

### Prompt (verbatim)

> Before Phase 1, update SPEC.md and CONTRACT.md with these confirmed facts:
>
> 1. The n8n authentication header name is exactly: x-api-key
> Do not include the secret value anywhere.
>
> 2. The required supported upload types are PDF, DOCX and TXT.
> Note that the current n8n Workflow A has only been verified with PDF so far, and DOCX/TXT support must be completed before final submission.
>
> 3. POST /review must define a 404 response when no matching Document ID exists.
>
> 4. Document ID is the stable identifier for review. New Workflow A records contain it, but some legacy spreadsheet rows have an empty Document ID. The UI must not attempt review for rows without one.
>
> Record this as Prompt 2 in PROMPTS.md.
> Do not implement application code yet.

### Result

Both documents updated to v1.1. No application code written or modified; the Vite + React 19 scaffold remains untouched.

**SPEC.md**
- §2.3 — `N8N_API_KEY_HEADER` is documented as `x-api-key`, with the header *name* explicitly distinguished from the secret *value* (which stays in `N8N_API_KEY` and nowhere in the repo).
- §5.1 — upload section now names PDF, DOCX and TXT as the supported types, rejecting others client-side.
- §5.1.1 (new) — per-type table with extension, MIME type and upstream verification status; the PDF-only verification gap flagged as a **must-close-before-final-submission** item; the accepted-type list mandated as a single shared constant; a note that the app must not compensate for missing upstream support with its own parsing (NG-1).
- §5.4.1 (new) — legacy rows with an empty `Document ID` are not reviewable: no request is sent, the review form is not rendered, the dashboard may mark them, and the check is one derived predicate. Legacy rows stay visible, searchable and filterable.
- §7 — five acceptance items added covering the header, the type list, the DOCX/TXT gap, the non-reviewable guard and the 404 rendering.
- §8 — three questions resolved and moved into a new §8.1 table; §8.2 carries the DOCX/TXT upstream work item.

**CONTRACT.md**
- §1 — auth documented as `x-api-key`, with the rule that the header is never forwarded to the browser, logged, or included in an error `detail`.
- §1.A — accepted `mime_type` table, plus the note that DOCX/TXT are contractually supported but unproven upstream and surface as `UPSTREAM_ERROR` until verified.
- §1.C — 404 response defined with body shape and handling rules: not recorded, no optimistic update, no auto-retry, detected by **status code** rather than by parsing the error string.
- §2.4 — outcome table for `POST /api/review` (200 / 400 / 404 / 502-503-504), with the note that 400 and 404 are a safety net rather than the intended flow.
- §3 — `Document ID` row annotated; §3.1 adds the derived `isReviewable` flag (non-empty trimmed `documentId`), read by every component that offers review.
- §5 — `DOCUMENT_NOT_FOUND` (404) added to the error-code table.
- §6 — two fixed points added: the header is `x-api-key`, server-side only; `Document ID` is the only identifier accepted for review.

### Files touched

- `SPEC.md` — modified (v1 → v1.1)
- `CONTRACT.md` — modified (v1 → v1.1)
- `PROMPTS.md` — modified (Prompt 2 recorded)

### Decisions

1. **`x-api-key` is a default, not a hardcode** — the name lives in `N8N_API_KEY_HEADER` with `x-api-key` as its default value, so a future header change is configuration rather than a code edit.
2. **DOCX/TXT ship as accepted now** — the app does not gate them behind the upstream gap. The gap is upstream, and the app compensating with its own parsing would violate NG-1. A non-blocking UI note keeps a failure legible.
3. **404 detected by status code** — not by string-matching the upstream error body, so a change in n8n's error wording does not silently break the handling.
4. **404 is terminal** — no auto-retry, no optimistic update; the suggested user action is to refresh the dashboard, since the usual cause is a stale or deleted row.
5. **`isReviewable` is derived in the normaliser** — one predicate, not an inline check repeated per component; explicitly a guard on a missing identifier, not business logic.
6. **No identifier fallback** — a row without a `Document ID` is never reviewed via `row_number` or a synthesised id. Non-reviewable is a legitimate, designed UI state.
7. **Legacy rows stay first-class** — they remain visible, searchable and filterable; only the review action is withheld.

### Deviations

None. Two clarifications added beyond the literal prompt, both documentation-only:

- Specified *how* the 404 is detected (status code, not body parsing), since the upstream error body shape is still an open question.
- Named the derived `isReviewable` flag in CONTRACT.md so Phase 1 components have a single agreed predicate rather than each inventing an emptiness check.

### Follow-ups

Remaining open questions (SPEC.md §8): upload size ceiling, empty-Sheet response shape, n8n's own error body shape, whether `Document ID` is **unique** among rows that have one, and the timeline for freeing `/webhook/process-document`.

Carried work item (§8.2): **complete DOCX and TXT support in n8n Workflow A before final submission** — upstream, but the app's accepted-type list depends on it.

Phase 1 mock data must now include at least one legacy row with an empty `Document ID`, so the non-reviewable state is exercised offline, plus rows covering each urgency value and a partially-empty row.

Next prompt: **Phase 1** — mock data plus the full UI (dashboard, search/filter, detail/review, upload with simulated processing, all empty and error states), no network calls.

---

## Prompt 3 — Phase 1: full UI on mock data

- **Date:** 2026-09-10
- **Phase:** 1 — Mock data
- **Goal:** Build the complete React UI against local mock data: dashboard, search/filter, document detail, review, upload with simulated processing, and every loading/empty/error state. No n8n, no Express, no network.

### Prompt (verbatim)

> Now build Phase 1 using mock data only.
>
> Requirements:
>
> - Do not connect to n8n yet.
> - Do not create the Express proxy yet.
> - Do not make any real network calls.
> - Follow SPEC.md and CONTRACT.md exactly.
> - Do not invent new business fields or business logic.
>
> Build the React UI with these screens/features:
>
> 1. Dashboard
>    - Show mock documents in a clean table
>    - Newest first
>    - Search
>    - Filters for urgency, status, responsible team and request type
>    - Result count
>    - Clear filters
>    - Row click opens document detail
>
> 2. Document Detail
>    - Show all available document fields
>    - Show Drive link
>    - Show review section
>    - If Document ID is empty, disable review and explain why
>
> 3. Review Form
>    - Status: Reviewed or Needs Review
>    - Reviewed By
>    - Review Note
>    - In mock mode, simulate a successful update locally only
>
> 4. Upload Screen
>    - File selector / drag and drop
>    - Show file name, type and size
>    - Accept PDF, DOCX and TXT
>    - Simulate processing delay
>    - Show processing state
>    - Show a mock result after processing
>
> 5. States
>    - Loading
>    - Empty dashboard
>    - No search/filter results
>    - Readable error state
>
> Create:
> - src/api/mock.js
> - src/api/client.js
> - appropriate screen/components files
>
> Use VITE_USE_MOCKS to control mock mode.
>
> Include at least:
> - one High urgency document
> - one Medium urgency document
> - one Needs Review document
> - one Reviewed document
> - one legacy document with an empty Document ID
>
> Keep the UI usable on a normal laptop without horizontal scrolling.
>
> Record this as Prompt 3 in PROMPTS.md.
>
> After implementation:
> - run the project checks
> - summarize the files created or changed
> - stop
> - do not begin Phase 2

### Result

The full UI runs on mock data with no network calls. No Express server was created and no n8n endpoint is contacted.

**API layer**
- `src/api/mock.js` — 8 mock rows in the **raw Google Sheet shape** (real column names), newest first, so the normaliser is exercised exactly as it will be against live data. Includes 3 High / 3 Medium / 2 Low, 4 Needs Review, 3 Reviewed, one partially-empty row, and one legacy row with an empty `Document ID`. Also holds mock transports for all three calls and a mock-only scenario switch (normal / empty / error / slow).
- `src/api/client.js` — the only module that performs calls: `getDocuments()`, `processDocument()`, `submitReview()`. Reads `VITE_USE_MOCKS`; the live branches throw a readable "not available yet" error rather than being stubbed silently.
- `src/api/normalize.js` — the single normaliser: `COLUMN_MAP` (CONTRACT.md 3), `normalizeProcessResult` (3.2) and the derived `isReviewable`.
- `src/api/errors.js` — `ApiError` with the contract's `code` values and a `retryable` predicate; the UI switches on `code`, never on message text.

**Screens** — `Dashboard`, `DocumentDetail`, `Upload`, plus `ReviewForm`, `Badges`, `FieldList` and `States` components, and `lib/` helpers for formatting, filtering and base64 file reading.

**Checks** — `npm run lint` clean, `npm run build` clean, plus a headless-browser pass over every screen: 8 rows load newest-first; search narrows 8 to 2; the urgency filter reports "3 of 8 documents · 1 filter active"; no-match, empty, loading and error states all render (error shows `UPSTREAM_UNREACHABLE` with a retry); a review saves and the status updates; the legacy row renders the explanation with **no review form present**; an upload runs through the processing state to a result view; an `.xlsx` is rejected with the accepted-type list; document scroll width overflow measured at **0px** at 1440x900; zero console errors.

### Files touched

- `src/api/mock.js` — created
- `src/api/client.js` — created
- `src/api/normalize.js` — created
- `src/api/errors.js` — created
- `src/constants/uploads.js` — created (single accepted-type constant)
- `src/lib/format.js` — created (display placeholders, file size, `documentKey`)
- `src/lib/filters.js` — created (search fields, filter facets, AND combination)
- `src/lib/file.js` — created (base64 without the `data:` prefix)
- `src/components/Badges.jsx` — created
- `src/components/States.jsx` — created (loading / empty / error)
- `src/components/FieldList.jsx` — created
- `src/components/ReviewForm.jsx` — created
- `src/screens/Dashboard.jsx` — created
- `src/screens/DocumentDetail.jsx` — created
- `src/screens/Upload.jsx` — created
- `src/App.jsx` — replaced (Vite starter -> app shell, view state, data loading, review handling)
- `src/App.css` — replaced (app styles)
- `src/index.css` — replaced (tokens, reset, light/dark)
- `index.html` — modified (page title)
- `.env.example` — created (names only, no values)
- `.gitignore` — modified (`.env`, `.env.local`)

### Decisions

1. **Mocks hold RAW Sheet rows, not internal objects.** The mock transport returns the same column names n8n does, so `normalize.js` is exercised in Phase 1 and Phase 2 changes the transport only.
2. **`VITE_USE_MOCKS` defaults to on.** Phase 1 has no server, so an unset variable means mocks. Set it to `false` in Phase 2.
3. **Live branches throw, they do not stub.** Turning mocks off gives a readable `SERVER_MISCONFIGURED` message naming the phase, rather than a blank screen.
4. **No router.** View state is held in `App.jsx`; adding a routing dependency was not warranted for three views and no deep-link requirement.
5. **Selection uses a UI-only key.** `documentKey()` prefers `documentId` and falls back to the Sheet row number *for list keys and selection only*. It is never sent upstream — review always uses `documentId`.
6. **Review is guarded twice.** The detail screen renders no form for a non-reviewable row, and `client.js` refuses an empty `document_id` as a safety net.
7. **Progress narration is presentational.** The upload stage ticker runs client-side while the request is in flight; it is not driven by n8n, so the client signature stays identical between mock and live.
8. **Fixed table layout, no horizontal scroll.** Seven scannable columns with percentage widths, long values wrapping; the table still sits in an `overflow-x` container as a safety net for very narrow windows.
9. **A failed upload keeps the file selected** so retry needs no re-pick (SPEC.md 5.1).
10. **Reviewer name is required** before submit — form validation only, so a review is attributable. Note text stays optional.

### Deviations

Three additions beyond the literal prompt, all Phase-1 scaffolding rather than product scope:

- **Mock scenario switch** in the header (normal / empty / error / slow), visible only when `VITE_USE_MOCKS` is on. Without it the empty and error states are unreachable offline, and SPEC.md's Phase 1 exit criterion is that every state can be demonstrated. It is a mock control, not a business field.
- **`.env.example`** committed with variable *names* only, plus `.env` added to `.gitignore`, so no one has to guess the variable names in Phase 2.
- **`index.html` title** changed from the scaffold default to the project name.

Not done, as instructed: no Express server, no n8n calls, no Phase 2 work. The unused Vite starter assets in `src/assets/` were left in place.

### Follow-ups

- Phase 2 flips `VITE_USE_MOCKS` to `false` and implements the Express proxy plus `GET /api/documents`; only the transport inside `client.js` changes — screens and the normaliser stay as they are.
- Confirm the upload size ceiling: `MAX_UPLOAD_BYTES` is a 10 MB placeholder pending the real n8n limit (SPEC.md 8).
- The Vite dev proxy for `/api` is still to be configured in Phase 2.
- Still open from Prompt 2: **DOCX and TXT verification in n8n Workflow A before final submission.** The UI accepts both today and shows a note that they are still being validated.

---

## Prompt 4 — Fix: review does not update the UI automatically (mock mode)

- **Date:** 2026-09-10
- **Phase:** 1 — Mock data (fix)
- **Goal:** Make a submitted review update the selected document in local state immediately, so the detail screen and the dashboard badge both reflect it without a manual refresh.

### Prompt (verbatim)

> Fix the Phase 1 mock review behavior.
>
> Current issue:
> The Review Form renders correctly, but after clicking "Save review" the document status does not update automatically in the UI. It only changes manually.
>
> Expected mock behavior:
> - In mock mode only, submitting the review form must update the selected document in local application state.
> - Update:
>   - status
>   - reviewedBy
>   - reviewNote
> - The Document Detail screen must immediately reflect the new values.
> - When navigating back to the Dashboard, the updated status badge must also be visible.
> - Do not call n8n.
> - Do not add real network requests.
> - Do not begin Phase 2.
> - Keep Google Sheets as the future source of truth; this local update is only for mock mode.
> - Preserve the existing legacy-row rule: documents with an empty Document ID must not be reviewable.
>
> After fixing:
> 1. test the review flow in mock mode,
> 2. verify the detail screen updates,
> 3. verify the dashboard updates,
> 4. record this fix in PROMPTS.md,
> 5. stop.

### Result

**Root cause: inconsistent Document ID comparison.** `client.js` trims the `document_id` it sends, but two other places compared ids untrimmed:

- `App.handleReview` matched `item.documentId === response.document_id` — an untrimmed local value against a trimmed echoed one.
- `mockSubmitReview` looked the row up with `item['Document ID'] === document_id`.

Google Sheet values routinely carry stray whitespace. When a Document ID has any, the two comparisons disagree and the local state update silently does nothing — the review is recorded but the badge only changes on the next manual refresh, which is exactly the reported symptom.

**Reproduction.** With the original mock data (clean ids) the flow could not be made to fail in a headless browser: four variants — immediate read, slow scenario, refresh race, and two documents in one session — all updated correctly. Adding a single trailing space to one mock Document ID reproduced a failure immediately (the mock lookup 404s; against live n8n the write would succeed while the UI stayed stale). That row now keeps its trailing space **on purpose**, as a permanent regression fixture.

**Fix.**

- New `src/lib/review.js` owns both concerns: `sameDocumentId()` (trims both sides; an empty id never matches, preserving the legacy-row rule) and `applyReviewToDocuments()` (returns a new list with status, reviewedBy and reviewNote applied).
- `App.handleReview` applies the review from the echoed response through that helper, so the update no longer depends on the background re-read finishing or succeeding.
- `mockSubmitReview` uses the same comparison, so mock and live match ids identically.
- The background re-read after a review no longer clears the list if it fails (`load({ background: true })`), and the dashboard now renders the table alongside an error banner instead of hiding it — a failed refresh cannot blank a list that is already on screen.

**Verification** (headless browser, mock mode, zero console errors):

| Check | Result |
|-------|--------|
| Whitespace-id document, detail screen | `Needs Review` → `Reviewed` immediately, with reviewer and note shown; header badge updated too |
| Dashboard after Back | `Reviewed` on the row, read with no wait |
| Reverse direction (`Reviewed` → `Needs Review`) | Detail and dashboard both updated |
| Persistence across a manual Refresh | Status and reviewer survived the re-read |
| Legacy row (empty Document ID) | 0 review forms rendered; explanation shown |
| Full Phase 1 suite re-run | Unchanged; 0px horizontal overflow |

`npm run lint` and `npm run build` both clean.

### Files touched

- `src/lib/review.js` — created (`sameDocumentId`, `applyReviewToDocuments`)
- `src/App.jsx` — modified (review application via the helper; `background` load option)
- `src/api/mock.js` — modified (trim-safe row lookup; whitespace fixture on one Document ID)
- `src/screens/Dashboard.jsx` — modified (table stays visible when an error banner shows)
- `PROMPTS.md` — modified (this entry)

### Decisions

1. **One comparison for Document IDs.** Every id match goes through `sameDocumentId`. Inconsistent trimming caused this bug; a single helper stops it recurring in Phase 4 when the real endpoint is wired.
2. **The local update is independent of the re-read.** The review is applied from the response echo first; the re-fetch follows and is authoritative from Phase 2 onward. Previously a slow or failed re-read was the only thing making the change visible.
3. **The whitespace fixture stays.** A Document ID with a trailing space is realistic Sheet data and now guards this regression permanently.
4. **A failed refresh never blanks a loaded list.** Only a visible load starts from empty; a background refresh failure leaves the data on screen with the error shown above it.
5. **Legacy rule strengthened, not weakened.** `sameDocumentId` returns false for an empty id, so a blank Document ID can never match another blank one.

### Deviations

The dashboard error/table rendering change goes slightly beyond the literal request. It is the same defect class — a background failure silently discarding correct on-screen state — and without it the re-read after a review could still wipe the list.

**Not verified by test:** mock mode offers no way to fail *only* the background refresh, so the `background` guard is confirmed by inspection rather than by an executed test. Everything else in the table above was executed.

### Follow-ups

- Phase 4 wires `POST /api/review` for real; `handleReview` should not need to change, since it already works from the response echo and re-reads afterwards.
- Worth confirming with n8n whether it trims `document_id` on lookup, or whether whitespace in the Sheet can produce a 404 upstream (relates to the open uniqueness question in SPEC.md 8).
- Still open: DOCX/TXT verification in Workflow A before final submission.

---

## Prompt 5 — Debug: review still not updating in the real browser

- **Date:** 2026-09-10
- **Phase:** 1 — Mock data (debugging fix)
- **Goal:** Find the real reason a saved review does not stay visible, after the Prompt 4 fix did not resolve it in manual testing.

### Prompt (verbatim)

> The mock review bug still exists in the real browser.
>
> I tested it manually:
> - Open a document with status "Needs Review"
> - Select "Reviewed"
> - Enter reviewer name
> - Click "Save review"
> - The displayed document status does NOT change to "Reviewed"
>
> Do not assume the previous fix worked.
>
> Please inspect the actual current code and trace the complete review flow:
> ReviewForm -> submit handler -> mockSubmitReview -> App state -> selected document -> DocumentDetail render.
>
> Find the real root cause and fix it.
>
> Requirements:
> - After clicking Save review, the current status badge must immediately change to Reviewed.
> - Reviewed By and Review Note must immediately display the submitted values.
> - Going back to Dashboard must show Reviewed for the same document.
> - No page reload required.
> - No n8n calls.
> - No real network calls.
> - Do not begin Phase 2.
>
> After fixing:
> 1. Run lint/build.
> 2. Explain the exact root cause.
> 3. State exactly which files were changed.
> 4. Record this debugging fix in PROMPTS.md.
> 5. Stop.

### Result

**The Prompt 4 fix was aimed at the wrong thing.** Trimming the Document ID comparison was a genuine defect, but it was not what the manual test was hitting.

**Actual root cause: `handleReview` re-read the document list straight after applying the review, and the re-read overwrote it.**

The write and the read were two independent things that could disagree:

1. `handleReview` applied the review to local state — correct, and visible immediately.
2. It then called `load({ background: true })`, which replaced the entire list ~650ms later with whatever `getDocuments()` returned.
3. Whenever that read did not reflect the write, the badge silently reverted to `Needs Review`.

**Why the read stopped reflecting the write in a real dev session — and not in a test.** The mock store was module-level state (`let rows`) in `src/api/mock.js`. Vite re-executes a module on every hot update, which reset that store to the pristine fixture mid-session. Every file edit during Prompts 3 and 4 silently discarded reviews already recorded in the browser that was left open. After that, each save applied locally and was reverted 650ms later by a read of a store that had never seen it. A fresh page load — which is what every automated run did — always had a store in sync, so the bug was invisible to the tests.

**Proof.** I made the re-read blind to the write (returning the pristine fixture) and recorded the badge over time: `Reviewed` at 200ms through 3000ms, then `Needs Review` at the end, and `Needs Review` on the dashboard. That is the reported symptom exactly. With the fix in place and the same experiment applied, the badge stays `Reviewed` all the way through to the dashboard.

**Fix, in two parts.**

1. **No re-read in mock mode** (`src/App.jsx`). Mock mode has no source of truth to re-read; the local update *is* the simulated result, as Prompt 3 specified. The re-read now runs only when `USE_MOCKS` is false, which is where it is meaningful — Phase 2 onward, keeping Google Sheets authoritative.
2. **The mock store survives hot updates** (`src/api/mock.js`). Rows and the scenario now live in one object kept in `import.meta.hot.data`, so a hot update no longer resets them. `import.meta.hot` is undefined in a production build, where a fresh store per page load is correct.

**Verification** (against the dev server on port 5173 — the one being tested manually — with label clicks and typed input, zero console errors):

| Check | Result |
|-------|--------|
| Save review, current status badge | `Needs Review` → `Reviewed` immediately |
| Reviewed By / Review Note | Show the submitted values immediately |
| Back to dashboard | Row shows `Reviewed`, no reload |
| Failing condition from the repro (read blind to the write) | Stays `Reviewed` — no revert |
| Hot update while the page is open, then Refresh | Review survives |
| Reverse direction, whitespace id, persistence across Refresh | All pass |
| Legacy row (empty Document ID) | 0 review forms; explanation shown |
| Full Phase 1 suite | Unchanged; 0px horizontal overflow |

`npm run lint` and `npm run build` both clean.

### Files touched

- `src/App.jsx` — modified (`handleReview` re-reads only when not in mock mode)
- `src/api/mock.js` — modified (rows + scenario moved into an HMR-persistent store)
- `PROMPTS.md` — modified (this entry)

No other files changed. The Prompt 4 changes (`src/lib/review.js`, the trim-safe id comparison, the dashboard error/table behaviour) were left in place — they fix a separate, real defect.

### Decisions

1. **Mock mode does not re-read after a review.** SPEC.md 5.4 requires re-reading so Sheets stays the source of truth; that applies to live mode. In mock mode the re-read has no authority and can only overwrite a correct update.
2. **Dev-only state belongs in `import.meta.hot.data`.** Any module-level store that has to outlive an edit needs this, or it silently resets and produces bugs that no fresh-page test can see.
3. **A read that follows a write must be able to see it.** The write/read split was the real defect; both parts of the fix close it from opposite ends.

### Deviations

None. No Phase 2 work, no network calls, no n8n.

### Lesson for the remaining phases

Every automated check so far started from a fresh page load, so a whole class of bug — state that degrades over a long-lived dev session — was invisible. When a manual report and a passing test disagree, the test's starting conditions are the thing to doubt first.

### Follow-ups

- **Phase 4 carries the same hazard for real.** n8n writes to Sheets asynchronously, so an immediate re-read may return the pre-review row and revert the badge the same way. When `POST /api/review` is wired, either re-read only after the write is confirmed, or keep the applied review until a read actually contains it.
- Still open: DOCX/TXT verification in Workflow A before final submission.

---

## Prompt 6 — Phase 2: connect the dashboard to Workflow B

- **Date:** 2026-09-10
- **Phase:** 2 — GET /documents
- **Goal:** Add the Express proxy and connect the dashboard to the real `GET /webhook/documents`, with the API key held server-side only.

### Prompt (verbatim)

> Now build Phase 2 only.
>
> Goal:
> Connect the existing React dashboard to the real n8n Workflow B:
> GET /webhook/documents
>
> Requirements:
>
> - Create a small Express server.
> - The browser must call:
>   GET /api/documents
> - The Express server must call the real n8n endpoint:
>   GET /webhook/documents
> - Add the x-api-key header server-side only.
> - Never expose the API key in React, VITE_* variables, browser code, logs or UI.
> - Read the n8n base URL and API key from server-side environment variables.
> - Keep VITE_USE_MOCKS so mock mode can still be used.
> - When mock mode is disabled, Dashboard must use the real Google Sheets rows returned by Workflow B.
> - Use the existing normalizer to map Google Sheet column names to the internal document shape.
> - Do not change business logic.
> - Do not build real upload yet.
> - Do not connect real review yet.
>
> Create/update:
> - Express server files
> - .env.example
> - Vite dev proxy if needed
> - src/api/client.js
>
> After implementation:
> 1. run lint and build,
> 2. explain how to start both React and Express locally,
> 3. record this as the next prompt in PROMPTS.md,
> 4. stop before Phase 3.

### Result

`GET /api/documents` is wired end to end. Upload and review remain unwired and fail readably in live mode.

**Express proxy** (`server/`, 4 files, Express 5):
- `config.js` — reads `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_API_KEY_HEADER` (default `x-api-key`), `PORT`, `N8N_TIMEOUT_MS`; reports *which* variables are missing by name, never values. Holds `N8N_PATHS`, the one place upstream paths are written down — including the temporary `-v2` upload path, declared but not wired.
- `errors.js` — the error contract with its HTTP status table, plus a `sanitize()` pass that redacts key-shaped text, `authorization`/`api-key` values and URL credentials from anything leaving the server.
- `n8n.js` — the only function that talks to n8n. Attaches the key, applies an abortable timeout, and maps every failure onto a contract code.
- `index.js` — `/api/health` (booleans and missing-variable *names* only), `/api/documents`, and a catch-all that says upload is Phase 3 and review is Phase 4. Logs failures as route + code, never the key or a full upstream URL.

**Frontend** (`src/api/client.js`) — one `request()` helper reads the error contract back and turns it into an `ApiError`; `getDocuments()` calls `/api/documents` when mocks are off and passes the raw Sheet rows through the **existing normaliser**, so the shape reaching the UI is identical in both modes. No screen or component changed.

**Vite dev proxy** — `/api` → `http://localhost:3001` (override with `VITE_PROXY_TARGET`), so the browser sees one origin and never learns where n8n lives.

**Verification.** `npm run lint` and `npm run build` clean. Tested against a stand-in n8n returning real Sheet-shaped rows:

| Case | Result |
|------|--------|
| Happy path | 200, upstream array passed through verbatim |
| Upstream received the header | `x-api-key` present on `/webhook/documents` |
| Empty sheet returns `{}` | 200 `[]` |
| Upstream 500 | 502 `UPSTREAM_ERROR` |
| Non-JSON body | 502 `UPSTREAM_BAD_SHAPE` |
| Bad credentials | 502 `UPSTREAM_UNAUTHORIZED`, message says nothing about the key |
| Dead upstream | 503 `UPSTREAM_UNREACHABLE` |
| No env vars set | health `n8nConfigured:false`; documents 500 `SERVER_MISCONFIGURED` naming the missing variables |
| Live mode in the browser | 2 live rows rendered through the normaliser; mock badge and scenario switch hidden; only `/api/documents` requested |
| Live legacy row (empty Document ID) | Still not reviewable — 0 review forms |
| Upload / review in live mode | Readable `SERVER_MISCONFIGURED` "Live mode is not available yet", no crash, no false success |
| Mock mode | Full Phase 1 suite unchanged |
| Key leakage | Absent from every response body, server log, page HTML, and the built bundle |

### Files touched

- `server/config.js` — created
- `server/errors.js` — created
- `server/n8n.js` — created
- `server/index.js` — created
- `src/api/client.js` — modified (`request()` helper; `getDocuments()` calls the proxy when mocks are off)
- `vite.config.js` — modified (dev proxy for `/api`)
- `eslint.config.js` — modified (Node globals for `server/**` and config files)
- `package.json` — modified (`express` dependency; `server` and `server:watch` scripts)
- `.env.example` — rewritten (server and client sections, names only)
- `PROMPTS.md` — this entry

No screen, component or normaliser changed. No business logic touched.

### Decisions

1. **The proxy passes the upstream array through verbatim.** Raw Sheet column names cross the wire and the frontend's single normaliser maps them, exactly as in mock mode. Normalising server-side would have created a second place where column names live.
2. **An empty object from an empty Sheet is treated as an empty list.** SPEC.md 8 still lists the empty-Sheet response shape as unknown. An empty body or `{}` both plainly mean "no documents", so they render the empty state rather than an error. Anything else is `UPSTREAM_BAD_SHAPE`. Revisit once the real shape is confirmed.
3. **A 404 from the documents endpoint maps to `UPSTREAM_ERROR`, not `DOCUMENT_NOT_FOUND`.** `DOCUMENT_NOT_FOUND` is reserved for review (CONTRACT.md 1.C); a 404 here means the workflow is inactive, and the detail says so.
4. **Missing configuration is reported by variable name, never value**, in the health route, the error detail and the startup log — so a misconfigured server is diagnosable without leaking anything.
5. **`sanitize()` runs on every outgoing error detail.** Nothing should ever carry a key; a redaction pass is cheaper than trusting every future call site.
6. **Node's `--env-file-if-exists` instead of a `dotenv` dependency.** The server still starts without a `.env`, reports itself unconfigured, and serves the readable error.
7. **Timeout is configurable (`N8N_TIMEOUT_MS`, 30s default).** Phase 3 needs a much longer one for processing; the knob is in place.

### Deviations

Two small additions beyond the listed files, both needed to make the checks pass or the server diagnosable:

- `eslint.config.js` gained a Node-globals block for `server/**` — without it, lint fails on `process` and `console`.
- `package.json` gained `server` / `server:watch` scripts and the `express` dependency.

Not done, as instructed: no real upload, no real review, no change to any screen.

### Follow-ups

- Phase 3 wires `POST /api/process-document` to `N8N_PATHS.processDocument`. It needs `express.json()` with a raised body limit for base64 payloads, and a much longer timeout than 30s.
- Confirm the real empty-Sheet response shape and tighten decision 2 (SPEC.md 8).
- In dev, React StrictMode double-invokes the mount effect, so the dashboard issues two `GET /api/documents` calls on load. Dev-only and harmless; worth removing if it ever hits a rate limit.
- Production serving is not set up: the Express server does not serve `dist/` yet, so a production run needs either that or a separate static host.
- Still open: DOCX/TXT verification in Workflow A before final submission.

---

## Prompt 7 — Fix: Received column overlapping Customer on live data

- **Date:** 2026-09-10
- **Phase:** 2 (fix) — dashboard layout only
- **Goal:** Format `Received At` for display as `YYYY-MM-DD HH:mm` so full ISO timestamps from Google Sheets stop spilling into the Customer column.

### Prompt (verbatim)

> Fix only the dashboard Received column layout.
>
> Current issue:
> Real Google Sheets data returns full ISO timestamps such as:
> 2026-09-06T16:34:04.422+03:00
>
> The timestamp text overlaps the Customer column.
>
> Requirements:
> - Format Received At for display only as:
>   YYYY-MM-DD HH:mm
> - Do not modify the underlying data.
> - Do not modify the API contract.
> - Do not change sorting logic.
> - Keep the dashboard without horizontal scrolling.
> - Verify that Customer text no longer overlaps the Received column.
> - Do not begin Phase 3.
> - Record this fix in PROMPTS.md.

### Result

**Root cause.** `displayDate` tidied timestamps with `text.replace('T',' ').replace(/(:\d{2})\.\d+Z?$/,'')`. That second pattern is anchored at the end of the string, so it only stripped a trailing `Z` or bare seconds. A real value ends with a `+03:00` offset, so nothing was stripped and the full 29-character string rendered into a column sized for 16. With `white-space: nowrap` on `.cell-date` and `table-layout: fixed`, the text could not wrap, so it overflowed its cell and ran across Customer.

The mock fixtures all used short `YYYY-MM-DD HH:mm` strings, which is why Phase 1 never showed it.

**Fix.**

1. `displayDate` now matches the date and time of an ISO-8601-ish timestamp and rebuilds `YYYY-MM-DD HH:mm` from those parts, ignoring seconds, fractional seconds, `Z` and any offset. Values that are not timestamps — a plain `YYYY-MM-DD` delivery date, or anything unrecognised — pass through untouched rather than being mangled.
2. `.cell-date` lost `white-space: nowrap` and gained `overflow-wrap: anywhere`, so an unexpected value wraps inside its own cell instead of spilling across the next column. The formatting is the fix; this is the safety net.
3. The Received column went 13% → 15% (Customer 24% → 22%) so a formatted timestamp never wraps to two lines.

**Components are taken verbatim from the string rather than parsed into a `Date`.** Parsing would re-express the value in the viewer's timezone and show a different time than the record holds; a `+03:00` timestamp would read three hours earlier for a viewer in UTC. Formatting must not reinterpret the value.

**Verification** — proxy pointed at a stand-in returning the live timestamp shapes, at 1440 / 1280 / 1024 px:

| Check | Result |
|-------|--------|
| `2026-09-06T16:34:04.422+03:00` | `2026-09-06 16:34` |
| `...Z`, `...-05:00`, `...+13:45` variants | All render `YYYY-MM-DD HH:mm` |
| Already-short `2026-09-10 09:14` | Unchanged |
| Plain date `2027-01-15` | Unchanged (delivery/deadline fields) |
| Empty / missing | `—` placeholder |
| Unrecognised text | Passed through, not mangled |
| Cell overflow, all rows, all widths | 0 |
| Received cell overlapping Customer | 0 at every width |
| Page horizontal overflow | 0px at every width |
| Date wrapping to two lines | None |
| Mock mode suite | Unchanged |

`npm run lint` and `npm run build` clean.

### Files touched

- `src/lib/format.js` — modified (`displayDate` rewritten)
- `src/App.css` — modified (`.cell-date` wrapping; Received/Customer column widths)
- `PROMPTS.md` — this entry

No data, contract, server, normaliser or ordering change. The list still renders in the order n8n returns it; nothing here feeds sorting.

### Decisions

1. **Wall-clock components, not `Date` parsing.** Display formatting must never shift the time a record holds into the viewer's timezone.
2. **The timestamp match is not anchored to the start of the string.** Live data contains rows whose `Received At` value carries a label before the timestamp; an anchored match left those long and unformatted. Searching finds the timestamp wherever it sits.
3. **Unrecognised values pass through untouched.** Better a readable oddity than a silently mangled one — and the wrap rule keeps it from breaking the layout.
4. **Widening the column beat keeping `nowrap`.** `nowrap` is what turned a long value into an overlap; wrapping plus enough width fixes the common case and contains the uncommon one.

### Deviations

The column-width adjustment (13% → 15%) was not requested. Without it the formatted date wrapped onto two lines on some rows — visually fixed, but untidy. Page-level horizontal overflow stays 0.

Note: at 1024px the table's own scroll container carries 2px of internal overflow. It is a percentage-rounding artifact, measured as identical before and after this change, and the page itself never scrolls horizontally.

### Follow-ups

- **Live data quality, worth raising with whoever owns the sheet:** some rows carry a label prefix inside the `Received At` value, and at least one has `Customer` filled with a not-found style placeholder. The app now displays these tidily, which means the underlying data issue is no longer visible from the dashboard.
- Mock fixtures use short timestamp strings while live data uses full ISO. Adding one ISO-shaped fixture to `src/api/mock.js` would let Phase 1 mock mode catch this class of formatting bug.
- Still open: DOCX/TXT verification in Workflow A before final submission.

---

## Prompt 8 — Phase 3: connect the real document upload

- **Date:** 2026-09-10
- **Phase:** 3 — process-document
- **Goal:** Connect the existing Upload screen to n8n Workflow A through the Express proxy, with the key server-side and a timeout long enough for AI processing.

### Prompt (verbatim)

> Now build Phase 3 only: connect the real document upload.
>
> Goal:
> Connect the existing Upload screen to the real n8n Workflow A through the Express proxy.
>
> Architecture:
> Browser -> POST /api/process-document -> Express -> POST /webhook/process-document-v2 -> n8n
>
> Requirements:
>
> - Do not call n8n directly from React.
> - Add POST /api/process-document to the Express server.
> - Forward this JSON body exactly:
>   {
>     "file_name": string,
>     "mime_type": string,
>     "file_base64": string
>   }
> - Express must add the x-api-key header server-side.
> - The API key must never reach browser code, logs, UI, or VITE_* variables.
> - Upstream n8n endpoint is /webhook/process-document-v2.
> - Keep that upstream path defined in one server-side location only.
> - Increase the Express JSON body size limit enough for base64 file uploads.
> - Increase the n8n timeout for document processing to 180000 ms because AI processing can take time.
> - Update .env.example accordingly, but never put the real secret value there.
>
> Frontend:
> - Connect the existing Upload screen to /api/process-document.
> - Convert the selected file to base64.
> - Send file_name, mime_type and file_base64.
> - Show a clear Processing state while waiting.
> - On success show:
>   document_id
>   file_name
>   file_link
>   received_at
>   extracted fields
>   urgency
>   notification_sent
> - Keep the selected file available if processing fails so Retry is possible.
> - Do not invent any fields.
> - Do not implement AI or business logic in the app.
>
> File types:
> - The UI may accept PDF, DOCX and TXT as required by SPEC.
> - The current n8n Workflow A has only been verified with PDF.
> - Do not hide this limitation or reimplement DOCX/TXT parsing in the app.
>
> Testing:
> - Run lint and build.
> - Do not trigger my real n8n workflow automatically during your own tests.
> - Explain exactly how I should manually test Phase 3 with a real PDF.
> - Record this as the next entry in PROMPTS.md.
> - Stop before Phase 4 / real review.

### Result

Upload is wired end to end. Review remains unwired.

**Server.** `POST /api/process-document` forwards exactly three fields — `file_name`, `mime_type`, `file_base64` — to `N8N_PATHS.processDocument`, and passes the response back untouched. The payload is rebuilt field by field rather than spread, so anything extra a client sends is dropped rather than forwarded. `express.json()` now runs with a configurable limit (`MAX_REQUEST_BODY`, default `20mb` — base64 inflates a file by about a third, and the UI caps files at 10 MB). `callN8n` takes a per-call timeout, and this route passes `N8N_PROCESS_TIMEOUT_MS` (default 180000) while the documents read keeps its 30s. A body-parser error handler turns an oversized payload into `PAYLOAD_TOO_LARGE` and malformed JSON into `BAD_REQUEST` instead of an Express stack trace.

**Frontend.** `processDocument()` in `src/api/client.js` now posts to `/api/process-document` when mocks are off, with a 190s client timeout — deliberately longer than the server's 180s, so a slow workflow surfaces as the server's readable timeout rather than the browser giving up first. No screen or component changed: the Upload screen already read the file as base64 without a `data:` prefix, showed the processing state, rendered the full result, kept the file selected on failure and carried the DOCX/TXT caveat.

**Verification** — against a stand-in Workflow A on isolated ports. **The real n8n workflow was never called.**

| Check | Result |
|-------|--------|
| Path and auth | `POST /webhook/process-document-v2` with `x-api-key` present |
| Body forwarded | Exactly `file_name`, `mime_type`, `file_base64`; no `data:` prefix on the base64 |
| Extra field injected by a client | Dropped, not forwarded |
| Incomplete body | 400 `BAD_REQUEST` |
| Malformed JSON | 400 `BAD_REQUEST` |
| Payload over the limit | 413 `PAYLOAD_TOO_LARGE` |
| Upstream 500 | 502 `UPSTREAM_ERROR` |
| Upstream returns an array | 502 `UPSTREAM_BAD_SHAPE` |
| Processing timeout | 504 `UPSTREAM_TIMEOUT` |
| Browser, successful upload | Processing state shown, then document_id, file_name, file_link, received_at, all extracted fields, urgency badge and notification_sent |
| Browser, failed upload | Readable error, **file still selected**, "Try again" offered |
| Unsupported type (.xlsx) | Rejected client-side, **zero requests sent** |
| Key or base64 in server logs | Absent |
| Key in page HTML | Absent |
| Mock mode | Full Phase 1 suite unchanged |

`npm run lint` and `npm run build` clean.

### Files touched

- `server/index.js` — modified (process-document route, `express.json` limit, body-parser error handler, startup banner)
- `server/config.js` — modified (`processTimeoutMs`, `jsonLimit`)
- `server/n8n.js` — modified (per-call timeout override)
- `src/api/client.js` — modified (`processDocument` posts to the proxy)
- `.env.example` — modified (`N8N_PROCESS_TIMEOUT_MS`, `MAX_REQUEST_BODY`, names only)
- `eslint.config.js` — modified (`argsIgnorePattern` for the four-argument Express error handler)
- `PROMPTS.md` — this entry

No screen or component changed. No business logic added.

### Decisions

1. **The payload is rebuilt, not spread.** Only the three contract fields reach n8n, so a modified client cannot smuggle extra keys into the workflow.
2. **Timeouts are per-call, not global.** A read that hangs for 180s would be a bad experience; processing legitimately needs it. One config value each.
3. **The client waits longer than the server.** 190s vs 180s, so the timeout the user sees is the server's explanatory one.
4. **Validation stays at transport level.** The proxy checks that a request is well formed, never which file types the workflow can read — that is n8n's business (SPEC.md NG-1).
5. **The DOCX/TXT caveat stays visible.** The UI still accepts all three types and still shows the note that DOCX and TXT are being validated end to end. The app does not parse them itself, and a failure surfaces as a normal readable error.
6. **The `-v2` path is still written in exactly one place** (`N8N_PATHS` in `server/config.js`), never in a route handler and never in the frontend.

### Deviations

`eslint.config.js` needed `argsIgnorePattern: '^_'` because Express identifies an error handler by its four-argument signature, so `next` must be declared even when unused. Nothing else beyond the listed files.

Not done, as instructed: no review wiring, no Phase 4 work, and the real workflow was never triggered.

### Follow-ups

- **DOCX and TXT are still unverified upstream** — the standing pre-submission item.
- The 10 MB client cap (`MAX_UPLOAD_BYTES`) is still a placeholder; the real n8n limit remains an open question (SPEC.md 8). If it is lower than 10 MB, a large file will fail upstream rather than being rejected in the browser.
- After a successful upload the dashboard re-reads, so a new document appears without a manual refresh.
- Phase 4 wires `POST /api/review` to `N8N_PATHS.review`, including the 404 case — and carries the write-then-read hazard noted in Prompt 5.

---

## Prompt 9 — Phase 4: connect the real review flow

- **Date:** 2026-09-11
- **Phase:** 4 — review
- **Goal:** Connect the existing Review form to n8n Workflow C through the Express proxy, with the key server-side, Document ID as the only identifier, and no optimistic update.

### Prompt (verbatim)

> Now build Phase 4 only: connect the real review flow.
>
> Goal:
> Connect the existing Review form to the real n8n Workflow C through the Express proxy.
>
> Architecture:
> Browser -> POST /api/review -> Express -> POST /webhook/review -> n8n
>
> Requirements:
>
> - Do not call n8n directly from React.
> - Add POST /api/review to the Express server.
> - Forward exactly:
>   {
>     "document_id": string,
>     "status": "Reviewed" or "Needs Review",
>     "reviewed_by": string,
>     "review_note": string
>   }
>
> - Express must add the x-api-key header server-side.
> - Never expose the API key in browser code, VITE_* variables, logs or UI.
> - Upstream endpoint is /webhook/review.
> - Use Document ID as the only stable identifier.
> - Do not use row_number or file name as fallback.
> - Documents with an empty Document ID must remain non-reviewable.
>
> Frontend:
> - Connect the existing Review form to POST /api/review when mocks are off.
> - Show a saving state while the request is running.
> - On success:
>   - update the visible review status,
>   - update Reviewed By and Review Note,
>   - refresh the dashboard data from GET /api/documents so Google Sheets remains the source of truth.
> - On failure:
>   - show a readable error,
>   - keep the entered review values so the user can retry.
>
> Error handling:
> - If n8n returns 404 because the Document ID does not exist, return a clear DOCUMENT_NOT_FOUND error to the frontend.
> - Do not perform optimistic updates before the real n8n response succeeds.
>
> Testing:
> - Run lint and build.
> - Do not trigger my real n8n review workflow automatically during your own tests.
> - Explain exactly how I should manually test Phase 4 with one real document.
> - Record this as the next entry in PROMPTS.md.
> - Stop after Phase 4.

### Result

Review is wired end to end. All three workflows are now connected.

**Server.** `POST /api/review` rebuilds the payload from exactly four fields — `document_id`, `status`, `reviewed_by`, `review_note` — and forwards it to `N8N_PATHS.review` with the key added in `callN8n`. Transport validation only: a blank `document_id` or a status other than `Reviewed` / `Needs Review` is a 400 that never reaches n8n. There is no fallback identifier, so a body carrying only `row_number` or `file_name` is rejected the same way. `callN8n` gained an optional `mapUpstreamError(status, body)` hook, so the review route can give its 404 its own meaning without changing how the other routes treat a 404.

- **404 → `DOCUMENT_NOT_FOUND`**, detected by status code as CONTRACT.md 1.C requires. The single exception is n8n's built-in "webhook not registered" reply (also a 404, but with `message` and no `success` field). That stays `UPSTREAM_ERROR` with "Is the n8n workflow active?", because calling an inactive workflow "document not found" would send you hunting for a row that exists.
- **200 is only success when the body says `success: true`.** An empty body, `{}` or `success: false` becomes `UPSTREAM_BAD_SHAPE`: "sent, but n8n did not confirm it was saved — refresh before trying again". This is the server half of "no optimistic update".

**Frontend.** `submitReview()` posts to `/api/review` when mocks are off (35s client timeout, just above the server's 30s), and returns the review through a new `normalizeReviewResult()`. The echoed values win and a missing field falls back to what was sent. The Document ID is always the one sent, since that is the identity the UI already holds. `App.handleReview` applies the review to local state only after `submitReview` resolves, then re-reads `GET /api/documents` in the background. The re-read starts after n8n has answered, which closes the write-then-read hazard noted in Prompt 5. The form already had a saving state and kept its values on failure. It now also sets `aria-busy`, says "Review saved to Google Sheets." in live mode, and shows "Your entries have been kept." under any error.

One fix in the shared request path came out of testing. With Express stopped, the Vite dev proxy answers with a bare 502 and an empty body. The client used to show that as "The request failed." (`INTERNAL_ERROR`). Express always returns the error contract, so any failure without one now becomes `UPSTREAM_UNREACHABLE` — "Could not reach the application server. Is the Express server running?" — and a non-JSON failure body (an HTML error page) takes the same path. The dashboard and upload benefit too.

**Verification** — against a stand-in Workflow B + C on isolated ports, proxy started without `.env`. **The real n8n workflow was never called.**

| Check | Result |
|-------|--------|
| Path, auth, body | `POST /webhook/review`, `x-api-key` present, body is exactly the four fields |
| Extra fields (`row_number`, `file_name`, `api_key`) from a client | Dropped |
| Empty / whitespace `document_id`; `row_number` or `file_name` only | 400 `BAD_REQUEST`, **not forwarded** |
| Status `Approved` | 400 `BAD_REQUEST`, not forwarded |
| Upstream 404 (contract body, or empty body) | 404 `DOCUMENT_NOT_FOUND` |
| Upstream 404 "webhook not registered" | 502 `UPSTREAM_ERROR` |
| Upstream 500 / 401 / timeout | 502 `UPSTREAM_ERROR` / 502 `UPSTREAM_UNAUTHORIZED` / 504 `UPSTREAM_TIMEOUT` |
| Upstream 200 with `{}`, empty body, `success: false` | 502 `UPSTREAM_BAD_SHAPE` |
| Malformed JSON | 400 `BAD_REQUEST` |
| Browser: saving state | "Saving review…", inputs and button disabled, badge still `Needs Review` |
| Browser: 404 | Readable message, no success text, badge unchanged, name/note/status kept, no retry button |
| Browser: 500 then Save again | Error shown with entries kept; second save succeeds with the same values |
| Browser: success | Status, Reviewed By and Review Note update; stub saw `POST /webhook/review` → `GET /webhook/documents`; badge stays `Reviewed` after the re-read; dashboard row shows `Reviewed` |
| Browser: Express stopped, then Save | `UPSTREAM_UNREACHABLE` "Could not reach the application server", entries kept, badge unchanged |
| Browser: Express restarted, Save again | Saved with the same entries |
| Browser: legacy row | No form, explanation shown, zero API calls |
| Key or n8n URL in page HTML / JS bundle / proxy log | Absent |
| Mock mode | Review still applies (including the trailing-space ID fixture), zero `/api` requests |

`npm run lint` and `npm run build` clean.

### Files touched

- `server/index.js` — modified (`POST /api/review`, `mapReviewError`, header comment, catch-all message, startup warning)
- `server/n8n.js` — modified (`mapUpstreamError` hook, `tryParseJson`)
- `server/config.js` — modified (comments only: all three paths are now wired)
- `src/api/client.js` — modified (`submitReview` posts to the proxy; `notWiredYet` removed; a failure without the error contract becomes `UPSTREAM_UNREACHABLE`)
- `src/api/normalize.js` — modified (`normalizeReviewResult`)
- `src/App.jsx` — modified (`handleReview` uses the normalised review; comments)
- `src/lib/review.js` — modified (comment only)
- `src/components/ReviewForm.jsx` — modified (`aria-busy`, live success text, "entries kept" hint)
- `src/App.css` — modified (`.form-hint`)
- `CONTRACT.md` — modified (§2.4: two rows for the not-registered 404 and the unconfirmed 200)
- `PROMPTS.md` — this entry

No business logic added. What a review changes in the Sheet, and anything it triggers, stays in Workflow C.

### Decisions

1. **Success means `success: true`, nothing weaker.** A 200 that does not say so is reported as unconfirmed, not saved. That is strict, but it is the only way "no optimistic update" holds when the upstream reply is ambiguous.
2. **404 is read by status code, with one named exception.** n8n's own not-registered reply is recognised by shape (`message`, no `success`), not by matching its text. Every other 404 is `DOCUMENT_NOT_FOUND`, as the contract says.
3. **The re-read starts after the write is confirmed.** This is the first of the two options Prompt 5 left open, and it is enough as long as Workflow C responds after its Sheets update. I did not build an overlay that keeps showing the applied review until a read contains it, because that would let the app outvote the Sheet.
4. **The Document ID sent is the key used locally.** The form already holds it and the API layer trims it (Prompt 4). An echoed id is never used to decide which row to update.
5. **DOCUMENT_NOT_FOUND offers no retry.** The same id would fail again. The message points to refreshing the dashboard instead.

### Deviations

- `CONTRACT.md` §2.4 got two table rows, because the proxy now distinguishes cases the contract did not spell out.
- The no-contract-body fix in `request()` touches every live call, not only review. I made it because the manual retry test stops Express, and without it that test would show an unhelpful message.

Not done, as instructed: nothing past Phase 4, and the real review workflow was never triggered.

### Follow-ups

- **Confirm the order of Workflow C's nodes:** Respond to Webhook must come after the Sheets update. If it responds first, a success can be reported before the write lands, and the re-read may briefly show the old status.
- **Confirm the 404 body** by reviewing an unknown id once against the real workflow (the `curl` step of the manual test). If it is not the contract body, update CONTRACT.md 1.C first.
- Still open from Prompt 4: whether n8n trims `document_id` on lookup. A Sheet ID with stray whitespace would 404, because the app sends the trimmed value.
- Still open: DOCX/TXT verification in Workflow A before final submission.

---

## Finalization and Submission Prompts

- **Date:** 2026-09-11
- **Phase:** Finalization — multi-format processing, live verification, documentation, workflow export
- **Goal:** Close the DOCX/TXT gap, verify the complete system against the real n8n workflows, and prepare the repository for submission.

### n8n Workflow A — multi-format processing

Upstream work in n8n. No application business logic was added.

- **PDF, DOCX and TXT processed end-to-end.** Closes the item carried since Prompt 2 (SPEC.md §5.1.1, §8.2).
- **Switch routing by MIME type.** A Switch node routes on `$binary.data.mimeType`: `application/pdf` → PDF, `text/plain` → TXT, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → DOCX.
- **TXT extraction.** A dedicated Extract from File (text) node.
- **DOCX conversion.** The file is uploaded to Google Drive as a Google Doc (resumable upload) and exported as `text/plain` through the Drive export API. The text then follows the same AI extraction path as PDF and TXT.

### Verification with the real application

Run through the real application against the real n8n workflows, Google Sheets, Google Drive and Gmail:

| Test | Result |
|------|--------|
| PDF processing | Passed |
| DOCX conversion and processing | Passed |
| TXT processing | Passed |
| Normal notification | Passed |
| Urgent notification | Passed |
| Dashboard loading | Passed |
| Review write-back to Google Sheets | Passed |

### Application and documentation updates

- **File picker:** `accept` changed to `.pdf,.docx,.txt` (extensions only) so DOCX and TXT files are selectable. Client-side validation is unchanged.
- **Verification status:** `verifiedUpstream` set for DOCX and TXT in `src/constants/uploads.js`; the Upload screen now reads "PDF, DOCX and TXT are supported and verified end-to-end."
- **README.md** rewritten as the final project README: overview, formats, features, workflows, endpoints, security, setup, verified tests, documentation index.
- **SPEC.md** updated to the implemented state: status header, §5.1.1 DOCX/TXT verified, §7 verification item ticked, §8.1 and §8.2 closed.

### n8n workflow exports

- **Exported:** Workflows A, B and C into `workflows/`.
- **Sanitized:** personal notification email addresses → `YOUR_NOTIFICATION_EMAIL@example.com`; Google Sheet IDs → `YOUR_GOOGLE_SHEET_ID`; the Google Drive folder ID → `YOUR_GOOGLE_DRIVE_FOLDER_ID`; Google `cachedResultUrl` values emptied. 13 values in total. Webhook paths, node names, expressions, logic, column mappings, HTTP methods and credential types are unchanged, and all three files are valid JSON.

### Upload endpoint

`/webhook/process-document-v2` remains the active Workflow A endpoint and is documented in README.md as the current implementation path. It is defined once, in `server/config.js` (`N8N_PATHS.processDocument`), so moving to `/webhook/process-document` stays a one-line server change.

### Final automated checks

| Check | Result |
|-------|--------|
| `npm run lint` | Passed |
| `npm run build` | Passed |
| Automated checks | 83/83 passed |

The 83 checks cover upload acceptance (file picker and drag-and-drop), the upload-screen verification note, mock-mode review, the `POST /api/review` proxy, the live-mode review flow and recovery when the Express server is stopped. They run in mock mode or against a local stand-in for n8n. The real workflows were verified through the manual end-to-end tests above.
