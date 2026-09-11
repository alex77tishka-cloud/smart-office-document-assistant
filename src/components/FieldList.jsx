import { display } from '../lib/format.js'

/**
 * Renders a labelled group of document fields. Missing values fall back to a
 * placeholder rather than disappearing, so a partial row stays readable.
 */
export default function FieldList({ title, fields, span }) {
  return (
    <section className={`field-group${span ? ' field-group-span' : ''}`}>
      <h3 className="field-group-title">{title}</h3>
      <dl className="field-list">
        {fields.map((field) => (
          <div className="field" key={field.label}>
            <dt>{field.label}</dt>
            <dd className={field.wide ? 'field-wide' : undefined}>
              {field.render ? field.render() : display(field.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
