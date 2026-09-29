import { describe, expect, it } from 'vitest'
import { formatDate, parseDate, qualifierOf, serializeDate, sortKey } from './dates'

describe('ApproxDate', () => {
  it.each([
    ['2021', { qualifier: 'exact', precision: 'year', year: 2021 }],
    ['2021-05', { qualifier: 'exact', precision: 'month', year: 2021, month: 5 }],
    ['2021-05-03', { qualifier: 'exact', precision: 'day', year: 2021, month: 5, day: 3 }],
    ['~2019', { qualifier: 'approx', precision: 'year', year: 2019 }],
    ['<=2020', { qualifier: 'onOrBefore', precision: 'year', year: 2020 }],
    ['>=2020-07', { qualifier: 'onOrAfter', precision: 'month', year: 2020, month: 7 }],
  ])('parse/serialize %s', (s, expected) => {
    expect(parseDate(s)).toMatchObject(expected)
    expect(serializeDate(parseDate(s)!)).toBe(s)
  })

  it('rechaza formatos inválidos', () => {
    for (const s of ['', '21', '2021-13', '2021-05-40', '<2021', 'hace años']) expect(parseDate(s)).toBeNull()
  })

  it('formatea para mostrar', () => {
    expect(formatDate('2021-05-03')).toBe('3 may 2021')
    expect(formatDate('<=2020')).toBe('≤ 2020')
    expect(formatDate('~2021-12')).toBe('~ dic 2021')
    expect(formatDate(undefined)).toBe('')
  })

  it('ordena y expone el calificador', () => {
    expect(['2021-05-03', '<=2020', '2021'].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))).toEqual(['<=2020', '2021', '2021-05-03'])
    expect(qualifierOf('<=2020')).toBe('onOrBefore')
    expect(qualifierOf(undefined)).toBe('')
  })

  it('serializa ignorando partes que exceden la precisión', () => {
    expect(serializeDate({ qualifier: 'onOrBefore', precision: 'year', year: 2020, month: 4, day: 2 })).toBe('<=2020')
  })
})
