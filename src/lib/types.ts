/** Fecha flexible: ver lib/dates.ts ("2021-05-03", "2021-05", "2021", "~2021", "<=2021", ">=2021-05"). */
export type ApproxDate = string

export interface Photo {
  id: string
  driveFileId: string
  thumbFileId: string
  fileName: string
  date: ApproxDate
  caption?: string
}

export interface Plant {
  id: string
  commonName: string
  scientificName?: string
  gbifKey?: number
  acquiredDate?: ApproxDate
  plantedDate?: ApproxDate
  deathDate?: ApproxDate
  origin?: string
  location?: string
  notes?: string
  photos: Photo[]
  coverPhotoId?: string
  createdAt: string
  updatedAt: string
  /** Borrado lógico, para que la fusión entre dispositivos no resucite fichas. */
  deleted?: boolean
}

export interface Catalog {
  version: 1
  nextId: number
  plants: Plant[]
}

export const emptyCatalog = (): Catalog => ({ version: 1, nextId: 1, plants: [] })
