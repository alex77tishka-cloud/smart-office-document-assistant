# CONTRACT.md — Interface Contract

Status: draft v1.1 — contract only, nothing implemented yet.
Last updated: 2026-09-10 (Prompt 2: `x-api-key` header, accepted MIME types, review 404, `isReviewable`)

Defines the three interfaces of the application layer:

1. **n8n → Express** — the existing production webhooks (fixed, we do not change them).
2. **Express → Browser** — the proxy routes the frontend is allowed to call.
3. **Sheet columns → internal model** — the single normalisation table.

No secret values appear in this document. Environment variables are referred to by name only.

---

## 1. Upstream: n8n production webhooks

Base URL: `N8N_BASE_URL` (env var, server-side).
Auth: the value of `N8N_API_KEY` sent in the header **`x-api-key`** (configurable via `N8N_API_KEY_HEADER`, which defaults to `x-api-key`). **Server-side only. Never in browser code, never in `VITE_*`.**

```
x-api-key: <value of N8N_API_KEY>      # server-side only; the value never appears in this repo
```

The header is attached by the Express proxy to all three upstream calls below. It is never forwarded back to the browser, never logged, and never included in an error `detail`.

### 1.A `POST {N8N_BASE_URL}/webhook/process-document-v2`

Upload and process one document.

Request:

```json
{
  "file_name": "string",
  "mime_type": "string",
  "file_base64": "string"
}
```

Response:

```json
{
  "status": "processed",
  "document_id": "string",
  "file_name": "string",
  "file_link": "string",
  "received_at": "string",
  "fields": {
    "customer": "string",
    "end_customer": "string",
    "project_or_program": "string",
    "request_type": "string",
    "te_part_numbers": "string",
    "competitor_part_numbers": "string",
    "product_family": "string",
    "quantity": "string",
    "target_price": "string",
    "required_delivery": "string",
    "response_deadline": "string",
    "competitor": "string",
    "summary": "string",
    "requested_action": "string",
    "responsible_team": "string",
    "urgency": "string",
    "strategic_opportunity": "string"
  },
  "notification_sent": true
}
```

Accepted `mime_type` values:

| Type | Extension | `mime_type` | Upstream status |
|------|-----------|-------------|-----------------|
| PDF | `.pdf` | `application/pdf` | ✅ Verified in n8n Workflow A. |
| Word | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ⚠️ Not yet verified. |
| Plain text | `.txt` | `text/plain` | ⚠️ Not yet verified. |

Notes:

- `-v2` is **temporary**: `/webhook/process-document` is occupied by another n8n workflow (SPEC.md §3.1). Declare the path once, server-side.
- Slow by design (AI + Drive + Sheets + Gmail). Client and server timeouts must accommodate a long call.
- Every value inside `fields` may be an empty string.
- **DOCX and TXT are contractually supported but not yet proven upstream** — Workflow A has only been verified with PDF, and completing DOCX/TXT is required before final submission (SPEC.md §5.1.1). Until then, a DOCX/TXT upload may fail upstream; the app surfaces that as `UPSTREAM_ERROR` and never substitutes its own parsing.
- The accepted-type list is one shared constant in the app; the table above is its source of truth.

### 1.B `GET {N8N_BASE_URL}/webhook/documents`

Returns all processed documents from Google Sheets as a JSON array, **newest first**. The app preserves that order and does not re-sort by default.

Keys are the literal Google Sheet column names:

```
row_number, Received At, Customer, End Customer, Project / Program,
Request Type, TE Part Number(s), Competitor Part Number(s), Product Family,
Quantity, Target Price, Required Delivery, Response Deadline, Competitor,
Summary, Requested Action, Responsible Team, Urgency, Strategic Opportunity,
File Name, File Link, Status, Document ID, Reviewed By, Review Note
```

Notes:

- Column names contain spaces, slashes and parentheses — always bracket-access, never dot-access.
- Rows are frequently partial; any column may be missing or empty.
- Google Sheets is the single source of truth. The app never writes to it directly.

### 1.C `POST {N8N_BASE_URL}/webhook/review`

Record a human review.

Request:

```json
{
  "document_id": "string",
  "status": "Reviewed",
  "reviewed_by": "string",
  "review_note": "string"
}
```

`status` is exactly `"Reviewed"` or `"Needs Review"` — no other values.

Success response (`200`):

```json
{
  "success": true,
  "document_id": "string",
  "status": "string",
  "reviewed_by": "string",
  "review_note": "string"
}
```

**Not found (`404`)** — no Sheet row matches the supplied `document_id`:

```json
{
  "success": false,
  "error": "document_not_found",
  "document_id": "string"
}
```

Rules for the 404 case:

- A 404 means the review was **not** recorded. The UI must not show success, must not optimistically update the row, and must not auto-retry — the same id will fail again.
- The proxy maps it to `DOCUMENT_NOT_FOUND` / HTTP 404 (§5) with a readable message ("no matching document was found for this ID").
- Most likely causes: a legacy row with an empty `Document ID` (§3.1, SPEC.md §5.4.1), or a row deleted from the Sheet since the dashboard was loaded. The UI's suggested action is to refresh the dashboard.
- If n8n returns a different body for this case, this section is updated first — the proxy detects the 404 by **status code**, not by parsing the error string.

n8n owns all consequences of the review (Sheet write-back, any notifications). The app only sends and reports.

---

## 2. Downstream: Express → Browser

Base path: `/api` (frontend override: `VITE_API_BASE_URL`). All requests and responses are JSON. The browser never talks to n8n directly and never sees an auth header.

| App route | Method | Proxies to | Purpose |
|-----------|--------|-----------|---------|
| `/api/health` | GET | — | Liveness + whether required env vars are present (booleans only, never values). |
| `/api/documents` | GET | `GET /webhook/documents` | Dashboard data. |
| `/api/process-document` | POST | `POST /webhook/process-document-v2` | Upload & process. |
| `/api/review` | POST | `POST /webhook/review` | Record a review. |

Rules:

- The proxy passes payloads through unchanged. It does not rename, enrich, score, filter or reorder business data.
- The `-v2` upstream path never appears in a frontend route name.
- The proxy strips outbound auth details from anything it returns.
- Request body limit must be raised to allow base64 uploads.

### 2.1 `GET /api/health`

```json
{ "ok": true, "n8nConfigured": true, "uptimeSeconds": 0 }
```

Never returns the key, the header name's value, or the base URL's credentials.

### 2.2 `GET /api/documents`

Returns the upstream array verbatim (raw Sheet column names). Normalisation into the internal model happens in the frontend, in one module (§3).

### 2.3 `POST /api/process-document`

Request body identical to §1.A. Response body identical to §1.A.

Client-side pre-checks before sending: non-empty file, size under the configured ceiling, `file_name` and `mime_type` present, `file_base64` is base64 **without** a `data:` URI prefix.

### 2.4 `POST /api/review`

Request and response identical to §1.C, including the 404 case. The server validates only that `document_id` is non-empty and `status` is one of the two allowed strings — this is transport validation, not business logic.

| Outcome | HTTP | Body |
|---------|------|------|
| Recorded | 200 | §1.C success body, passed through. |
| `document_id` empty or `status` not one of the two allowed strings | 400 | `BAD_REQUEST` (§5). |
| Upstream reports no matching row | 404 | `DOCUMENT_NOT_FOUND` (§5). |
| Upstream 404 that is n8n's own "webhook not registered" reply (body has `message`, no `success`) — workflow inactive | 502 | `UPSTREAM_ERROR` (§5). Not reported as a missing document. |
| Upstream 200 without `success: true` (empty body, `{}`, `success: false`) | 502 | `UPSTREAM_BAD_SHAPE` (§5). The write cannot be confirmed, so the UI does not show it as saved. |
| Upstream failure / unreachable / timeout | 502 / 503 / 504 | §5. |

The frontend must not send a review at all for a document with an empty `documentId` — the 400/404 paths are a safety net, not the intended flow (SPEC.md §5.4.1).

---

## 3. Sheet column → internal model

Applied once, in a single normaliser module. Components read only the right-hand column.

| Google Sheet column | Internal field | Type | Notes |
|---------------------|----------------|------|-------|
| `row_number` | `rowNumber` | number\|null | Sheet artefact. **Never a React key or identity.** |
| `Received At` | `receivedAt` | string | Raw upstream string; formatted for display only. |
| `Customer` | `customer` | string | |
| `End Customer` | `endCustomer` | string | |
| `Project / Program` | `projectOrProgram` | string | Note the spaces around `/`. |
| `Request Type` | `requestType` | string | Filter facet. |
| `TE Part Number(s)` | `tePartNumbers` | string | Searchable. |
| `Competitor Part Number(s)` | `competitorPartNumbers` | string | Searchable. |
| `Product Family` | `productFamily` | string | Filter facet. |
| `Quantity` | `quantity` | string | Kept as string. |
| `Target Price` | `targetPrice` | string | Kept as string. |
| `Required Delivery` | `requiredDelivery` | string | |
| `Response Deadline` | `responseDeadline` | string | |
| `Competitor` | `competitor` | string | |
| `Summary` | `summary` | string | Searchable. |
| `Requested Action` | `requestedAction` | string | |
| `Responsible Team` | `responsibleTeam` | string | Filter facet. |
| `Urgency` | `urgency` | string | Filter facet + badge colour. Value comes from n8n; the app never computes it. |
| `Strategic Opportunity` | `strategicOpportunity` | string | |
| `File Name` | `fileName` | string | Searchable. |
| `File Link` | `fileLink` | string | External Drive URL. |
| `Status` | `status` | string | Review status. |
| `Document ID` | `documentId` | string | **Identity** for detail routing and review. Always present on new Workflow A records; **empty on some legacy rows** — see §3.1. |
| `Reviewed By` | `reviewedBy` | string | |
| `Review Note` | `reviewNote` | string | |

### 3.1 Normalisation rules

- Missing or `null` → empty string (`rowNumber` → `null`).
- No trimming or casing changes to values; display formatting is a separate presentation concern.
- Unknown extra columns are ignored, not dropped from the raw object — the normaliser may keep the original row under a `raw` key for debugging.
- Renaming a Sheet column is a one-line change in this table and in the normaliser. Nowhere else.

**Reviewability.** The normaliser derives one extra presentation-level flag:

| Derived field | Rule |
|---------------|------|
| `isReviewable` | `true` when `documentId` is a non-empty string after trimming; otherwise `false`. |

This is not business logic — it is a guard on a missing identifier. Every component that offers review reads this flag; none re-derives it inline, and none falls back to `row_number` or a synthesised id. Non-reviewable rows stay fully visible, searchable and filterable (SPEC.md §5.4.1).

### 3.2 process-document → internal model

The upload response uses snake_case `fields`, not Sheet column names. Mapping:

| Response path | Internal field |
|---------------|----------------|
| `document_id` | `documentId` |
| `file_name` | `fileName` |
| `file_link` | `fileLink` |
| `received_at` | `receivedAt` |
| `status` | processing status (`"processed"`), **not** the review `status` column |
| `notification_sent` | `notificationSent` |
| `fields.customer` | `customer` |
| `fields.end_customer` | `endCustomer` |
| `fields.project_or_program` | `projectOrProgram` |
| `fields.request_type` | `requestType` |
| `fields.te_part_numbers` | `tePartNumbers` |
| `fields.competitor_part_numbers` | `competitorPartNumbers` |
| `fields.product_family` | `productFamily` |
| `fields.quantity` | `quantity` |
| `fields.target_price` | `targetPrice` |
| `fields.required_delivery` | `requiredDelivery` |
| `fields.response_deadline` | `responseDeadline` |
| `fields.competitor` | `competitor` |
| `fields.summary` | `summary` |
| `fields.requested_action` | `requestedAction` |
| `fields.responsible_team` | `responsibleTeam` |
| `fields.urgency` | `urgency` |
| `fields.strategic_opportunity` | `strategicOpportunity` |

⚠️ **Name collision:** `status` means *processing state* in the upload response and *review state* in the Sheet. Keep them separate in the internal model (`processingStatus` vs `status`).

---

## 4. Frontend API layer

- One module owns all HTTP calls: `getDocuments()`, `processDocument()`, `submitReview()`.
- Components never call `fetch` directly and never construct n8n URLs.
- When `VITE_USE_MOCKS` is enabled, the same three functions resolve from local mock data with the same shapes and the same latency/error behaviour — swapping mocks for live must require no component change.

---

## 5. Error contract

Every failed proxy call returns this shape with an appropriate HTTP status:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "detail": "string"
  }
}
```

| `code` | When | HTTP |
|--------|------|------|
| `BAD_REQUEST` | Client payload failed transport validation. | 400 |
| `DOCUMENT_NOT_FOUND` | `POST /api/review` — no Sheet row matches `document_id`. Not retryable with the same id; suggest refreshing the dashboard. | 404 |
| `PAYLOAD_TOO_LARGE` | Upload exceeds the configured limit. | 413 |
| `UPSTREAM_UNAUTHORIZED` | n8n rejected the key. Message says "upstream rejected the request" — **never echoes the key**. | 502 |
| `UPSTREAM_ERROR` | n8n returned a non-2xx. | 502 |
| `UPSTREAM_UNREACHABLE` | Network failure reaching n8n. | 503 |
| `UPSTREAM_TIMEOUT` | n8n did not respond in time. | 504 |
| `UPSTREAM_BAD_SHAPE` | n8n responded 2xx with an unusable body. | 502 |
| `SERVER_MISCONFIGURED` | Required env var missing at startup. | 500 |
| `INTERNAL_ERROR` | Anything else. | 500 |

Rules:

- `message` is user-readable plain language. `detail` is developer-oriented and **sanitised**: no auth headers, no key fragments, no full upstream URLs with credentials.
- Raw upstream bodies and stack traces are logged server-side only, never returned.
- The frontend maps `code` to a UI state (retryable vs not) — it does not parse `message` strings.

---

## 6. Contract stability

Changes to any interface above must be reflected here **before** code changes, and the corresponding prompt/result recorded in PROMPTS.md.

Fixed points of the contract:

1. Google Sheets is the single source of truth.
2. n8n owns all business logic.
3. The API key exists only on the server, only as an environment variable.
4. The frontend knows only `/api/*` routes, never n8n paths.
5. The auth header is `x-api-key`, attached server-side only.
6. `Document ID` is the only identifier accepted for review; a row without one is not reviewable.
