// The single normaliser (CONTRACT.md 3). Components read only internal field
// names — never raw Google Sheet column names. Renaming a Sheet column is a
// one-line change in COLUMN_MAP and nowhere else.

export const COLUMN_MAP = {
  receivedAt: 'Received At',
  customer: 'Customer',
  endCustomer: 'End Customer',
  projectOrProgram: 'Project / Program',
  requestType: 'Request Type',
  tePartNumbers: 'TE Part Number(s)',
  competitorPartNumbers: 'Competitor Part Number(s)',
  productFamily: 'Product Family',
  quantity: 'Quantity',
  targetPrice: 'Target Price',
  requiredDelivery: 'Required Delivery',
  responseDeadline: 'Response Deadline',
  competitor: 'Competitor',
  summary: 'Summary',
  requestedAction: 'Requested Action',
  responsibleTeam: 'Responsible Team',
  urgency: 'Urgency',
  strategicOpportunity: 'Strategic Opportunity',
  fileName: 'File Name',
  fileLink: 'File Link',
  status: 'Status',
  documentId: 'Document ID',
  reviewedBy: 'Reviewed By',
  reviewNote: 'Review Note',
}

/** Missing or null becomes an empty string. Values are never trimmed or recased. */
function text(value) {
  return value === undefined || value === null ? '' : String(value)
}

function rowNumberOf(row) {
  const value = row?.row_number
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * A row is reviewable only when it carries a Document ID (CONTRACT.md 3.1).
 * This is a guard on a missing identifier, not business logic. Never fall back
 * to row_number or a synthesised id.
 */
export function isReviewable(documentId) {
  return text(documentId).trim() !== ''
}

/** One raw Sheet row -> the internal document shape. */
export function normalizeDocument(row) {
  const document = { rowNumber: rowNumberOf(row) }
  for (const [field, column] of Object.entries(COLUMN_MAP)) {
    document[field] = text(row?.[column])
  }
  document.isReviewable = isReviewable(document.documentId)
  document.raw = row
  return document
}

export function normalizeDocuments(rows) {
  if (!Array.isArray(rows)) return []
  // Upstream order is newest first and is preserved as-is (CONTRACT.md 1.B).
  return rows.map(normalizeDocument)
}

// Upload response -> internal model (CONTRACT.md 3.2). Note the `status`
// collision: the response `status` is the processing state, not the review state.
const PROCESS_FIELD_MAP = {
  customer: 'customer',
  end_customer: 'endCustomer',
  project_or_program: 'projectOrProgram',
  request_type: 'requestType',
  te_part_numbers: 'tePartNumbers',
  competitor_part_numbers: 'competitorPartNumbers',
  product_family: 'productFamily',
  quantity: 'quantity',
  target_price: 'targetPrice',
  required_delivery: 'requiredDelivery',
  response_deadline: 'responseDeadline',
  competitor: 'competitor',
  summary: 'summary',
  requested_action: 'requestedAction',
  responsible_team: 'responsibleTeam',
  urgency: 'urgency',
  strategic_opportunity: 'strategicOpportunity',
}

export function normalizeProcessResult(response) {
  const result = {
    documentId: text(response?.document_id),
    fileName: text(response?.file_name),
    fileLink: text(response?.file_link),
    receivedAt: text(response?.received_at),
    processingStatus: text(response?.status),
    notificationSent: response?.notification_sent === true,
    // A freshly processed document has no review yet.
    status: '',
    reviewedBy: '',
    reviewNote: '',
    rowNumber: null,
  }
  for (const [key, field] of Object.entries(PROCESS_FIELD_MAP)) {
    result[field] = text(response?.fields?.[key])
  }
  result.isReviewable = isReviewable(result.documentId)
  return result
}

/**
 * Review response -> the review that was recorded (CONTRACT.md 1.C).
 *
 * Called only after n8n has confirmed the write. The echoed values are what
 * n8n says it recorded, so they win; a field missing from the echo falls back
 * to what was sent. The Document ID is always the one that was sent — it is
 * the identity the UI already holds for this row.
 */
export function normalizeReviewResult(response, sent) {
  const echoed = (key) =>
    typeof response?.[key] === 'string' ? response[key] : text(sent?.[key])
  return {
    documentId: text(sent?.document_id),
    status: echoed('status'),
    reviewedBy: echoed('reviewed_by'),
    reviewNote: echoed('review_note'),
  }
}
