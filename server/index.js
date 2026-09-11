// Smart Office Document Assistant — application proxy.
//
// Single responsibility: authenticate and forward. It holds the n8n API key so
// the browser never has to, and it reshapes upstream failures into a readable
// error contract. It does not cache, transform business meaning, store files or
// persist anything (SPEC.md 2.2).
//
// Phase 2 wired GET /api/documents, Phase 3 POST /api/process-document and
// Phase 4 POST /api/review.

import express from 'express'
import { N8N_PATHS, readConfig } from './config.js'
import { ERROR_CODES, ProxyError, sendError } from './errors.js'
import { callN8n } from './n8n.js'

const config = readConfig()
const app = express()

app.disable('x-powered-by')

// Base64 uploads are large, so the JSON limit sits well above the file size the
// UI accepts. The limit is enforced here, before anything reaches n8n.
app.use(express.json({ limit: config.jsonLimit }))

// Values that must never appear in a response body.
const secrets = [config.apiKey]

/** Liveness plus whether the server is configured. Booleans only, no values. */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    n8nConfigured: config.isConfigured,
    missingConfig: config.missing,
    uptimeSeconds: Math.round(process.uptime()),
  })
})

/**
 * GET /api/documents -> GET {N8N_BASE_URL}/webhook/documents
 *
 * The upstream array is passed through verbatim, with the raw Google Sheet
 * column names intact. Normalisation into the internal shape happens in the
 * frontend's single normaliser (CONTRACT.md 2.2).
 */
app.get('/api/documents', async (_req, res) => {
  try {
    const data = await callN8n(config, N8N_PATHS.documents)

    if (Array.isArray(data)) {
      res.json(data)
      return
    }

    // An empty Google Sheet may come back as an empty body or an empty object
    // rather than an empty array (SPEC.md 8, open question). Both mean "no
    // documents", so they are normalised to an empty list rather than failing
    // the dashboard. Anything else is a shape this app does not understand.
    if (data === null || (data && typeof data === 'object' && Object.keys(data).length === 0)) {
      res.json([])
      return
    }

    throw new ProxyError(
      ERROR_CODES.UPSTREAM_BAD_SHAPE,
      'The document list came back in an unexpected format.',
      `Expected an array of rows, received ${typeof data}.`,
    )
  } catch (error) {
    logFailure('GET /api/documents', error)
    sendError(res, error, secrets)
  }
})

/**
 * POST /api/process-document -> POST {N8N_BASE_URL}/webhook/process-document-v2
 *
 * Forwards exactly the three fields the workflow expects and passes the
 * response straight back. The app does no extraction, no urgency scoring and no
 * notification logic — all of that belongs to n8n (SPEC.md NG-1).
 *
 * The upstream path is never written here: it lives only in N8N_PATHS, so
 * freeing /webhook/process-document later is a one-line change.
 */
app.post('/api/process-document', async (req, res) => {
  try {
    const body = req.body ?? {}
    const payload = {
      file_name: typeof body.file_name === 'string' ? body.file_name : '',
      mime_type: typeof body.mime_type === 'string' ? body.mime_type : '',
      file_base64: typeof body.file_base64 === 'string' ? body.file_base64 : '',
    }

    // Transport validation only — is this a well-formed request? Which file
    // types the workflow can actually read is n8n's business, not the proxy's.
    if (payload.file_name === '' || payload.file_base64 === '') {
      throw new ProxyError(
        ERROR_CODES.BAD_REQUEST,
        'The upload was incomplete. Select the file again.',
        'file_name and file_base64 are both required.',
      )
    }

    const data = await callN8n(config, N8N_PATHS.processDocument, {
      method: 'POST',
      body: payload,
      timeoutMs: config.processTimeoutMs,
    })

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new ProxyError(
        ERROR_CODES.UPSTREAM_BAD_SHAPE,
        'The document was sent, but the response could not be read.',
        'Expected a JSON object describing the processed document.',
      )
    }

    res.json(data)
  } catch (error) {
    logFailure('POST /api/process-document', error)
    sendError(res, error, secrets)
  }
})

// The only two review statuses the Sheet accepts (CONTRACT.md 1.C).
const REVIEW_STATUSES = ['Reviewed', 'Needs Review']

/**
 * Review's 404 means "no Sheet row has this Document ID" (CONTRACT.md 1.C) and
 * is detected by status code, not by the error string. The one exception is
 * n8n's own reply for a webhook that is not registered (workflow inactive),
 * which is also a 404 but carries `code`/`message` instead of the contract's
 * `success` field — reporting that as "document not found" would send the user
 * hunting for a missing row when the workflow is simply switched off.
 */
function mapReviewError(status, body) {
  if (status !== 404) return undefined
  const isUnregisteredWebhook =
    body !== null &&
    typeof body === 'object' &&
    !('success' in body) &&
    typeof body.message === 'string'
  if (isUnregisteredWebhook) return undefined
  return new ProxyError(
    ERROR_CODES.DOCUMENT_NOT_FOUND,
    'No matching document was found for this ID, so the review was not saved.',
    'The row may have been changed or removed in the sheet. Refresh the dashboard and open the document again.',
  )
}

/**
 * POST /api/review -> POST {N8N_BASE_URL}/webhook/review
 *
 * Forwards exactly the four contract fields. Document ID is the only
 * identifier — there is no fallback to row_number or file name, so a request
 * without one is rejected here and never reaches n8n. What a review changes in
 * the Sheet (and anything else it triggers) belongs to Workflow C.
 */
app.post('/api/review', async (req, res) => {
  try {
    const body = req.body ?? {}
    const payload = {
      document_id: typeof body.document_id === 'string' ? body.document_id : '',
      status: typeof body.status === 'string' ? body.status : '',
      reviewed_by: typeof body.reviewed_by === 'string' ? body.reviewed_by : '',
      review_note: typeof body.review_note === 'string' ? body.review_note : '',
    }

    // Transport validation only (CONTRACT.md 2.4).
    if (payload.document_id.trim() === '') {
      throw new ProxyError(
        ERROR_CODES.BAD_REQUEST,
        'This document has no Document ID, so it cannot be reviewed.',
        'document_id is required.',
      )
    }
    if (!REVIEW_STATUSES.includes(payload.status)) {
      throw new ProxyError(
        ERROR_CODES.BAD_REQUEST,
        'Select a review status before saving.',
        `status must be one of: ${REVIEW_STATUSES.join(', ')}.`,
      )
    }

    const data = await callN8n(config, N8N_PATHS.review, {
      method: 'POST',
      body: payload,
      mapUpstreamError: mapReviewError,
    })

    // Success is only reported when n8n says so explicitly. Anything else —
    // an empty body, or a 200 without `success: true` — means the write cannot
    // be confirmed, and the UI must not show it as saved.
    if (data === null || typeof data !== 'object' || Array.isArray(data) || data.success !== true) {
      throw new ProxyError(
        ERROR_CODES.UPSTREAM_BAD_SHAPE,
        'The review was sent, but n8n did not confirm it was saved.',
        'Refresh the dashboard to check whether the review was recorded before trying again.',
      )
    }

    res.json(data)
  } catch (error) {
    logFailure('POST /api/review', error)
    sendError(res, error, secrets)
  }
})

app.use('/api', (_req, res) => {
  sendError(
    res,
    new ProxyError(ERROR_CODES.BAD_REQUEST, 'Unknown API route.'),
    secrets,
  )
})

/**
 * Body-parser failures arrive here: a payload over the limit, or malformed
 * JSON. Both become contract errors rather than an Express stack trace.
 */
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    logFailure('body parser', { code: ERROR_CODES.PAYLOAD_TOO_LARGE })
    sendError(
      res,
      new ProxyError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        'That file is too large to upload.',
        `The request exceeded the ${config.jsonLimit} limit.`,
      ),
      secrets,
    )
    return
  }
  if (error?.type === 'entity.parse.failed') {
    logFailure('body parser', { code: ERROR_CODES.BAD_REQUEST })
    sendError(
      res,
      new ProxyError(ERROR_CODES.BAD_REQUEST, 'The request body was not valid JSON.'),
      secrets,
    )
    return
  }
  logFailure('unhandled', error)
  sendError(res, error, secrets)
})

/** Server-side logging. Never logs the key or a full upstream URL. */
function logFailure(route, error) {
  const code = error?.code || ERROR_CODES.INTERNAL_ERROR
  console.error(`[proxy] ${route} failed: ${code}`)
}

app.listen(config.port, () => {
  console.log(`[proxy] listening on http://localhost:${config.port}`)
  console.log(`[proxy] n8n base URL configured: ${config.baseUrl !== ''}`)
  console.log(`[proxy] n8n API key configured: ${config.apiKey !== ''}`)
  console.log(`[proxy] auth header: ${config.apiKeyHeader}`)
  console.log(
    `[proxy] body limit: ${config.jsonLimit} · read timeout: ${config.timeoutMs}ms · processing timeout: ${config.processTimeoutMs}ms`,
  )
  if (!config.isConfigured) {
    console.warn(
      `[proxy] missing ${config.missing.join(', ')} — n8n-backed routes will return SERVER_MISCONFIGURED until these are set in .env`,
    )
  }
})
