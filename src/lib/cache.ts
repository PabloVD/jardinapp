// Caché local en IndexedDB: último catálogo conocido y miniaturas.
import { openDB, type IDBPDatabase } from 'idb'
import type { Catalog } from './types'

export interface CachedState {
  catalog: Catalog
  fileId?: string
  modifiedTime?: string
  /** Hay cambios locales aún no escritos en Drive. */
  dirty: boolean
}

let dbPromise: Promise<IDBPDatabase> | null = null
const db = () =>
  (dbPromise ??= openDB('jardin', 1, {
    upgrade(d) {
      d.createObjectStore('kv')
      d.createObjectStore('blobs')
    },
  }))

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export const loadState = () => safe(async () => (await db()).get('kv', 'state') as Promise<CachedState | undefined>, undefined)
export const saveState = (s: CachedState) => safe(async () => void (await db()).put('kv', s, 'state'), undefined)
export const clearState = () => safe(async () => void (await db()).clear('kv'), undefined)

export const getBlob = (key: string) => safe(async () => (await db()).get('blobs', key) as Promise<Blob | undefined>, undefined)
export const putBlob = (key: string, blob: Blob) => safe(async () => void (await db()).put('blobs', blob, key), undefined)
