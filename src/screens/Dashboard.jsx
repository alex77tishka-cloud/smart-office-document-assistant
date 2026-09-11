import { StatusBadge, UrgencyBadge } from '../components/Badges.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx'
import { display, displayDate, documentKey } from '../lib/format.js'
import {
  FILTER_FIELDS,
  buildFacets,
  countActiveFilters,
  filterDocuments,
  hasActiveFilters,
} from '../lib/filters.js'

export default function Dashboard({
  documents,
  loading,
  error,
  search,
  filters,
  lastLoadedLabel,
  onSearchChange,
  onFilterChange,
  onClearFilters,
  onSelectDocument,
  onRefresh,
  onGoToUpload,
}) {
  const facets = buildFacets(documents)
  const visible = filterDocuments(documents, filters, search)
  const filtersActive = hasActiveFilters(filters, search)
  const activeCount = countActiveFilters(filters)

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h2>Documents</h2>
          <p className="screen-sub">
            Processed documents from Google Sheets, newest first.
            {lastLoadedLabel ? ` Loaded ${lastLoadedLabel}.` : ''}
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="toolbar">
        <div className="search">
          <label className="visually-hidden" htmlFor="search">
            Search documents
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search customer, project, part numbers, summary, file name"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        {FILTER_FIELDS.map((field) => (
          <div className="filter" key={field.key}>
            <label className="visually-hidden" htmlFor={`filter-${field.key}`}>
              {field.label}
            </label>
            <select
              id={`filter-${field.key}`}
              value={filters[field.key]}
              onChange={(event) => onFilterChange(field.key, event.target.value)}
            >
              <option value="">All {field.label.toLowerCase()}</option>
              {facets[field.key].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="result-bar">
        <span className="result-count">
          {visible.length} of {documents.length}{' '}
          {documents.length === 1 ? 'document' : 'documents'}
          {activeCount > 0
            ? ` · ${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} active`
            : ''}
        </span>
        {filtersActive ? (
          <button type="button" className="link-button" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? <ErrorState error={error} onRetry={onRefresh} /> : null}

      {!error && loading && documents.length === 0 ? (
        <LoadingState label="Loading documents…" />
      ) : null}

      {!error && !loading && documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Once a document is processed it appears here. Upload one to get started."
          action={
            <button type="button" className="button" onClick={onGoToUpload}>
              Upload a document
            </button>
          }
        />
      ) : null}

      {documents.length > 0 && visible.length === 0 ? (
        <EmptyState
          title="No documents match"
          description="No document matches the current search and filters."
          action={
            <button type="button" className="button" onClick={onClearFilters}>
              Clear filters
            </button>
          }
        />
      ) : null}

      {/* The table stays on screen even if a refresh failed, with the error
          shown above it, so a failed background refresh never blanks the list. */}
      {visible.length > 0 ? (
        <div className="table-wrap">
          <table className="documents">
            <thead>
              <tr>
                <th scope="col">Received</th>
                <th scope="col">Customer</th>
                <th scope="col">Request type</th>
                <th scope="col">Product family</th>
                <th scope="col">Urgency</th>
                <th scope="col">Status</th>
                <th scope="col">Responsible team</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((document) => (
                <tr
                  // Document ID is identity; legacy rows without one fall back
                  // to a UI-only key that is never sent upstream.
                  key={documentKey(document)}
                  tabIndex={0}
                  onClick={() => onSelectDocument(document)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectDocument(document)
                    }
                  }}
                >
                  <td className="cell-date">{displayDate(document.receivedAt)}</td>
                  <td>
                    <span className="cell-strong">{display(document.customer)}</span>
                    <span className="cell-note">{display(document.fileName)}</span>
                  </td>
                  <td>{display(document.requestType)}</td>
                  <td>{display(document.productFamily)}</td>
                  <td>
                    <UrgencyBadge value={document.urgency} />
                  </td>
                  <td>
                    <StatusBadge value={document.status} />
                    {!document.isReviewable ? (
                      <span className="cell-note">legacy · not reviewable</span>
                    ) : null}
                  </td>
                  <td>{display(document.responsibleTeam)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
