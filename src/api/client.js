// The only module that performs API calls. Components never call fetch and
// never construct n8n URLs (CONTRACT.md 4).
//
// With mocks on, every call resolves from local mock data. With mocks off,
// every call goes to the Express proxy: GET /api/documents,
// POST /api/process-document and POST /api/review.

import { ApiError, ERROR_CODES, toApiError } from './errors.js'
import {
  mockGetDocuments,
  mockProcessDocument,
  mockSubmitReview,
} from './mock.js'
import {
  normalizeDocuments,
  normalizeProcessResult,
  normalizeReviewResult,
} from './normalize.js'
import {
  MAX_UPLOAD_BYTES,
  matchAcceptedType,
  ACCEPTED_FILE_TYPES,
} from '../constants/uploads.js'

// Mocks stay available so the UI can be developed without n8n access. Set
// VITE_USE_MOCKS=false to run against the Express proxy.
export const USE_MOCKS =
  String(import.meta.env.VITE_USE_MOCKS ?? 'true').toLowerCase() !== 'false'

// Same-origin path served by the Express proxy. The browser never knows an n8n
// URL, and never holds the API key (CONTRACT.md 2).
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

export const REVIEW_STATUSES = ['Reviewed', 'Needs Review']

// Processing runs AI extraction, a Drive upload, a Sheets write and a
// notification. The client waits slightly longer than the server's own upstream
// timeout, so a slow workflow surfaces as the server's readable timeout error
// rather than the browser giving up first.
const PROCESS_TIMEOUT_MS = 190000

// A review is a Sheet lookup and a write. Same reasoning as above: slightly
// longer than the server's default 30s upstream timeout.
const REVIEW_TIMEOUT_MS = 35000

/**
 * One request path for every proxy call: sends JSON, reads the error contract
 * back, and turns anything unexpected into a readable ApiError.
 */
async function request(path, { method = 'GET', body, timeoutMs = 30000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError(
        ERROR_CODES.UPSTREAM_TIMEOUT,
        'The request took too long. Try again.',
      )
    }
    throw new ApiError(
      ERROR_CODES.UPSTREAM_UNREACHABLE,
      'Could not reach the application server.',
      'Is the Express server running?',
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  let payload = null
  if (text.trim() !== '') {
    try {
      payload = JSON.parse(text)
    } catch {
      // A non-JSON failure (an HTML error page) is handled with the other
      // non-contract failures below.
      if (response.ok) {
        throw new ApiError(
          ERROR_CODES.UPSTREAM_BAD_SHAPE,
          'The server returned an unexpected response.',
        )
      }
    }
  }

  if (!response.ok) {
    const failure = payload?.error
    // Express always answers with the error contract. A failure without one
    // came from something in front of it — typically the Vite dev proxy
    // replying 502 with an empty body because the Express server is down.
    if (!failure) {
      throw new ApiError(
        ERROR_CODES.UPSTREAM_UNREACHABLE,
        'Could not reach the application server.',
        `Received ${response.status} without an error body. Is the Express server running?`,
      )
    }
    throw new ApiError(
      failure?.code || ERROR_CODES.INTERNAL_ERROR,
      failure?.message || 'The request failed.',
      failure?.detail || '',
    )
  }

  return payload
}

/**
 * Dashboard data. Returns normalised documents, newest first as returned.
 *
 * Live mode reads the raw Google Sheet rows the proxy passes through, then maps
 * them with the same normaliser the mocks go through — the shape reaching the
 * UI is identical either way.
 */
export async function getDocuments() {
  try {
    const rows = USE_MOCKS
      ? await mockGetDocuments()
      : await request('/documents')
    return normalizeDocuments(rows)
  } catch (error) {
    throw toApiError(error)
  }
}

/**
 * Upload and process one document.
 * @param {{fileName: string, mimeType: string, fileBase64: string, size: number}} input
 */
export async function processDocument(input) {
  try {
    const payload = {
      file_name: input?.fileName || '',
      mime_type: input?.mimeType || '',
      file_base64: input?.fileBase64 || '',
    }

    // Transport-level pre-checks (CONTRACT.md 2.3).
    if (!payload.file_name || !payload.file_base64) {
      throw new ApiError(
        ERROR_CODES.BAD_REQUEST,
        'The file could not be read. Select it again.',
      )
    }
    if (!matchAcceptedType({ name: payload.file_name, type: payload.mime_type })) {
      const accepted = ACCEPTED_FILE_TYPES.map((type) => type.extension).join(', ')
      throw new ApiError(
        ERROR_CODES.BAD_REQUEST,
        `That file type is not supported. Accepted types: ${accepted}.`,
      )
    }
    if (input?.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        'That file is too large to upload.',
      )
    }

    const response = USE_MOCKS
      ? await mockProcessDocument(payload)
      : await request('/process-document', {
          method: 'POST',
          body: payload,
          timeoutMs: PROCESS_TIMEOUT_MS,
        })
    return normalizeProcessResult(response)
  } catch (error) {
    throw toApiError(error)
  }
}

/**
 * Record a human review. Resolves only once the write is confirmed — by n8n in
 * live mode — with the recorded review in the internal shape:
 * `{documentId, status, reviewedBy, reviewNote}`. Any failure throws, and
 * nothing has been recorded that the UI should show.
 * @param {{documentId: string, status: string, reviewedBy: string, reviewNote: string}} input
 */
export async function submitReview(input) {
  try {
    const payload = {
      document_id: (input?.documentId || '').trim(),
      status: input?.status || '',
      reviewed_by: input?.reviewedBy || '',
      review_note: input?.reviewNote || '',
    }

    // A document with no Document ID is never reviewed (SPEC.md 5.4.1). This is
    // a safety net — the UI does not offer review for those rows at all.
    if (!payload.document_id) {
      throw new ApiError(
        ERROR_CODES.BAD_REQUEST,
        'This document has no Document ID, so it cannot be reviewed.',
      )
    }
    if (!REVIEW_STATUSES.includes(payload.status)) {
      throw new ApiError(
        ERROR_CODES.BAD_REQUEST,
        'Select a review status before submitting.',
      )
    }

    const response = USE_MOCKS
      ? await mockSubmitReview(payload)
      : await request('/review', {
          method: 'POST',
          body: payload,
          timeoutMs: REVIEW_TIMEOUT_MS,
        })
    return normalizeReviewResult(response, payload)
  } catch (error) {
    throw toApiError(error)
  }
}
