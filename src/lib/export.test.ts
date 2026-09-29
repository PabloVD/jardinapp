import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildExportZip, csvCell, photosCsv, plantsCsv } from './export'
import type { Plant } from './types'

const p: Plant = {
  id: 'P-001',
  commonName: 'Romero',
  scientificName: 'Salvia rosmarinus',
  acquiredDate: '<=2020',
  plantedDate: '2021-03-14',
  origin: 'Vivero "La Huerta", Madrid',
  notes: 'Riego poco\nsol directo',
  photos: [
    { id: 'a', driveFileId: 'd1', thumbFileId: 't1', fileName: 'P-001_20210314_a.jpg', date: '2021-03-14' },
    { id: 'b', driveFileId: 'd2', thumbFileId: 't2', fileName: 'P-001_20260901_b.jpg', date: '2026-09-01', caption: 'floreciendo' },
  ],
  coverPhotoId: 'a',
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:00:00Z',
}

describe('CSV', () => {
  it('escapa comas, comillas, saltos de línea y punto y coma', () => {
    expect(csvCell('simple')).toBe('simple')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""')
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"')
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(0)).toBe('0')
  })

  it('genera plants.csv con BOM, calificadores y rutas de fotos', () => {
    const csv = plantsCsv([p])
    expect(csv.startsWith('﻿id,common_name,scientific_name')).toBe(true)
    const [, row] = csv.slice(1).split('\r\n')
    expect(row).toContain('<=2020,onOrBefore,≤ 2020')
    expect(row).toContain('"Vivero ""La Huerta"", Madrid"')
    expect(row).toContain('"photos/P-001_20210314_a.jpg;photos/P-001_20260901_b.jpg"')
    expect(row).toContain(',yes,2,')
  })

  it('genera photos.csv con una fila por foto', () => {
    const lines = photosCsv([p]).trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('P-001,photos/P-001_20210314_a.jpg,2021-03-14,,yes')
    expect(lines[2]).toBe('P-001,photos/P-001_20260901_b.jpg,2026-09-01,floreciendo,no')
  })
})

describe('buildExportZip', () => {
  it('incluye CSV, JSON y fotos, excluye borradas y reporta fallos', async () => {
    const deleted: Plant = { ...p, id: 'P-002', deleted: true, photos: [] }
    const fetchImage = async (id: string) => {
      if (id === 'd2') throw new Error('404')
      return new Blob(['img-' + id])
    }
    const progress: number[] = []
    const { blob, fileName, failed } = await buildExportZip(
      { version: 1, nextId: 3, plants: [p, deleted] }, fetchImage, (d) => progress.push(d),
    )
    expect(fileName).toMatch(/^jardin_\d{8}\.zip$/)
    expect(failed).toEqual(['P-001_20260901_b.jpg'])
    expect(progress.at(-1)).toBe(2)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(['photos.csv', 'photos/', 'photos/P-001_20210314_a.jpg', 'plants.csv', 'plants.json'])
    const json = JSON.parse(await zip.file('plants.json')!.async('string'))
    expect(json.plants).toHaveLength(1)
  })
})
