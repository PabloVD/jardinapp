// Preparación de fotos en el navegador: fecha EXIF, redimensionado y miniatura.
import exifr from 'exifr'
import { dateFromJs, today } from './dates'
import type { ApproxDate } from './types'

export interface ProcessedPhoto {
  full: Blob
  thumb: Blob
  date: ApproxDate
  previewUrl: string
}

const FULL_MAX = 1600
const THUMB_MAX = 360

async function exifDate(file: File): Promise<ApproxDate | null> {
  try {
    const tags = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])
    const d: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate
    return d instanceof Date && !Number.isNaN(d.getTime()) ? dateFromJs(d) : null
  } catch {
    return null
  }
}

async function resize(bitmap: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo codificar la imagen'))), 'image/jpeg', quality),
  )
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  // createImageBitmap respeta la orientación EXIF, así las fotos del móvil salen derechas.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const [full, thumb, date] = await Promise.all([
      resize(bitmap, FULL_MAX, 0.85),
      resize(bitmap, THUMB_MAX, 0.75),
      exifDate(file),
    ])
    const fallback = file.lastModified ? dateFromJs(new Date(file.lastModified)) : today()
    return { full, thumb, date: date ?? fallback, previewUrl: URL.createObjectURL(thumb) }
  } finally {
    bitmap.close()
  }
}
