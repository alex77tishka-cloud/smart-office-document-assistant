import { display, isBlank } from '../lib/format.js'

// Urgency values come from n8n. The app only picks a colour for the string it
// was given — it never computes urgency (SPEC.md 1.2).
function urgencyTone(value) {
  switch (value.trim().toLowerCase()) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'neutral'
  }
}

export function UrgencyBadge({ value }) {
  if (isBlank(value)) return <span className="muted">{display(value)}</span>
  return (
    <span className={`badge badge-${urgencyTone(value)}`}>{value}</span>
  )
}

export function StatusBadge({ value }) {
  if (isBlank(value)) return <span className="muted">{display(value)}</span>
  const tone = value.trim().toLowerCase() === 'reviewed' ? 'done' : 'pending'
  return <span className={`badge badge-${tone}`}>{value}</span>
}
