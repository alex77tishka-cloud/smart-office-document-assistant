# Smart Office Document Assistant

A web application that wraps an existing n8n document automation. Sales documents (RFQs, technical enquiries, sample requests) are uploaded in the browser, processed by n8n, and tracked and reviewed from a single dashboard.
## Live Deployment

The application is deployed on Render and can be accessed here:

https://smart-office-document-assistant.onrender.com

Note: the application depends on the connected n8n workflows. If the n8n service is unavailable or has reached its usage limit, the UI will still load but backend operations may return an error.





The application is deliberately thin. It does no AI, urgency scoring or notification logic of its own; every business decision belongs to n8n.

| Layer | Role |
|-------|------|
| **React + Vite** frontend | Upload, processing and result views, dashboard, search and filters, document detail, human review. |
| **Node + Express** proxy | Forwards browser requests to n8n and adds the n8n API key server-side. Stores nothing. |
| **n8n** | The automation and business-logic engine: text extraction, AI field extraction, urgency, storage, notifications, review write-back. |
| **Google Sheets** | Single source of truth for every document and its review status. |
| **Google Drive** | Storage for the original uploaded files. |
| **Gmail** | Notifications on processing, with a separate path for urgent documents. |

## Architecture

```
Browser (React + Vite)
   │   same-origin /api/*  — no API key in the browser
   ▼
Express proxy (Node)
   │   adds x-api-key from server-side environment variables
   ▼
n8n production webhooks
   ├── OpenAI        AI field extraction
   ├── Google Drive  file storage, DOCX conversion
   ├── Google Sheets source of truth
   └── Gmail         normal and urgent notifications
```

## Supported document formats

| Format | Extension | How n8n reads it |
|--------|-----------|------------------|
| PDF | `.pdf` | Text extracted directly. |
| Word | `.docx` | Converted to text through Google Drive. |
| Plain text | `.txt` | Read directly. |

All three formats have been successfully tested end-to-end. Other file types are rejected in the browser before anything is sent. The client-side upload limit is 10 MB.

## Features

- **Upload document**: pick a file or drag and drop it; type and size are checked before sending.
- **AI field extraction**: n8n extracts customer, project, part numbers, quantities, prices, dates, summary, requested action and responsible team.
- **Processing result view**: a processing state while n8n works, then the extracted fields, urgency, Drive link and notification status.
- **Document dashboard**: every document from Google Sheets, newest first, with a refresh control.
- **Search and filters**: free-text search plus urgency, status, responsible team and request type filters, all combinable.
- **Document detail view**: every field grouped into readable sections, with a link to the file in Drive.
- **Human review**: mark a document *Reviewed* or *Needs Review*, with reviewer name and note.
- **Review write-back**: reviews are written to Google Sheets by n8n; the dashboard then re-reads the Sheet.
- **Urgency-based email notification**: n8n sends a normal or an urgent Gmail notification depending on the urgency it assigns.

Loading, empty and error states are handled throughout. Errors are shown in plain language with a retry where it makes sense.

## n8n workflows

Exported workflow JSON files are stored in [`workflows/`](workflows/).

| Workflow | File | Purpose |
|----------|------|---------|
| **A: Process Document API** | `Workflow_A_Process_Document_API.json` | Receives a file, extracts text (PDF, DOCX, TXT), extracts fields with AI, stores the file in Drive, appends a Sheet row, sends a normal or urgent Gmail notification, and returns the result. |
| **B: List Documents** | `Workflow_B_List_Documents.json` | Returns all Sheet rows, newest first. |
| **C: Review Document** | `Workflow_C_Review_Document.json` | Finds the row by Document ID and writes the review status, reviewer and note back to the Sheet. |

## API endpoints

The browser calls only the Express proxy. The proxy calls n8n.

| Browser → Express | Express → n8n | Purpose |
|-------------------|---------------|---------|
| `POST /api/process-document` | `POST /webhook/process-document-v2` | Upload and process a document (Workflow A). |
| `GET /api/documents` | `GET /webhook/documents` | List all documents (Workflow B). |
| `POST /api/review` | `POST /webhook/review` | Record a human review (Workflow C). |
| `GET /api/health` | — | Proxy liveness and whether it is configured (booleans only). |

The upload webhook uses the `-v2` path because `/webhook/process-document` is currently held by another n8n workflow. The path is defined in one server-side constant (`server/config.js`), so moving to `/webhook/process-document` is a one-line change with no frontend impact.

Request and response shapes, including the error format, are specified in [CONTRACT.md](CONTRACT.md).

## Security

- The proxy authenticates to every n8n webhook with an **`x-api-key`** header; each webhook is configured with header authentication.
- All secrets live in **environment variables** read by the Express server. No secret appears in source code or documentation.
- **`.env` must never be committed.** It is listed in `.gitignore`; `.env.example` lists variable names only.
- **The browser never receives the n8n API key.** It is not in any `VITE_*` variable or the built bundle, and it is never logged or included in error responses.
- The proxy has no user authentication of its own and is intended for local or trusted-network use.

## Local setup

**Requirements:** Node.js 22.12 or later, and access to the n8n instance hosting the three workflows.

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Purpose |
|----------|---------|
| `N8N_BASE_URL` | Base URL of the n8n instance, no trailing slash. **Server-only.** |
| `N8N_API_KEY` | Key sent to n8n. **Server-only secret.** |
| `N8N_API_KEY_HEADER` | Header name; `x-api-key`. |
| `PORT` | Express port (default `3001`). |
| `N8N_TIMEOUT_MS`, `N8N_PROCESS_TIMEOUT_MS` | Upstream timeouts for reads and for document processing. |
| `MAX_REQUEST_BODY` | Maximum JSON body the proxy accepts (default `20mb`). |
| `VITE_USE_MOCKS` | `false` to use n8n through the proxy; `true` for offline mock data. |

The frontend and proxy can be started together with one command:

```bash
npm run start
```

This starts:
- Express proxy on http://localhost:3001
- Vite development server on http://localhost:5173

Open http://localhost:5173 in the browser. In development Vite forwards `/api` to the proxy, so the browser sees a single origin.

For development, the two processes can also be started separately:

```bash
# Terminal 1: Express proxy
npm run server

# Terminal 2: Vite development server
npm run dev
```

Other scripts: `npm run lint`, `npm run build`.

## Verified end-to-end tests

Run against the live n8n workflows, Google Sheets, Google Drive and Gmail:

| Test | Result |
|------|--------|
| PDF processing | ✅ Passed |
| DOCX conversion and processing | ✅ Passed |
| TXT processing | ✅ Passed |
| Happy path — invoice due tomorrow | ✅ Passed |
| Normal document — internal report | ✅ Passed |
| Missing information — no deadline | ✅ Passed |
| Unsupported file rejected before n8n | ✅ Passed |
| Large file handled with a clear error | ✅ Passed |
| Double submission creates one Sheet row | ✅ Passed |
| n8n unavailable shows a readable error | ✅ Passed |
| Wrong API secret shows an authentication/configuration error | ✅ Passed |
| Urgent notification | ✅ Passed |
| Normal notification | ✅ Passed |
| Dashboard loading and 20+ rows | ✅ Passed |
| Combined dashboard filtering | ✅ Passed |
| Review update to Google Sheets | ✅ Passed |
| Both entry points — web app and Part 1 Google Drive trigger | ✅ Passed |

## Known limitations

- Legacy Sheet rows without a Document ID are shown but cannot be reviewed; Document ID is the only identifier used for review.
- The 10 MB upload limit is a client-side ceiling.
- The upload webhook path carries a temporary `-v2` suffix (see [API endpoints](#api-endpoints)).

## Project documentation

| File | Contents |
|------|----------|
| [SPEC.md](SPEC.md) | Scope, non-goals, architecture, required functionality and build phases. |
| [CONTRACT.md](CONTRACT.md) | Interface contract: n8n webhooks, proxy routes, Sheet column mapping, error codes. |
| [PROMPTS.md](PROMPTS.md) | Log of every Claude Code prompt used to build the project, with results and decisions. |
| [README.md](README.md) | This file. |
| [workflows/](workflows/) | Exported n8n workflow JSON for Workflows A, B and C. |
