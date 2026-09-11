// Client-side search and filtering over the already-fetched array (SPEC.md 5.3).
// Presentation only: nothing here changes the meaning of a document.

// Fields covered by free-text search.
const SEARCH_FIELDS = [
  'customer',
  'endCustomer',
  'projectOrProgram',
  'tePartNumbers',
  'competitorPartNumbers',
  'summary',
  'fileName',
]

export const FILTER_FIELDS = [
  { key: 'urgency', label: 'Urgency' },
  { key: 'status', label: 'Status' },
  { key: 'responsibleTeam', label: 'Responsible team' },
  { key: 'requestType', label: 'Request type' },
]

export const EMPTY_FILTERS = {
  urgency: '',
  status: '',
  responsibleTeam: '',
  requestType: '',
}

// Urgency has a meaningful order; other facets are alphabetical.
const URGENCY_ORDER = ['High', 'Medium', 'Low']

/** Distinct non-empty values per filter field, drawn from the loaded documents. */
export function buildFacets(documents) {
  const facets = {}
  for (const field of FILTER_FIELDS) {
    const values = new Set()
    for (const document of documents) {
      const value = (document[field.key] || '').trim()
      if (value) values.add(value)
    }
    const list = [...values]
    facets[field.key] =
      field.key === 'urgency'
        ? list.sort(
            (a, b) =>
              (URGENCY_ORDER.indexOf(a) + 1 || 99) -
              (URGENCY_ORDER.indexOf(b) + 1 || 99),
          )
        : list.sort((a, b) => a.localeCompare(b))
  }
  return facets
}

export function hasActiveFilters(filters, search) {
  return (
    (search || '').trim() !== '' ||
    Object.values(filters).some((value) => value !== '')
  )
}

export function countActiveFilters(filters) {
  return Object.values(filters).filter((value) => value !== '').length
}

/** Filters combine with AND, and with search with AND. Upstream order is kept. */
export function filterDocuments(documents, filters, search) {
  const query = (search || '').trim().toLowerCase()

  return documents.filter((document) => {
    for (const field of FILTER_FIELDS) {
      const selected = filters?.[field.key] || ''
      if (selected && (document[field.key] || '').trim() !== selected) {
        return false
      }
    }
    if (!query) return true
    return SEARCH_FIELDS.some((field) =>
      (document[field] || '').toLowerCase().includes(query),
    )
  })
}
