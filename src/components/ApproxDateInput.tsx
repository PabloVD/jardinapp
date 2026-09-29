import { useState } from 'react'
import { parseDate, serializeDate, type ParsedDate, type Precision, type Qualifier } from '../lib/dates'
import type { ApproxDate } from '../lib/types'

const QUALIFIERS: [Qualifier, string][] = [
  ['exact', 'Exacta'],
  ['approx', '~ Aprox.'],
  ['onOrBefore', '≤ Hasta'],
  ['onOrAfter', '≥ Desde'],
]
const PRECISIONS: [Precision, string][] = [
  ['year', 'Año'],
  ['month', 'Mes'],
  ['day', 'Día'],
]
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MIN_YEAR = 1800
const MAX_YEAR = 2100

interface Props {
  label: string
  value: ApproxDate | undefined
  onChange: (v: ApproxDate | undefined) => void
}

const CURRENT_YEAR = new Date().getFullYear()
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate()

export function ApproxDateInput({ label, value, onChange }: Props) {
  const parsed = parseDate(value)
  const d: ParsedDate = parsed ?? { qualifier: 'exact', precision: 'year', year: CURRENT_YEAR }

  const emit = (patch: Partial<ParsedDate>) => {
    const next = { ...d, ...patch }
    if (next.precision !== 'year') next.month ??= 1
    if (next.precision === 'day') next.day = Math.min(next.day ?? 1, daysIn(next.year, next.month ?? 1))
    onChange(serializeDate(next))
  }

  return (
    <fieldset className="date-input">
      <legend>{label}</legend>
      {!parsed ? (
        <button type="button" className="secondary small" onClick={() => onChange(serializeDate(d))}>
          + Añadir fecha
        </button>
      ) : (
        <div className="date-grid">
          <div className="date-row">
            <select value={d.qualifier} onChange={(e) => emit({ qualifier: e.target.value as Qualifier })} aria-label="Tipo de fecha">
              {QUALIFIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={d.precision} onChange={(e) => emit({ precision: e.target.value as Precision })} aria-label="Precisión">
              {PRECISIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button type="button" className="icon" onClick={() => onChange(undefined)} aria-label="Quitar fecha" title="Quitar fecha">
              ×
            </button>
          </div>
          <div className={`date-parts ${d.precision}`}>
            {d.precision === 'day' && (
              <select value={d.day} onChange={(e) => emit({ day: Number(e.target.value) })} aria-label="Día">
                {Array.from({ length: daysIn(d.year, d.month ?? 1) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            )}
            {d.precision !== 'year' && (
              <select value={d.month} onChange={(e) => emit({ month: Number(e.target.value) })} aria-label="Mes">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            )}
            <YearField year={d.year} onYear={(year) => emit({ year })} />
          </div>
        </div>
      )}
    </fieldset>
  )
}

/**
 * Texto libre mientras se escribe; solo se guarda cuando hay un año válido de 4 cifras.
 * Así, al escribir «2», «20»… el valor intermedio no invalida la fecha ni quita el foco.
 */
function YearField({ year, onYear }: { year: number; onYear: (y: number) => void }) {
  const [draft, setDraft] = useState(String(year))
  const [prevYear, setPrevYear] = useState(year)
  // Si el año cambia desde fuera (no por lo que se está escribiendo), mostrar el nuevo.
  if (year !== prevYear) {
    setPrevYear(year)
    if (Number(draft) !== year) setDraft(String(year))
  }
  const valid = (s: string) => /^\d{4}$/.test(s) && Number(s) >= MIN_YEAR && Number(s) <= MAX_YEAR

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      autoComplete="off"
      value={draft}
      aria-label="Año"
      aria-invalid={!valid(draft)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
        setDraft(digits)
        if (valid(digits) && Number(digits) !== year) onYear(Number(digits))
      }}
      onBlur={() => !valid(draft) && setDraft(String(year))}
    />
  )
}
