import { parseDate, serializeDate, type ParsedDate, type Precision, type Qualifier } from '../lib/dates'
import type { ApproxDate } from '../lib/types'

const QUALIFIERS: [Qualifier, string][] = [
  ['exact', 'Exacta'],
  ['approx', 'Aprox. (~)'],
  ['onOrBefore', 'Antes o igual (≤)'],
  ['onOrAfter', 'Después o igual (≥)'],
]
const PRECISIONS: [Precision, string][] = [
  ['year', 'Año'],
  ['month', 'Mes'],
  ['day', 'Día'],
]

interface Props {
  label: string
  value: ApproxDate | undefined
  onChange: (v: ApproxDate | undefined) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const CURRENT_YEAR = new Date().getFullYear()

export function ApproxDateInput({ label, value, onChange }: Props) {
  const parsed = parseDate(value)
  const d: ParsedDate = parsed ?? { qualifier: 'exact', precision: 'year', year: CURRENT_YEAR }
  const empty = !parsed

  const emit = (patch: Partial<ParsedDate>) => {
    const next = { ...d, ...patch }
    if (next.precision !== 'year') next.month ??= 1
    if (next.precision === 'day') next.day ??= 1
    onChange(serializeDate(next))
  }

  const onInput = (raw: string) => {
    if (!raw) return
    const [y, m, day] = raw.split('-').map(Number)
    if (!y) return
    emit({ year: y, month: m || undefined, day: day || undefined })
  }

  return (
    <fieldset className="date-input">
      <legend>{label}</legend>
      {empty ? (
        <button type="button" className="secondary small" onClick={() => onChange(serializeDate(d))}>
          + Añadir fecha
        </button>
      ) : (
        <div className="date-row">
          <select value={d.qualifier} onChange={(e) => emit({ qualifier: e.target.value as Qualifier })} aria-label="Tipo de fecha">
            {QUALIFIERS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <select value={d.precision} onChange={(e) => emit({ precision: e.target.value as Precision })} aria-label="Precisión">
            {PRECISIONS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          {d.precision === 'year' && (
            <input type="number" inputMode="numeric" min={1900} max={2100} value={d.year}
              onChange={(e) => onInput(e.target.value)} aria-label="Año" />
          )}
          {d.precision === 'month' && (
            <input type="month" value={`${d.year}-${pad(d.month ?? 1)}`} onChange={(e) => onInput(e.target.value)} aria-label="Mes" />
          )}
          {d.precision === 'day' && (
            <input type="date" value={`${d.year}-${pad(d.month ?? 1)}-${pad(d.day ?? 1)}`}
              onChange={(e) => onInput(e.target.value)} aria-label="Día" />
          )}
          <button type="button" className="icon" onClick={() => onChange(undefined)} aria-label="Quitar fecha" title="Quitar fecha">
            ×
          </button>
        </div>
      )}
    </fieldset>
  )
}
