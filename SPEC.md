# SPEC.md — Smart Office Document Assistant (Application Layer)

Status: draft v1.1 — specification only, no application code written yet.
Last updated: 2026-09-10 (Prompt 2: confirmed auth header, upload types, review 404, legacy Document ID)

---

## 1. Purpose

Provide a web application layer on top of an **existing, already-working n8n automation**.

The n8n workflows already:

- receive a document,
- extract structured fields with AI,
- store the file in Google Drive,
- append a row to Google Sheets,
- decide urgency,
- send Gmail notifications,
- record human review decisions.

This project **does not rebuild any of that**. It builds only:

1. A React + Vite frontend for uploading, browsing, searching and reviewing documents.
2. A small Express server that proxies the browser to n8n and holds the n8n API key.

### 1.1 Non-goals (hard rules)

| # | Rule |
|---|------|
| NG-1 | **Never reimplement n8n business logic.** No AI extraction, no urgency scoring, no routing to responsible teams, no notification logic, no review side effects in app code. |
| NG-2 | **No second database.** Google Sheets is the single source of truth for the dashboard. No Postgres, no SQLite, no Mongo, no Prisma, no local persistence layer that is treated as authoritative. |
| NG-3 | **The n8n API key must never reach browser code.** It lives only as a server-side environment variable, read by the Express server. It must never appear in `VITE_*` variables, client bundles, source files, logs, or error messages returned to the browser. |
| NG-4 | **No secrets in the repository.** Documentation and code refer to environment variable *names* only. |
| NG-5 | The app is a thin client. If a behaviour can be decided in n8n, it is decided in n8n. |

### 1.2 Permitted client-side logic

Only presentation-level work:

- normalising the Google Sheet column names into a stable internal shape (see CONTRACT.md),
- sorting, searching and filtering already-returned rows,
- formatting dates, prices and quantities for display,
- mapping the `Urgency` string to a badge colour,
- form validation before an upload or review request is sent,
- loading / empty / error state handling.

None of the above may change the meaning of data, only its display.

---

## 2. Architecture

```
Browser (React + Vite)
        |
        |  same-origin JSON,  /api/*        no API key here
        v
Express server (Node)
        |
        |  adds n8n auth header from env    key lives only here
        v
n8n production webhooks
        |
        +-- Google Drive   (file storage)
        +-- Google Sheets  (source of truth)
        +-- Gmail          (notifications)
        +-- AI extraction, urgency, review logic
```

### 2.1 Frontend

- React 19 + Vite (already scaffolded in this repo: `src/`, `vite.config.js`).
- Plain JavaScript (`.jsx`), matching the existing scaffold.
- No global state library required; component state plus a small data-fetch layer is enough.
- All network access goes through one API module (`src/api/`), never `fetch` scattered in components.
- In development, Vite proxies `/api` to the Express server so the browser sees a single origin.

### 2.2 Express server

- Small, single responsibility: **authenticate and forward**.
- Exposes `/api/documents`, `/api/process-document`, `/api/review`, `/api/health`.
- Reads the n8n base URL and API key from environment variables at startup.
- Adds the auth header to every outbound n8n call.
- Normalises n8n errors into a small, readable JSON error shape (see CONTRACT.md §5).
- Does **not** cache, transform business meaning, store files, or persist anything.
- Body size limit must be raised above the default to allow base64 file uploads.

### 2.3 Environment variables (names only — never values)

Server-side (never exposed to the browser):

| Name | Purpose |
|------|---------|
| `N8N_BASE_URL` | Base URL of the n8n instance hosting the webhooks. |
| `N8N_API_KEY` | Secret key sent to n8n. **Server-only.** |
| `N8N_API_KEY_HEADER` | Header name used to send the key. **Confirmed value: `x-api-key`.** This is the header *name*, not a secret; the key value itself lives only in `N8N_API_KEY`. |
| `PORT` | Port the Express server listens on. |

Client-side (safe, non-secret only):

| Name | Purpose |
|------|---------|
| `VITE_API_BASE_URL` | Optional. Base path for the Express API; defaults to `/api`. |
| `VITE_USE_MOCKS` | Optional. When enabled, the frontend uses local mock data instead of the network (Phase 1). |

Rules:

- No variable containing a secret may ever start with `VITE_`.
- A `.env.example` file lists names with empty values and is committed. A real `.env` is git-ignored.

---

## 3. Endpoint notes

### 3.1 `POST /webhook/process-document-v2` — temporary path

The upload endpoint is `/webhook/process-document-v2`, **not** `/webhook/process-document`.

**Reason: `/webhook/process-document` is currently occupied by another n8n workflow.** The `-v2` suffix is a temporary workaround, not a versioning scheme and not a semantic API version.

Consequences for the application:

- The n8n path must be defined in exactly one place in the Express server (a single constant or an env-configurable path), never hardcoded in multiple modules and never hardcoded in the frontend.
- The frontend calls the neutral proxy route `/api/process-document`. The `-v2` detail stays server-side.
- When the older workflow is retired and the path is freed, the change is a one-line server edit with no frontend impact.

### 3.2 `GET /webhook/documents`

Returns the full Google Sheet as a JSON array, newest first. Keys are the **human-readable Sheet column names** (`"Received At"`, `"TE Part Number(s)"`, …), including spaces, slashes and parentheses. Field mapping is defined in CONTRACT.md §3.

### 3.3 `POST /webhook/review`

Records a human review decision. n8n owns everything that happens as a result (writing back to Sheets, any notifications). The app sends the request and reports the outcome — nothing else.

---

## 4. Data model (application-facing)

The app normalises Sheet columns into a stable internal object so that a Sheet rename does not ripple through every component. Full mapping table lives in CONTRACT.md §3. Summary of the internal document shape:

`rowNumber, documentId, receivedAt, customer, endCustomer, projectOrProgram, requestType, tePartNumbers, competitorPartNumbers, productFamily, quantity, targetPrice, requiredDelivery, responseDeadline, competitor, summary, requestedAction, responsibleTeam, urgency, strategicOpportunity, fileName, fileLink, status, reviewedBy, reviewNote`

Rules:

- Normalisation happens in **one** module. Components never read raw Sheet keys.
- Every field is treated as **possibly missing or empty string** — Sheets rows are frequently partial. The UI renders a neutral placeholder (e.g. `—`), never `undefined`, `null` or `NaN`.
- `quantity` and `targetPrice` arrive as strings and are kept as strings; they are formatted for display only, never coerced into numbers for logic.
- `documentId` is the identity used for review and for detail routing. `rowNumber` is a Sheet artefact and must not be used as a stable key.

---

## 5. Required functionality

### 5.1 Upload & processing

- Select or drag-and-drop a single document.
- **Supported upload types: PDF, DOCX and TXT** (see §5.1.1). Reject anything else client-side with a clear message naming the accepted types.
- Show file name, type and size before upload; enforce a client-side size ceiling with a clear message.
- Read the file, base64-encode it, and send `file_name`, `mime_type`, `file_base64` to `/api/process-document`.
- Processing is slow (AI extraction + Drive + Sheets + Gmail). The UI must show an explicit **processing state** with progress feedback and a stated expectation that it can take a while. No frozen screen, no silent spinner without context.
- The request must tolerate long response times; a short default timeout is a bug.
- On success show a **result view**: extracted fields, urgency badge, link to the file in Drive, and whether a notification was sent.
- On failure show a readable error and let the user retry without re-selecting the file.

#### 5.1.1 Supported file types

| Type | Extension | MIME type | Upstream status |
|------|-----------|-----------|-----------------|
| PDF | `.pdf` | `application/pdf` | ✅ Verified end-to-end in n8n Workflow A. |
| Word | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ⚠️ Not yet verified upstream. |
| Plain text | `.txt` | `text/plain` | ⚠️ Not yet verified upstream. |

**Known gap — must be closed before final submission:** n8n Workflow A has so far only been verified with **PDF**. DOCX and TXT extraction is unproven upstream, and completing that support is a required deliverable.

Application-side consequences:

- The app accepts all three types now. The gap is upstream, and the app must not compensate for it with its own parsing — that would be reimplementing n8n logic (NG-1).
- The accepted-type list lives in **one** shared constant, used by the file picker `accept` attribute, the drag-and-drop validator and the pre-send check.
- Until DOCX/TXT are verified, the upload UI shows a non-blocking note that those two types are still being validated end-to-end, so a processing failure is legible rather than mysterious.
- A DOCX or TXT upload that fails upstream must surface as a normal readable error (`UPSTREAM_ERROR`), never as a crash or a silent no-op.

### 5.2 Dashboard

- List all documents from `GET /api/documents`, newest first as returned.
- Columns chosen for scanning: received date, customer, request type, product family, urgency, status, responsible team.
- Row click opens the document detail view.
- Refresh control that re-fetches; show when the data was last loaded.

### 5.3 Search & filter

Client-side only, over the already-fetched array:

- Free-text search across customer, end customer, project/program, part numbers, summary and file name.
- Filters: urgency, status, responsible team, request type.
- Filters combine (AND) with search (AND).
- Show the active filter set and a one-click clear.
- Result count is always visible.

### 5.4 Document detail & review

- Full field view for one document, grouped into readable sections (identification, commercial terms, timing, assessment, file, review).
- Link out to the Drive file.
- Review form: status (`Reviewed` / `Needs Review`), reviewer name, review note.
- Submit to `/api/review`; on success reflect the new status in the UI and re-fetch the dashboard so Sheets remains the source of truth.
- Review status values are exactly the two strings above — no other values, no client-invented statuses.

#### 5.4.1 Documents without a Document ID (legacy rows)

`Document ID` is the stable identifier for review. Records created by the current n8n Workflow A always contain it, but **some legacy spreadsheet rows have an empty `Document ID`**.

Rules:

- **The UI must not attempt review for a row without a `Document ID`.** No request is sent — the app does not guess, does not fall back to `row_number`, and does not synthesise an id.
- On such a document's detail view, the review form is not rendered. In its place, a short explanation: this is a legacy record with no Document ID, so it cannot be reviewed from the app.
- The dashboard may mark these rows (e.g. a muted "legacy — not reviewable" indicator) so the state is understandable before opening the row.
- The check is a single derived predicate on the normalised document (a non-empty, trimmed `documentId`), used by every component that offers review — never duplicated inline.
- Legacy rows remain fully visible, searchable and filterable. Only the review action is unavailable.
- If a review request is somehow made for an unknown id, the server returns `DOCUMENT_NOT_FOUND` (404) and the UI shows a readable "no matching document" message with no retry loop (CONTRACT.md §5).

### 5.5 Empty states

Every list and view has a designed empty state, distinct from loading and from error:

- No documents in the Sheet at all → explain and point to upload.
- Search/filters match nothing → explain and offer clear-filters.
- A document with no extracted fields → show the row with placeholders rather than a broken layout.

### 5.6 Error states

Errors must be readable by a non-technical user and useful to a developer:

- Every failure states what failed, in plain language, with a retry where retry is meaningful.
- Distinguish: network unreachable, upload rejected (size/type), n8n returned an error, unexpected response shape, request still running.
- Never show a raw stack trace or a raw upstream payload in the UI.
- **Never surface anything that could contain the API key** — the server strips outbound auth details from any error it returns.

---

## 6. Build phases

Build strictly in this order. Each phase is complete and usable before the next begins.

| Phase | Scope | Done when |
|-------|-------|-----------|
| **1 — Mock data** | Full UI against local mock documents matching the real Sheet shape. Dashboard, search/filter, detail, review form, upload flow with simulated processing, all empty and error states. No network. | Every screen and state can be demonstrated offline. |
| **2 — GET /documents** | Express server + `/api/documents` proxy. Replace mock list with live Sheet data through the normaliser. | Dashboard, search, filter and detail run on real Sheet data. |
| **3 — process-document** | `/api/process-document` proxy to `/webhook/process-document-v2`. Real upload, real processing state, real result view. | A real file can be uploaded and appears on the dashboard after refresh. |
| **4 — review** | `/api/review` proxy. Real review submission and status write-back. | A review recorded in the app is visible in the Sheet. |

Mock data must stay in the repo after Phase 2 so the UI remains developable without n8n access (`VITE_USE_MOCKS`).

---

## 7. Acceptance checklist

- [ ] No API key, token or secret value appears anywhere in the repository.
- [ ] No secret is readable from the built client bundle.
- [ ] No AI, urgency, routing, notification or review business logic exists in app code.
- [ ] No database or authoritative local store was introduced.
- [ ] The `-v2` upload path is defined in exactly one server-side place.
- [ ] All Sheet columns are read through the single normaliser.
- [ ] Missing fields render as placeholders, never `undefined`/`null`/`NaN`.
- [ ] Upload, processing, result, dashboard, search/filter, detail/review, empty and error states all exist.
- [ ] Long-running uploads do not time out prematurely.
- [ ] Errors are readable and never leak upstream internals.
- [ ] The auth header name `x-api-key` is set server-side only; the key value appears nowhere in the repo.
- [ ] PDF, DOCX and TXT are accepted, from a single shared constant.
- [ ] DOCX/TXT verified end-to-end in n8n Workflow A **(required before final submission — open)**.
- [ ] Review is unavailable, with an explanation, for rows with an empty `Document ID`.
- [ ] A review for an unknown `Document ID` renders the 404 case readably.

---

## 8. Open questions

Track here; do not guess in code.

1. Maximum accepted upload size on the n8n side.
2. Whether `GET /webhook/documents` returns `[]` or an object wrapper when the Sheet is empty.
3. Error shape returned by n8n on failure (needed to map to CONTRACT.md §5).
4. Whether `Document ID` is guaranteed **unique** across rows that do have one (population is answered: new records yes, some legacy rows empty — §5.4.1).
5. Timeline for freeing `/webhook/process-document`.

### 8.1 Resolved (2026-09-10, Prompt 2)

| Was | Answer |
|-----|--------|
| Auth header name | `x-api-key` (§2.3). |
| Supported upload types | PDF, DOCX, TXT — PDF verified upstream, DOCX/TXT pending (§5.1.1). |
| `Document ID` population | Present on all new Workflow A records; empty on some legacy rows (§5.4.1). |
| Review of an unknown id | n8n/proxy returns 404 (CONTRACT.md §1.C, §5). |

### 8.2 Carried work items

- **Complete DOCX and TXT support in n8n Workflow A before final submission.** Upstream task, tracked here because the app's accepted-type list depends on it.
