// Applying a recorded review to local application state.
//
// One place decides how a review lands on a document, and one place decides
// how two Document IDs are compared. Sheet values routinely carry stray
// whitespace, and the API layer trims the id it sends, so an untrimmed
// comparison here would silently fail to match — the review would be recorded
// upstream while the UI showed the old status until the next manual refresh.

/**
 * True when both ids identify the same document. An empty id never matches:
 * legacy rows without a Document ID are not reviewable (SPEC.md 5.4.1).
 */
export function sameDocumentId(left, right) {
  const a = (left || '').trim()
  const b = (right || '').trim()
  return a !== '' && a === b
}

/**
 * Returns a new document list with the reviewed document updated.
 *
 * Applied only after the review is confirmed. In mock mode this local update is
 * the visible result of a review. In live mode n8n has already written to
 * Google Sheets, and this is the immediate echo shown until the re-read of the
 * source of truth lands.
 */
export function applyReviewToDocuments(documents, review) {
  if (!Array.isArray(documents)) return []
  return documents.map((item) =>
    sameDocumentId(item.documentId, review?.documentId)
      ? {
          ...item,
          status: review.status,
          reviewedBy: review.reviewedBy,
          reviewNote: review.reviewNote,
        }
      : item,
  )
}
