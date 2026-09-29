// Estado de la app: catálogo en memoria, sincronizado con Drive y cacheado en IndexedDB.
// Los componentes lo leen con useCatalog() (useSyncExternalStore).

import { useSyncExternalStore } from 'react'
import { isSignedIn, NeedsAuthError, onAuthChange } from './google/auth'
import * as drive from './google/drive'
import { clearState, getBlob, loadState, putBlob, saveState, type CachedState } from './cache'
import { formatId, mergeCatalogs } from './merge'
import type { ProcessedPhoto } from './photos'
import { emptyCatalog, type Catalog, type Photo, type Plant } from './types'

const CATALOG_FILE = 'plants.json'

export type SyncStatus = 'loading' | 'idle' | 'syncing' | 'needsAuth' | 'offline' | 'error'

export interface StoreState {
  catalog: Catalog
  status: SyncStatus
  error?: string
  dirty: boolean
}

let persisted: CachedState = { catalog: emptyCatalog(), dirty: false }
let state: StoreState = { catalog: persisted.catalog, status: 'loading', dirty: false }
const listeners = new Set<() => void>()

function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useStore = () => useSyncExternalStore(subscribe, () => state)

export function usePlant(id: string | undefined): Plant | undefined {
  const { catalog } = useStore()
  return catalog.plants.find((p) => p.id === id && !p.deleted)
}

async function persist(patch: Partial<CachedState>) {
  persisted = { ...persisted, ...patch }
  set({ catalog: persisted.catalog, dirty: persisted.dirty })
  await saveState(persisted)
}

// Todas las operaciones contra Drive van en fila para no pisarse.
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => {})
  return run
}

function reportError(e: unknown) {
  if (e instanceof NeedsAuthError) set({ status: 'needsAuth', error: undefined })
  else if (!navigator.onLine) set({ status: 'offline', error: undefined })
  else set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
}

async function doSync(): Promise<void> {
  if (!isSignedIn()) {
    set({ status: 'needsAuth' })
    return
  }
  set({ status: 'syncing', error: undefined })
  const { root } = await drive.ensureFolders()
  let fileId = persisted.fileId
  let remoteModified: string | undefined

  if (fileId) {
    remoteModified = (await drive.getMetadata(fileId).catch(() => null))?.modifiedTime
    if (!remoteModified) fileId = undefined // se borró en Drive: buscar o recrear
  }
  if (!fileId) {
    const found = await drive.findFile(CATALOG_FILE, root.id)
    fileId = found?.id
    remoteModified = found?.modifiedTime
  }

  let catalog = persisted.catalog
  let mustWrite = persisted.dirty || !fileId

  if (fileId && remoteModified !== persisted.modifiedTime) {
    const remote = await drive.readJson<Catalog>(fileId)
    const merged = persisted.dirty ? mergeCatalogs(catalog, remote) : remote
    mustWrite = persisted.dirty && JSON.stringify(merged) !== JSON.stringify(remote)
    catalog = merged
  }

  if (mustWrite) {
    const written = await drive.writeJson({ name: CATALOG_FILE, parent: root.id, data: catalog, fileId })
    fileId = written.id
    remoteModified = written.modifiedTime
  }
  await persist({ catalog, fileId, modifiedTime: remoteModified, dirty: false })
  set({ status: 'idle' })
}

export function sync(): Promise<void> {
  return enqueue(doSync).catch(reportError)
}

export async function initStore() {
  const cached = await loadState()
  if (cached) persisted = cached
  set({ catalog: persisted.catalog, dirty: persisted.dirty, status: isSignedIn() ? 'syncing' : 'needsAuth' })
  onAuthChange(() => {
    if (isSignedIn()) void sync()
    else set({ status: 'needsAuth' })
  })
  window.addEventListener('online', () => void sync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isSignedIn()) void sync()
  })
  if (isSignedIn()) await sync()
}

/** Aplica un cambio local, lo guarda en caché y lo sube a Drive. */
async function mutate(fn: (c: Catalog) => Catalog): Promise<void> {
  await enqueue(async () => persist({ catalog: fn(persisted.catalog), dirty: true }))
  await sync()
}

const now = () => new Date().toISOString()

export type PlantFields = Omit<Plant, 'id' | 'photos' | 'createdAt' | 'updatedAt' | 'deleted' | 'coverPhotoId'>
export const emptyFields = (): PlantFields => ({ commonName: '' })

/** Crea la ficha. Las fotos se suben primero; si falla la subida no se crea nada. */
export async function createPlant(fields: PlantFields, photos: ProcessedPhoto[]): Promise<string> {
  let newId = ''
  // Reservamos el id dentro de la fila para que no se repita.
  await enqueue(async () => {
    newId = formatId(persisted.catalog.nextId)
    await persist({ catalog: { ...persisted.catalog, nextId: persisted.catalog.nextId + 1 } })
  })
  const uploaded = await Promise.all(photos.map((p) => uploadPhoto(newId, p)))
  const ts = now()
  const plant: Plant = { ...fields, id: newId, photos: uploaded, coverPhotoId: uploaded[0]?.id, createdAt: ts, updatedAt: ts }
  await mutate((c) => ({ ...c, plants: [...c.plants, plant] }))
  return newId
}

export function updatePlant(id: string, patch: Partial<Plant>): Promise<void> {
  return mutate((c) => ({
    ...c,
    plants: c.plants.map((p) => (p.id === id ? { ...p, ...patch, id, updatedAt: now() } : p)),
  }))
}

export function deletePlant(id: string): Promise<void> {
  return updatePlant(id, { deleted: true })
}

export async function addPhotos(plantId: string, photos: ProcessedPhoto[]): Promise<void> {
  const uploaded = await Promise.all(photos.map((p) => uploadPhoto(plantId, p)))
  await mutate((c) => ({
    ...c,
    plants: c.plants.map((p) =>
      p.id === plantId
        ? { ...p, photos: [...p.photos, ...uploaded], coverPhotoId: p.coverPhotoId ?? uploaded[0]?.id, updatedAt: now() }
        : p,
    ),
  }))
}

export async function removePhoto(plantId: string, photoId: string): Promise<void> {
  const plant = persisted.catalog.plants.find((p) => p.id === plantId)
  const photo = plant?.photos.find((ph) => ph.id === photoId)
  if (!plant || !photo) return
  const photos = plant.photos.filter((ph) => ph.id !== photoId)
  await updatePlant(plantId, { photos, coverPhotoId: plant.coverPhotoId === photoId ? photos[0]?.id : plant.coverPhotoId })
  await Promise.all([drive.trashFile(photo.driveFileId), drive.trashFile(photo.thumbFileId)]).catch(() => {})
}

const randomId = () => Math.random().toString(36).slice(2, 8)

async function uploadPhoto(plantId: string, p: ProcessedPhoto): Promise<Photo> {
  const { photos } = await drive.ensureFolders()
  const id = randomId()
  const base = `${plantId}_${p.date.replace(/[^0-9]/g, '')}_${id}`
  const [full, thumb] = await Promise.all([
    drive.uploadFile({ name: `${base}.jpg`, parent: photos.id, blob: p.full }),
    drive.uploadFile({ name: `${base}_thumb.jpg`, parent: photos.id, blob: p.thumb }),
  ])
  await putBlob(thumb.id, p.thumb)
  return { id, driveFileId: full.id, thumbFileId: thumb.id, fileName: `${base}.jpg`, date: p.date }
}

/** Blob de una imagen de Drive. Las miniaturas se cachean en IndexedDB; las fotos grandes, no. */
export async function getImage(fileId: string, cache = true): Promise<Blob> {
  const cached = await getBlob(fileId)
  if (cached) return cached
  const blob = await drive.downloadBlob(fileId)
  if (cache) await putBlob(fileId, blob)
  return blob
}

export async function resetLocalCache() {
  await clearState()
  persisted = { catalog: emptyCatalog(), dirty: false }
  set({ catalog: persisted.catalog, dirty: false })
  await sync()
}
