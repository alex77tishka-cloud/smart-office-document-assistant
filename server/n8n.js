// The only place that talks to n8n. It attaches the API key, applies a timeout,
// and turns every possible failure into the error contract.
//
// The key is attached here and never leaves this function: it is not returned,
// not logged, and not placed in an error detail.

import { ERROR_CODES, ProxyError } from './errors.js'

/** Parses a response body for inspection, or null. Never throws. */
function tryParseJson(text) {
  try {
    return text.trim() === '' ? null : JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * `mapUpstreamError(status, body)` lets a route give a route-specific meaning to
 * an upstream failure (review's 404 is "no such document", not "no such
 * endpoint"). It returns a ProxyError, or nothing to fall through to the
 * generic mapping below.
 */
export async function callN8n(
  config,
  path,
  { method = 'GET', body, timeoutMs = config.timeoutMs, mapUpstreamError } = {},
) {
  if (!config.isConfigured) {
    throw new ProxyError(
      ERROR_CODES.SERVER_MISCONFIGURED,
      'The server is not configured to reach the document service.',
      `Missing environment variable(s): ${config.missing.join(', ')}.`,
    )
  }

  const url = `${config.baseUrl}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        // Server-side only. Never reaches the browser.
        [config.apiKeyHeader]: config.apiKey,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ProxyError(
        ERROR_CODES.UPSTREAM_TIMEOUT,
        'The document service took too long to respond.',
        `No response within ${timeoutMs}ms.`,
      )
    }
    throw new ProxyError(
      ERROR_CODES.UPSTREAM_UNREACHABLE,
      'Could not reach the document service.',
      error?.message || '',
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()

  if (!response.ok) {
    const mapped = mapUpstreamError?.(response.status, tryParseJson(text))
    if (mapped) throw mapped

    if (response.status === 401 || response.status === 403) {
      throw new ProxyError(
        ERROR_CODES.UPSTREAM_UNAUTHORIZED,
        'The document service rejected the request.',
        // Deliberately says nothing about the key itself.
        'Upstream rejected the request. Check the server credentials.',
      )
    }
    if (response.status === 404) {
      throw new ProxyError(
        ERROR_CODES.UPSTREAM_ERROR,
        'The document service endpoint was not found.',
        `Upstream responded ${response.status} for ${path}. Is the n8n workflow active?`,
      )
    }
    throw new ProxyError(
      ERROR_CODES.UPSTREAM_ERROR,
      'The document service returned an error.',
      `Upstream responded ${response.status}.`,
    )
  }

  if (text.trim() === '') return null

  try {
    return JSON.parse(text)
  } catch {
    throw new ProxyError(
      ERROR_CODES.UPSTREAM_BAD_SHAPE,
      'The document service returned an unexpected response.',
      'Response body was not valid JSON.',
    )
  }
}
