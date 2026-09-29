import type { ApproxDate } from './types'

export type Qualifier = 'exact' | 'approx' | 'onOrBefore' | 'onOrAfter'
export type Precision = 'year' | 'month' | 'day'

export interface ParsedDate {
  qualifier: Qualifier
  precision: Precision
  year: number
  month?: number
  day?: number
}

const PREFIX: Record<Qualifier, string> = { exact: '', approx: '~', onOrBefore: '<=', onOrAfter: '>=' }
const RE = /^(~|<=|>=)?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function parseDate(s: ApproxDate | undefined): ParsedDate | null {
  const m = s?.trim().match(RE)
  if (!m) return null
  const qualifier: Qualifier = m[1] === '~' ? 'approx' : m[1] === '<=' ? 'onOrBefore' : m[1] === '>=' ? 'onOrAfter' : 'exact'
  const year = Number(m[2])
  const month = m[3] ? Number(m[3]) : undefined
  const day = m[4] ? Number(m[4]) : undefined
  if (month !== undefined && (month < 1 || month > 12)) return null
  if (day !== undefined && (day < 1 || day > 31)) return null
  const precision: Precision = day ? 'day' : month ? 'month' : 'year'
  return { qualifier, precision, year, month, day }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function serializeDate(d: ParsedDate): ApproxDate {
  let body = String(d.year)
  if (d.precision !== 'year' && d.month) body += `-${pad(d.month)}`
  if (d.precision === 'day' && d.month && d.day) body += `-${pad(d.day)}`
  return PREFIX[d.qualifier] + body
}

/** Texto legible: "3 may 2021", "~ 2021", "≤ may 2021". */
export function formatDate(s: ApproxDate | undefined): string {
  const d = parseDate(s)
  if (!d) return s ?? ''
  let body = String(d.year)
  if (d.month) body = `${MONTHS[d.month - 1]} ${body}`
  if (d.day) body = `${d.day} ${body}`
  const sym = { exact: '', approx: '~ ', onOrBefore: '≤ ', onOrAfter: '≥ ' }[d.qualifier]
  return sym + body
}

/** Clave ordenable "YYYY-MM-DD"; las partes que faltan se rellenan con 00. */
export function sortKey(s: ApproxDate | undefined): string {
  const d = parseDate(s)
  if (!d) return ''
  return `${d.year}-${pad(d.month ?? 0)}-${pad(d.day ?? 0)}`
}

export function qualifierOf(s: ApproxDate | undefined): Qualifier | '' {
  return parseDate(s)?.qualifier ?? ''
}

export function dateFromJs(date: Date): ApproxDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const today = () => dateFromJs(new Date())
