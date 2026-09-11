import { useState } from 'react'
import { REVIEW_STATUSES, USE_MOCKS } from '../api/client.js'
import { ErrorState } from './States.jsx'

/**
 * Review form (SPEC.md 5.4). Only ever rendered for a document that carries a
 * Document ID — the caller checks `isReviewable` first.
 *
 * The entered values live here, not in the document, so a failed save leaves
 * them untouched for a retry.
 */
export default function ReviewForm({ document, onSubmit }) {
  const [status, setStatus] = useState(
    REVIEW_STATUSES.includes(document.status) ? document.status : REVIEW_STATUSES[1],
  )
  const [reviewedBy, setReviewedBy] = useState(document.reviewedBy || '')
  const [reviewNote, setReviewNote] = useState(document.reviewNote || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [nameError, setNameError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    if (reviewedBy.trim() === '') {
      setNameError('Enter your name so the review is attributable.')
      return
    }
    setNameError('')
    setError(null)
    setSaved(false)
    setSubmitting(true)

    try {
      await onSubmit({
        documentId: document.documentId,
        status,
        reviewedBy: reviewedBy.trim(),
        reviewNote: reviewNote.trim(),
      })
      setSaved(true)
    } catch (submitError) {
      setError(submitError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} aria-busy={submitting}>
      <fieldset disabled={submitting}>
        <legend className="visually-hidden">Record a review</legend>

        <div className="form-row">
          <span className="form-label">Status</span>
          <div className="radio-row">
            {REVIEW_STATUSES.map((value) => (
              <label className="radio" key={value}>
                <input
                  type="radio"
                  name="review-status"
                  value={value}
                  checked={status === value}
                  onChange={() => {
                    setStatus(value)
                    setSaved(false)
                  }}
                />
                {value}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label className="form-label" htmlFor="reviewed-by">
            Reviewed by
          </label>
          <input
            id="reviewed-by"
            type="text"
            value={reviewedBy}
            placeholder="Your name"
            onChange={(event) => {
              setReviewedBy(event.target.value)
              setSaved(false)
            }}
            aria-invalid={nameError ? 'true' : undefined}
          />
          {nameError ? <p className="form-error">{nameError}</p> : null}
        </div>

        <div className="form-row">
          <label className="form-label" htmlFor="review-note">
            Review note
          </label>
          <textarea
            id="review-note"
            rows={4}
            value={reviewNote}
            placeholder="Optional context for whoever picks this up next"
            onChange={(event) => {
              setReviewNote(event.target.value)
              setSaved(false)
            }}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="button button-primary">
            {submitting ? 'Saving review…' : 'Save review'}
          </button>
          {saved ? (
            <span className="form-success" role="status">
              {USE_MOCKS
                ? 'Review saved (mock mode — this session only).'
                : 'Review saved to Google Sheets.'}
            </span>
          ) : null}
        </div>
      </fieldset>

      {error ? (
        <>
          <ErrorState error={error} />
          <p className="form-hint">Your entries have been kept.</p>
        </>
      ) : null}
    </form>
  )
}
