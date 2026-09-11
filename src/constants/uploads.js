// Single source of truth for accepted upload types (SPEC.md 5.1.1, CONTRACT.md 1.A).
// Used by the file input `accept` attribute, the drag-and-drop validator and the
// pre-send check. Do not duplicate this list anywhere else.

export const ACCEPTED_FILE_TYPES = [
  {
    label: 'PDF',
    extension: '.pdf',
    mimeType: 'application/pdf',
    // Verified end-to-end in n8n Workflow A.
    verifiedUpstream: true,
  },
  {
    label: 'Word',
    extension: '.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Accepted by the app; not yet verified upstream (SPEC.md 8.2).
    verifiedUpstream: false,
  },
  {
    label: 'Plain text',
    extension: '.txt',
    mimeType: 'text/plain',
    verifiedUpstream: false,
  },
]

// Extensions only: `.pdf,.docx,.txt`. The native picker filters by extension,
// and listing each type a second time as a MIME type lets browsers build
// overlapping filters from the mix, which can leave only the first type
// selectable. MIME types are still checked by matchAcceptedType below, which is
// what actually accepts or rejects a file — the picker is only a convenience.
export const ACCEPT_ATTRIBUTE = ACCEPTED_FILE_TYPES.map(
  (type) => type.extension,
).join(',')

export const UNVERIFIED_TYPE_LABELS = ACCEPTED_FILE_TYPES.filter(
  (type) => !type.verifiedUpstream,
).map((type) => type.extension.replace('.', '').toUpperCase())

// Client-side ceiling only. The real n8n limit is still an open question
// (SPEC.md 8) — revisit before Phase 3.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * Matches a File against the accepted list. Browsers report an empty or wrong
 * `type` for .docx and .txt often enough that the extension is checked too.
 */
export function matchAcceptedType(file) {
  if (!file) return null
  const name = (file.name || '').toLowerCase()
  return (
    ACCEPTED_FILE_TYPES.find(
      (type) =>
        file.type === type.mimeType || name.endsWith(type.extension),
    ) || null
  )
}
