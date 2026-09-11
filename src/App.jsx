import { useCallback, useEffect, useState } from 'react'
import { USE_MOCKS, getDocuments, submitReview } from './api/client.js'
import { MOCK_SCENARIOS, getMockScenario, setMockScenario } from './api/mock.js'
import Dashboard from './screens/Dashboard.jsx'
import DocumentDetail from './screens/DocumentDetail.jsx'
import Upload from './screens/Upload.jsx'
import { EMPTY_FILTERS } from './lib/filters.js'
import { applyReviewToDocuments } from './lib/review.js'
import { documentKey, formatClockTime } from './lib/format.js'
import './App.css'

const VIEWS = { DASHBOARD: 'dashboard', DETAIL: 'detail', UPLOAD: 'upload' }

export default function App() {
  const [view, setView] = useState(VIEWS.DASHBOARD)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastLoadedLabel, setLastLoadedLabel] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [scenario, setScenario] = useState(getMockScenario())

  // Google Sheets is the source of truth: the app always re-reads the list
  // rather than keeping its own authoritative copy. `load` never shows the
  // spinner itself, so it can also serve as a quiet background refresh.
  const load = useCallback(
    ({ background = false } = {}) =>
      getDocuments().then(
        (rows) => {
          setDocuments(rows)
          setError(null)
          setLastLoadedLabel(formatClockTime(new Date()))
          setLoading(false)
        },
        (loadError) => {
          setError(loadError)
          // A failed background refresh must not destroy what is on screen —
          // only a visible load starts from an empty list.
          if (!background) setDocuments([])
          setLoading(false)
        },
      ),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  function refresh() {
    setLoading(true)
    setError(null)
    load()
  }

  const selected =
    selectedKey === null
      ? null
      : documents.find((item) => documentKey(item) === selectedKey) || null

  function openDocument(item) {
    setSelectedKey(documentKey(item))
    setView(VIEWS.DETAIL)
  }

  function backToDashboard() {
    setSelectedKey(null)
    setView(VIEWS.DASHBOARD)
  }

  async function handleReview(input) {
    // Nothing changes on screen until this resolves. It throws on every
    // failure — including DOCUMENT_NOT_FOUND and an unconfirmed write — so
    // there is no optimistic update to roll back.
    const review = await submitReview(input)

    // The write is confirmed. Apply it locally so the detail screen and the
    // dashboard badge update straight away — in mock mode this is the whole
    // result of a review.
    setDocuments((current) => applyReviewToDocuments(current, review))

    // Then re-read the Sheet, which replaces the local echo with the source of
    // truth. The read starts only after n8n has answered, so it cannot race
    // ahead of the write (the hazard noted in PROMPTS.md, Prompt 5). Mock mode
    // has no source of truth, and a re-read could only overwrite the update.
    if (!USE_MOCKS) load({ background: true })
    return review
  }

  function handleScenarioChange(next) {
    setMockScenario(next)
    setScenario(next)
    setSelectedKey(null)
    setView(VIEWS.DASHBOARD)
    refresh()
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-brand">
          <span className="app-title">Smart Office Document Assistant</span>
          {USE_MOCKS ? <span className="badge badge-mock">Mock data</span> : null}
        </div>

        <nav className="app-nav">
          <button
            type="button"
            className={`nav-button${view !== VIEWS.UPLOAD ? ' nav-active' : ''}`}
            onClick={backToDashboard}
          >
            Documents
          </button>
          <button
            type="button"
            className={`nav-button${view === VIEWS.UPLOAD ? ' nav-active' : ''}`}
            onClick={() => setView(VIEWS.UPLOAD)}
          >
            Upload
          </button>

          {USE_MOCKS ? (
            <>
              <label className="visually-hidden" htmlFor="mock-scenario">
                Mock scenario
              </label>
              <select
                id="mock-scenario"
                className="scenario"
                value={scenario}
                onChange={(event) => handleScenarioChange(event.target.value)}
                title="Mock-only: switch between normal, empty, error and slow responses"
              >
                <option value={MOCK_SCENARIOS.NORMAL}>Scenario: normal</option>
                <option value={MOCK_SCENARIOS.EMPTY}>Scenario: empty</option>
                <option value={MOCK_SCENARIOS.ERROR}>Scenario: error</option>
                <option value={MOCK_SCENARIOS.SLOW}>Scenario: slow</option>
              </select>
            </>
          ) : null}
        </nav>
      </header>

      <main className="app-main">
        {view === VIEWS.UPLOAD ? (
          <Upload
            onProcessed={() => load({ background: true })}
            onGoToDashboard={backToDashboard}
          />
        ) : null}

        {view === VIEWS.DETAIL && selected ? (
          <DocumentDetail
            document={selected}
            onBack={backToDashboard}
            onSubmitReview={handleReview}
          />
        ) : null}

        {view === VIEWS.DASHBOARD || (view === VIEWS.DETAIL && !selected) ? (
          <Dashboard
            documents={documents}
            loading={loading}
            error={error}
            search={search}
            filters={filters}
            lastLoadedLabel={lastLoadedLabel}
            onSearchChange={setSearch}
            onFilterChange={(key, value) =>
              setFilters((current) => ({ ...current, [key]: value }))
            }
            onClearFilters={() => {
              setFilters(EMPTY_FILTERS)
              setSearch('')
            }}
            onSelectDocument={openDocument}
            onRefresh={refresh}
            onGoToUpload={() => setView(VIEWS.UPLOAD)}
          />
        ) : null}
      </main>

      <footer className="app-foot">
        <span>
          Google Sheets is the source of truth. Document processing, AI
          extraction, urgency and notifications are handled by n8n.
        </span>
        {USE_MOCKS ? <span>Phase 1 · mock data · no network calls</span> : null}
      </footer>
    </div>
  )
}
