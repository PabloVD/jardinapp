// Cliente mínimo de la API REST de Google Drive v3 (sin gapi).
// Con el scope drive.file solo vemos los archivos creados por esta app.

import { getToken, invalidateToken, NeedsAuthError } from './auth'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const ROOT_FOLDER = 'JardinApp'

export interface DriveFile {
  id: string
  name: string
  modifiedTime?: string
  webViewLink?: string
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${getToken()}` },
  })
  if (res.status === 401) {
    invalidateToken()
    throw new NeedsAuthError()
  }
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text()}`)
  return res
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function findOne(name: string, parent: string | null, mime?: string): Promise<DriveFile | null> {
  const parts = [`name = '${q(name)}'`, 'trashed = false']
  if (parent) parts.push(`'${parent}' in parents`)
  if (mime) parts.push(`mimeType = '${mime}'`)
  const params = new URLSearchParams({
    q: parts.join(' and '),
    fields: 'files(id,name,modifiedTime,webViewLink)',
    spaces: 'drive',
    orderBy: 'createdTime',
  })
  const res = await call(`${API}/files?${params}`)
  const { files } = (await res.json()) as { files: DriveFile[] }
  return files[0] ?? null
}

async function createFolder(name: string, parent: string | null): Promise<DriveFile> {
  const res = await call(`${API}/files?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  })
  return res.json()
}

export interface Folders {
  root: DriveFile
  photos: DriveFile
}

let foldersPromise: Promise<Folders> | null = null

/** Crea (una vez) JardinApp/ y JardinApp/photos/ y devuelve sus ids. */
export function ensureFolders(): Promise<Folders> {
  foldersPromise ??= (async () => {
    const root = (await findOne(ROOT_FOLDER, null, FOLDER_MIME)) ?? (await createFolder(ROOT_FOLDER, null))
    const photos = (await findOne('photos', root.id, FOLDER_MIME)) ?? (await createFolder('photos', root.id))
    return { root, photos }
  })().catch((e) => {
    foldersPromise = null
    throw e
  })
  return foldersPromise
}

export const findFile = (name: string, parent: string) => findOne(name, parent)

export async function getMetadata(fileId: string): Promise<DriveFile> {
  const res = await call(`${API}/files/${fileId}?fields=id,name,modifiedTime`)
  return res.json()
}

export async function downloadBlob(fileId: string): Promise<Blob> {
  const res = await call(`${API}/files/${fileId}?alt=media`)
  return res.blob()
}

export async function readJson<T>(fileId: string): Promise<T> {
  const res = await call(`${API}/files/${fileId}?alt=media`)
  return res.json()
}

function multipart(metadata: object, body: Blob): { body: Blob; contentType: string } {
  const boundary = `jardin${Math.random().toString(36).slice(2)}`
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${body.type || 'application/octet-stream'}\r\n\r\n`,
      body,
      `\r\n--${boundary}--`,
    ]),
  }
}

/** Crea un archivo nuevo (fileId vacío) o sobrescribe su contenido. */
export async function uploadFile(opts: { name: string; parent: string; blob: Blob; fileId?: string }): Promise<DriveFile> {
  const fields = 'fields=id,name,modifiedTime'
  const meta = opts.fileId ? {} : { name: opts.name, parents: [opts.parent] }
  const { body, contentType } = multipart(meta, opts.blob)
  const url = opts.fileId
    ? `${UPLOAD}/files/${opts.fileId}?uploadType=multipart&${fields}`
    : `${UPLOAD}/files?uploadType=multipart&${fields}`
  const res = await call(url, { method: opts.fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': contentType }, body })
  return res.json()
}

export function writeJson(opts: { name: string; parent: string; data: unknown; fileId?: string }) {
  const blob = new Blob([JSON.stringify(opts.data, null, 2)], { type: 'application/json' })
  return uploadFile({ ...opts, blob })
}

/** Manda un archivo a la papelera de Drive (recuperable 30 días). */
export async function trashFile(fileId: string): Promise<void> {
  await call(`${API}/files/${fileId}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
}
