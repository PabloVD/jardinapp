import { describe, expect, it } from 'vitest'
import { mergeCatalogs } from './merge'
import type { Catalog, Plant } from './types'

const plant = (id: string, over: Partial<Plant> = {}): Plant => ({
  id, commonName: id, photos: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
})
const cat = (plants: Plant[], nextId = plants.length + 1): Catalog => ({ version: 1, nextId, plants })

describe('mergeCatalogs', () => {
  it('gana la edición más reciente', () => {
    const local = cat([plant('P-001', { commonName: 'local', updatedAt: '2026-02-01T00:00:00Z' })])
    const remote = cat([plant('P-001', { commonName: 'remote', updatedAt: '2026-01-15T00:00:00Z' })])
    expect(mergeCatalogs(local, remote).plants[0].commonName).toBe('local')
    expect(mergeCatalogs(remote, local).plants[0].commonName).toBe('local')
  })

  it('une fichas creadas en cada dispositivo', () => {
    const merged = mergeCatalogs(cat([plant('P-001'), plant('P-003')], 4), cat([plant('P-001'), plant('P-002')], 3))
    expect(merged.plants.map((p) => p.id)).toEqual(['P-001', 'P-002', 'P-003'])
    expect(merged.nextId).toBe(4)
  })

  it('renombra la ficha local si hay colisión de id', () => {
    const local = cat([plant('P-002', { commonName: 'mía', createdAt: '2026-03-01T10:00:00Z' })], 3)
    const remote = cat([plant('P-002', { commonName: 'suya', createdAt: '2026-03-01T09:00:00Z' })], 3)
    const merged = mergeCatalogs(local, remote)
    expect(merged.plants.map((p) => [p.id, p.commonName])).toEqual([['P-002', 'suya'], ['P-003', 'mía']])
    expect(merged.nextId).toBe(4)
  })

  it('conserva borrados lógicos', () => {
    const local = cat([plant('P-001', { deleted: true, updatedAt: '2026-05-01T00:00:00Z' })])
    expect(mergeCatalogs(local, cat([plant('P-001')])).plants[0].deleted).toBe(true)
  })
})
