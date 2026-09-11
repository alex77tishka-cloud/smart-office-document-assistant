import { StatusBadge, UrgencyBadge } from '../components/Badges.jsx'
import FieldList from '../components/FieldList.jsx'
import ReviewForm from '../components/ReviewForm.jsx'
import { display, displayDate, isBlank } from '../lib/format.js'

function DriveLink({ href, label }) {
  if (isBlank(href)) return <span className="muted">{display(href)}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer" className="drive-link">
      {display(label)} ↗
    </a>
  )
}

export default function DocumentDetail({ document, onBack, onSubmitReview }) {
  return (
    <div className="screen">
      <button type="button" className="link-button back" onClick={onBack}>
        ← Back to documents
      </button>

      <header className="screen-head detail-head">
        <div>
          <h2>{display(document.customer)}</h2>
          <p className="screen-sub">
            {display(document.requestType)} · received{' '}
            {displayDate(document.receivedAt)}
          </p>
        </div>
        <div className="detail-badges">
          <UrgencyBadge value={document.urgency} />
          <StatusBadge value={document.status} />
        </div>
      </header>

      <div className="detail-grid">
        <FieldList
          title="Identification"
          fields={[
            { label: 'Document ID', value: document.documentId },
            { label: 'Customer', value: document.customer },
            { label: 'End customer', value: document.endCustomer },
            { label: 'Project / program', value: document.projectOrProgram },
            { label: 'Request type', value: document.requestType },
            { label: 'Product family', value: document.productFamily },
          ]}
        />

        <FieldList
          title="Parts & competition"
          fields={[
            { label: 'TE part number(s)', value: document.tePartNumbers },
            {
              label: 'Competitor part number(s)',
              value: document.competitorPartNumbers,
            },
            { label: 'Competitor', value: document.competitor },
            {
              label: 'Strategic opportunity',
              value: document.strategicOpportunity,
            },
          ]}
        />

        <FieldList
          title="Commercial terms"
          fields={[
            { label: 'Quantity', value: document.quantity },
            { label: 'Target price', value: document.targetPrice },
          ]}
        />

        <FieldList
          title="Timing"
          fields={[
            { label: 'Received at', value: displayDate(document.receivedAt) },
            {
              label: 'Required delivery',
              value: displayDate(document.requiredDelivery),
            },
            {
              label: 'Response deadline',
              value: displayDate(document.responseDeadline),
            },
          ]}
        />

        <FieldList
          title="Assessment"
          span
          fields={[
            { label: 'Summary', value: document.summary, wide: true },
            {
              label: 'Requested action',
              value: document.requestedAction,
              wide: true,
            },
            { label: 'Responsible team', value: document.responsibleTeam },
            {
              label: 'Urgency',
              render: () => <UrgencyBadge value={document.urgency} />,
            },
          ]}
        />

        <FieldList
          title="File"
          fields={[
            { label: 'File name', value: document.fileName },
            {
              label: 'File link',
              render: () => (
                <DriveLink
                  href={document.fileLink}
                  label="Open in Google Drive"
                />
              ),
            },
          ]}
        />
      </div>

      <section className="review-section">
        <h3 className="field-group-title">Review</h3>

        <dl className="field-list review-current">
          <div className="field">
            <dt>Current status</dt>
            <dd>
              <StatusBadge value={document.status} />
            </dd>
          </div>
          <div className="field">
            <dt>Reviewed by</dt>
            <dd>{display(document.reviewedBy)}</dd>
          </div>
          <div className="field">
            <dt>Review note</dt>
            <dd className="field-wide">{display(document.reviewNote)}</dd>
          </div>
        </dl>

        {document.isReviewable ? (
          <ReviewForm
            // Remount the form when a different document is opened.
            key={document.documentId}
            document={document}
            onSubmit={onSubmitReview}
          />
        ) : (
          // SPEC.md 5.4.1 — no Document ID, so no review is attempted at all.
          <div className="notice notice-muted">
            <p className="notice-title">This document cannot be reviewed</p>
            <p>
              It is a legacy spreadsheet row with no <strong>Document ID</strong>.
              Reviews are recorded against the Document ID, so there is nothing to
              record this review against. The record stays visible, searchable and
              filterable.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
