import JSZip from 'jszip'
import { formatDate, qualifierOf, today } from './dates'
import type { Catalog, Plant } from './types'

export function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  // BOM para que Excel detecte UTF-8 (acentos) y CRLF como pide RFC 4180.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

const DATE_FIELDS = [
  ['acquired', 'acquiredDate'],
  ['planted', 'plantedDate'],
  ['death', 'deathDate'],
] as const

export function plantsCsv(plants: Plant[]): string {
  const header = [
    'id', 'common_name', 'scientific_name', 'gbif_key',
    ...DATE_FIELDS.flatMap(([n]) => [`${n}_date`, `${n}_qualifier`, `${n}_display`]),
    'origin', 'location', 'notes', 'alive', 'photo_count', 'photos', 'created_at', 'updated_at',
  ]
  const rows = plants.map((p) => [
    p.id, p.commonName, p.scientificName, p.gbifKey,
    ...DATE_FIELDS.flatMap(([, k]) => [p[k], qualifierOf(p[k]), formatDate(p[k])]),
    p.origin, p.location, p.notes, p.deathDate ? 'no' : 'yes', p.photos.length,
    p.photos.map((ph) => `photos/${ph.fileName}`).join(';'),
    p.createdAt, p.updatedAt,
  ])
  return toCsv([header, ...rows])
}

export function photosCsv(plants: Plant[]): string {
  const rows = plants.flatMap((p) =>
    p.photos.map((ph) => [p.id, `photos/${ph.fileName}`, ph.date, ph.caption, ph.id === p.coverPhotoId ? 'yes' : 'no']),
  )
  return toCsv([['plant_id', 'file', 'date', 'caption', 'cover'], ...rows])
}

/**
 * ZIP con plants.csv, photos.csv, plants.json y las fotos a tamaño completo.
 * `fetchImage` descarga cada foto de Drive.
 */
export async function buildExportZip(
  catalog: Catalog,
  fetchImage: (driveFileId: string) => Promise<Blob>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; fileName: string; failed: string[] }> {
  const plants = catalog.plants.filter((p) => !p.deleted)
  const zip = new JSZip()
  zip.file('plants.csv', plantsCsv(plants))
  zip.file('photos.csv', photosCsv(plants))
  zip.file('plants.json', JSON.stringify({ ...catalog, plants }, null, 2))

  const photos = plants.flatMap((p) => p.photos)
  const failed: string[] = []
  let done = 0
  onProgress?.(0, photos.length)
  // Descarga de 4 en 4 para no saturar la conexión del móvil.
  const queue = [...photos]
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let ph = queue.shift(); ph; ph = queue.shift()) {
        try {
          zip.file(`photos/${ph.fileName}`, await fetchImage(ph.driveFileId))
        } catch {
          failed.push(ph.fileName)
        }
        onProgress?.(++done, photos.length)
      }
    }),
  )
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, fileName: `jardin_${today().replace(/-/g, '')}.zip`, failed }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
