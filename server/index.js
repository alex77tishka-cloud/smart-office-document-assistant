// Smart Office Document Assistant — application proxy.
//
// Single responsibility: authenticate and forward. It holds the n8n API key so
// the browser never has to, and it reshapes upstream failures into a readable
// error contract. It does not cache, transform business meaning, store files or
// persist anything (SPEC.md 2.2).
//
// Phase 2 wired GET /api/documents, Phase 3 POST /api/process-document and
// Phase 4 POST /api/review.
//
// Deployment:
// In production this Express server also serves the React/Vite build from
// ../dist so the application can use one public URL.

import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { N8N_PATHS, readConfig } from './config.js'
import { ERROR_CODES, ProxyError, sendError } from './errors.js'
import { callN8n } from './n8n.js'

const config = readConfig()
const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '../dist')
const indexHtml = path.join(distDir, 'index.html')

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
 */
app.get('/api/documents', async (_req, res) => {
  try {
    const data = await callN8n(config, N8N_PATHS.documents)

    if (Array.isArray(data)) {
      res.json(data)
      return
    }

    if (
      data === null ||
      (data && typeof data === 'object' && Object.keys(data).length === 0)
    ) {
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
 * POST /api/process-document
 * -> POST {N8N_BASE_URL}/webhook/process-document-v2
 */
app.post('/api/process-document', async (req, res) => {
  try {
    const body = req.body ?? {}

    const payload = {
      file_name:
        typeof body.file_name === 'string' ? body.file_name : '',
      mime_type:
        typeof body.mime_type === 'string' ? body.mime_type : '',
      file_base64:
        typeof body.file_base64 === 'string' ? body.file_base64 : '',
    }

    if (payload.file_name === '' || payload.file_base64 === '') {
      throw new ProxyError(
        ERROR_CODES.BAD_REQUEST,
        'The upload was incomplete. Select the file again.',
        'file_name and file_base64 are both required.',
      )
    }

    const data = await callN8n(
      config,
      N8N_PATHS.processDocument,
      {
        method: 'POST',
        body: payload,
        timeoutMs: config.processTimeoutMs,
      },
    )

    if (
      data === null ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
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

// The only two review statuses the Sheet accepts.
const REVIEW_STATUSES = ['Reviewed', 'Needs Review']

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
 */
app.post('/api/review', async (req, res) => {
  try {
    const body = req.body ?? {}

    const payload = {
      document_id:
        typeof body.document_id === 'string' ? body.document_id : '',
      status:
        typeof body.status === 'string' ? body.status : '',
      reviewed_by:
        typeof body.reviewed_by === 'string' ? body.reviewed_by : '',
      review_note:
        typeof body.review_note === 'string' ? body.review_note : '',
    }

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

    const data = await callN8n(
      config,
      N8N_PATHS.review,
      {
        method: 'POST',
        body: payload,
        mapUpstreamError: mapReviewError,
      },
    )

    if (
      data === null ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.success !== true
    ) {
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

// Unknown API routes stay API errors instead of falling through to React.
app.use('/api', (_req, res) => {
  sendError(
    res,
    new ProxyError(
      ERROR_CODES.BAD_REQUEST,
      'Unknown API route.',
    ),
    secrets,
  )
})

// Production: serve the React/Vite build from dist/.
app.use(express.static(distDir))

// React SPA fallback.
// Any non-API GET route is handled by React.
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next()
    return
  }

  res.sendFile(indexHtml, (error) => {
    if (error) next(error)
  })
})

/**
 * Final Express error handler.
 * Handles body-parser errors and any later server errors.
 */
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    logFailure(
      'body parser',
      { code: ERROR_CODES.PAYLOAD_TOO_LARGE },
    )

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
    logFailure(
      'body parser',
      { code: ERROR_CODES.BAD_REQUEST },
    )

    sendError(
      res,
      new ProxyError(
        ERROR_CODES.BAD_REQUEST,
        'The request body was not valid JSON.',
      ),
      secrets,
    )
    return
  }

  logFailure('unhandled', error)
  sendError(res, error, secrets)
})

/** Server-side logging. Never logs the key or a full upstream URL. */
function logFailure(route, error) {
  const code =
    error?.code || ERROR_CODES.INTERNAL_ERROR

  console.error(
    `[proxy] ${route} failed: ${code}`,
  )
}

app.listen(config.port, () => {
  console.log(
    `[proxy] listening on http://localhost:${config.port}`,
  )

  console.log(
    `[proxy] n8n base URL configured: ${config.baseUrl !== ''}`,
  )

  console.log(
    `[proxy] n8n API key configured: ${config.apiKey !== ''}`,
  )

  console.log(
    `[proxy] auth header: ${config.apiKeyHeader}`,
  )

  console.log(
    `[proxy] body limit: ${config.jsonLimit} · read timeout: ${config.timeoutMs}ms · processing timeout: ${config.processTimeoutMs}ms`,
  )

  if (!config.isConfigured) {
    console.warn(
      `[proxy] missing ${config.missing.join(', ')} — n8n-backed routes will return SERVER_MISCONFIGURED until these are set in .env`,
    )
  }
})