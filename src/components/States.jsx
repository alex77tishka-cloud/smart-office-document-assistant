// Loading, empty and error states. Each is visually distinct from the others
// so a slow load never reads as an empty result (SPEC.md 5.5, 5.6).

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p className="state-title">{label}</p>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="state">
      <div className="state-mark" aria-hidden="true">
        ◦
      </div>
      <p className="state-title">{title}</p>
      {description ? <p className="state-body">{description}</p> : null}
      {action}
    </div>
  )
}

/**
 * Readable error state. Shows plain language plus the error code, and offers a
 * retry only where retrying could help. Never renders a raw upstream payload.
 */
export function ErrorState({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="state state-error" role="alert">
      <div className="state-mark" aria-hidden="true">
        !
      </div>
      <p className="state-title">{error.message}</p>
      {error.detail ? <p className="state-body">{error.detail}</p> : null}
      <p className="state-code">{error.code}</p>
      {onRetry && error.retryable ? (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
