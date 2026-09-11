// Presentation-only helpers. These change how a value looks, never what it means.

export const PLACEHOLDER = '—'

/** Every field may be missing or empty; never render undefined/null/NaN. */
export function display(value) {
  const text = value === undefined || value === null ? '' : String(value)
  return text.trim() === '' ? PLACEHOLDER : text
}

export function isBlank(value) {
  return display(value) === PLACEHOLDER
}

// Matches the date and time of an ISO-8601-ish timestamp, whatever follows it:
// seconds, fractional seconds, "Z", or a "+03:00" style offset. Not anchored,
// because some sheet rows carry a label before the value.
const TIMESTAMP = /(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/

/**
 * Formats a timestamp for display as `YYYY-MM-DD HH:mm`.
 *
 * Display only — the underlying value is never changed, and nothing here is
 * used for ordering (the list keeps the order n8n returned).
 *
 * The date and time components are taken verbatim from the string rather than
 * parsed into a Date, so the wall-clock time recorded in the sheet is what the
 * reader sees. Parsing would re-express it in the viewer's own timezone and
 * silently show a different time than the record holds.
 *
 * Anything that is not a timestamp — a plain `YYYY-MM-DD` delivery date, or an
 * unexpected format — is passed through untouched rather than mangled.
 */
export function displayDate(value) {
  const text = display(value)
  if (text === PLACEHOLDER) return text

  const match = text.trim().match(TIMESTAMP)
  return match ? `${match[1]} ${match[2]}:${match[3]}` : text
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return PLACEHOLDER
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`
}

export function formatClockTime(date) {
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Stable key for UI selection and React lists. Document ID is the real
 * identity; legacy rows have none, so the Sheet row number stands in for
 * list/selection purposes only. This value is never sent upstream.
 */
export function documentKey(document) {
  const id = (document?.documentId || '').trim()
  if (id) return id
  return `row-${document?.rowNumber ?? 'unknown'}`
}
