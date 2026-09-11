// Error contract (CONTRACT.md 5). The UI switches on `code`, never on message text.

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

// Codes where trying the same request again could plausibly succeed.
const RETRYABLE = new Set([
  ERROR_CODES.UPSTREAM_ERROR,
  ERROR_CODES.UPSTREAM_UNREACHABLE,
  ERROR_CODES.UPSTREAM_TIMEOUT,
  ERROR_CODES.INTERNAL_ERROR,
])

export class ApiError extends Error {
  constructor(code, message, detail = '') {
    super(message)
    this.name = 'ApiError'
    this.code = code in ERROR_CODES ? code : ERROR_CODES.INTERNAL_ERROR
    this.detail = detail
  }

  get retryable() {
    return RETRYABLE.has(this.code)
  }
}

/** Anything thrown by the API layer, presented as a readable ApiError. */
export function toApiError(error) {
  if (error instanceof ApiError) return error
  return new ApiError(
    ERROR_CODES.INTERNAL_ERROR,
    'Something went wrong in the application.',
    error?.message || '',
  )
}
