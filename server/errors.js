// Error contract (CONTRACT.md 5). Every failure leaves this server in the same
// shape: { error: { code, message, detail } }.

export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UPSTREAM_UNAUTHORIZED: 'UPSTREAM_UNAUTHORIZED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  UPSTREAM_UNREACHABLE: 'UPSTREAM_UNREACHABLE',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  UPSTREAM_BAD_SHAPE: 'UPSTREAM_BAD_SHAPE',
  SERVER_MISCONFIGURED: 'SERVER_MISCONFIGURED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
}

const STATUS_BY_CODE = {
  [ERROR_CODES.BAD_REQUEST]: 400,
  [ERROR_CODES.DOCUMENT_NOT_FOUND]: 404,
  [ERROR_CODES.PAYLOAD_TOO_LARGE]: 413,
  [ERROR_CODES.UPSTREAM_UNAUTHORIZED]: 502,
  [ERROR_CODES.UPSTREAM_ERROR]: 502,
  [ERROR_CODES.UPSTREAM_UNREACHABLE]: 503,
  [ERROR_CODES.UPSTREAM_TIMEOUT]: 504,
  [ERROR_CODES.UPSTREAM_BAD_SHAPE]: 502,
  [ERROR_CODES.SERVER_MISCONFIGURED]: 500,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
}

export class ProxyError extends Error {
  constructor(code, message, detail = '') {
    super(message)
    this.name = 'ProxyError'
    this.code = code in STATUS_BY_CODE ? code : ERROR_CODES.INTERNAL_ERROR
    this.detail = detail
    this.status = STATUS_BY_CODE[this.code]
  }
}

/**
 * Removes anything credential-shaped from text that is about to leave the
 * server. Belt and braces: nothing here should ever contain a key, but a
 * sanitiser is cheaper than trusting every future call site.
 */
export function sanitize(text, secrets = []) {
  let output = String(text ?? '')
  for (const secret of secrets) {
    if (secret && secret.length > 3) {
      output = output.split(secret).join('[redacted]')
    }
  }
  return output
    .replace(/(api[-_]?key["'\s:=]+)[^\s"',}]+/gi, '$1[redacted]')
    .replace(/(authorization["'\s:=]+)[^\s"',}]+/gi, '$1[redacted]')
    .replace(/\/\/[^/@\s]+:[^/@\s]+@/g, '//[redacted]@')
    .slice(0, 400)
}

export function sendError(res, error, secrets = []) {
  const proxyError =
    error instanceof ProxyError
      ? error
      : new ProxyError(
          ERROR_CODES.INTERNAL_ERROR,
          'Something went wrong on the server.',
          error?.message || '',
        )

  res.status(proxyError.status).json({
    error: {
      code: proxyError.code,
      message: proxyError.message,
      detail: sanitize(proxyError.detail, secrets),
    },
  })
}
