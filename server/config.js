// Server configuration, read from environment variables at startup.
//
// The n8n API key exists here and nowhere else. It is never sent to the
// browser, never written to a log line, and never included in an error body.

/** Upstream n8n paths. Declared once, server-side only (CONTRACT.md 1). */
export const N8N_PATHS = {
  // Phase 2 — Workflow B.
  documents: '/webhook/documents',
  // Phase 3 — Workflow A. The `-v2` suffix is temporary: /webhook/process-document
  // is occupied by another n8n workflow (SPEC.md 3.1). This constant is the one
  // place that path is written down.
  processDocument: '/webhook/process-document-v2',
  // Phase 4 — Workflow C.
  review: '/webhook/review',
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

export function readConfig(env = process.env) {
  const baseUrl = trimTrailingSlash((env.N8N_BASE_URL || '').trim())
  const apiKey = (env.N8N_API_KEY || '').trim()
  // Confirmed header name; overridable without a code change.
  const apiKeyHeader = (env.N8N_API_KEY_HEADER || 'x-api-key').trim()
  const port = Number(env.PORT || 3001)
  const timeoutMs = Number(env.N8N_TIMEOUT_MS || 30000)
  // Document processing runs AI extraction, a Drive upload, a Sheets write and
  // a notification, so it needs far longer than a plain read.
  const processTimeoutMs = Number(env.N8N_PROCESS_TIMEOUT_MS || 180000)
  // Base64 inflates a file by roughly a third, so the JSON limit has to sit
  // well above the largest file the UI will accept.
  const jsonLimit = (env.MAX_REQUEST_BODY || '20mb').trim()

  return {
    baseUrl,
    apiKey,
    apiKeyHeader,
    port: Number.isFinite(port) ? port : 3001,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
    processTimeoutMs: Number.isFinite(processTimeoutMs) ? processTimeoutMs : 180000,
    jsonLimit,
    get isConfigured() {
      return baseUrl !== '' && apiKey !== ''
    },
    /** Which required variables are missing — names only, never values. */
    get missing() {
      const missing = []
      if (baseUrl === '') missing.push('N8N_BASE_URL')
      if (apiKey === '') missing.push('N8N_API_KEY')
      return missing
    },
  }
}
