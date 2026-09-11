import { useEffect, useRef, useState } from 'react'
import { processDocument } from '../api/client.js'
import { UrgencyBadge } from '../components/Badges.jsx'
import FieldList from '../components/FieldList.jsx'
import { ErrorState } from '../components/States.jsx'
import { ApiError, ERROR_CODES } from '../api/errors.js'
import { readFileAsBase64 } from '../lib/file.js'
import { display, displayDate, formatFileSize } from '../lib/format.js'
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_FILE_TYPES,
  MAX_UPLOAD_BYTES,
  UNVERIFIED_TYPE_LABELS,
  matchAcceptedType,
} from '../constants/uploads.js'

// Presentation-only progress narration while the request is in flight. These
// stages describe what n8n is doing; they are not driven by n8n.
const STAGES = [
  'Uploading the file…',
  'Extracting text…',
  'Reading fields with AI…',
  'Saving to Drive and Sheets…',
  'Almost done…',
]

export default function Upload({ onProcessed, onGoToDashboard }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!processing) return undefined
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1))
    }, 900)
    return () => clearInterval(timer)
  }, [processing])

  function acceptFile(candidate) {
    setResult(null)
    setError(null)

    if (!candidate) return
    if (!matchAcceptedType(candidate)) {
      const accepted = ACCEPTED_FILE_TYPES.map((type) => type.extension).join(', ')
      setFile(null)
      setError(
        new ApiError(
          ERROR_CODES.BAD_REQUEST,
          `That file type is not supported. Accepted types: ${accepted}.`,
        ),
      )
      return
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      setError(
        new ApiError(
          ERROR_CODES.PAYLOAD_TOO_LARGE,
          `That file is ${formatFileSize(candidate.size)}. The limit is ${formatFileSize(MAX_UPLOAD_BYTES)}.`,
        ),
      )
      return
    }
    setFile(candidate)
  }

  async function handleProcess() {
    if (!file || processing) return
    setError(null)
    setResult(null)
    setStage(0)
    setProcessing(true)
    try {
      const base64 = await readFileAsBase64(file)
      const processed = await processDocument({
        fileName: file.name,
        mimeType: file.type || matchAcceptedType(file)?.mimeType || '',
        fileBase64: base64,
        size: file.size,
      })
      setResult(processed)
      onProcessed()
    } catch (processError) {
      // The file stays selected so a retry needs no re-pick (SPEC.md 5.1).
      setError(processError)
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const matched = file ? matchAcceptedType(file) : null

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h2>Upload a document</h2>
          <p className="screen-sub">
            The document is processed by the existing automation: fields are
            extracted, the file is stored in Drive and a row is added to Google
            Sheets.
          </p>
        </div>
      </header>

      {!result ? (
        <>
          <div
            className={`dropzone${dragging ? ' dropzone-active' : ''}${processing ? ' dropzone-busy' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              if (!processing) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (processing) return
              acceptFile(event.dataTransfer.files?.[0])
            }}
          >
            <p className="dropzone-title">Drag a file here</p>
            <p className="dropzone-sub">
              or{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => inputRef.current?.click()}
                disabled={processing}
              >
                choose a file
              </button>
            </p>
            <p className="dropzone-types">
              {ACCEPTED_FILE_TYPES.map((type) => type.label).join(', ')} · up to{' '}
              {formatFileSize(MAX_UPLOAD_BYTES)}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="visually-hidden"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(event) => acceptFile(event.target.files?.[0])}
            />
          </div>

          {UNVERIFIED_TYPE_LABELS.length > 0 ? (
            <p className="inline-note">
              {UNVERIFIED_TYPE_LABELS.join(' and ')} processing is still being
              validated end to end. PDF is fully verified.
            </p>
          ) : null}

          {file ? (
            <div className="file-card">
              <div className="file-meta">
                <span className="cell-strong">{file.name}</span>
                <span className="cell-note">
                  {matched ? matched.label : display(file.type)} ·{' '}
                  {file.type || 'unknown type'} · {formatFileSize(file.size)}
                </span>
              </div>
              <div className="file-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={reset}
                  disabled={processing}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleProcess}
                  disabled={processing}
                >
                  {processing ? 'Processing…' : 'Process document'}
                </button>
              </div>
            </div>
          ) : null}

          {processing ? (
            <div className="processing" role="status" aria-live="polite">
              <div className="spinner" aria-hidden="true" />
              <div>
                <p className="state-title">{STAGES[stage]}</p>
                <p className="state-body">
                  Processing runs AI extraction, Drive upload, a Sheets write and
                  a notification. This usually takes up to a minute — leave this
                  screen open.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <ErrorState
              error={error}
              onRetry={file ? handleProcess : undefined}
            />
          ) : null}
        </>
      ) : (
        <div className="result">
          <div className="notice notice-ok">
            <p className="notice-title">Document processed</p>
            <p>
              {display(result.fileName)} was processed and added to the
              dashboard.{' '}
              {result.notificationSent
                ? 'A notification was sent.'
                : 'No notification was sent.'}
            </p>
          </div>

          <div className="detail-grid">
            <FieldList
              title="Record"
              fields={[
                { label: 'Document ID', value: result.documentId },
                { label: 'Received at', value: displayDate(result.receivedAt) },
                { label: 'Processing status', value: result.processingStatus },
                {
                  label: 'Notification sent',
                  value: result.notificationSent ? 'Yes' : 'No',
                },
                {
                  label: 'File link',
                  render: () =>
                    result.fileLink ? (
                      <a
                        className="drive-link"
                        href={result.fileLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Google Drive ↗
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    ),
                },
              ]}
            />

            <FieldList
              title="Extracted fields"
              span
              fields={[
                { label: 'Customer', value: result.customer },
                { label: 'End customer', value: result.endCustomer },
                { label: 'Project / program', value: result.projectOrProgram },
                { label: 'Request type', value: result.requestType },
                { label: 'Product family', value: result.productFamily },
                { label: 'TE part number(s)', value: result.tePartNumbers },
                {
                  label: 'Competitor part number(s)',
                  value: result.competitorPartNumbers,
                },
                { label: 'Competitor', value: result.competitor },
                { label: 'Quantity', value: result.quantity },
                { label: 'Target price', value: result.targetPrice },
                {
                  label: 'Required delivery',
                  value: displayDate(result.requiredDelivery),
                },
                {
                  label: 'Response deadline',
                  value: displayDate(result.responseDeadline),
                },
                { label: 'Responsible team', value: result.responsibleTeam },
                {
                  label: 'Strategic opportunity',
                  value: result.strategicOpportunity,
                },
                {
                  label: 'Urgency',
                  render: () => <UrgencyBadge value={result.urgency} />,
                },
                { label: 'Summary', value: result.summary, wide: true },
                {
                  label: 'Requested action',
                  value: result.requestedAction,
                  wide: true,
                },
              ]}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={onGoToDashboard}
            >
              View on dashboard
            </button>
            <button type="button" className="button" onClick={reset}>
              Upload another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
