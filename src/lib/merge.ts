import type { Catalog, Plant } from './types'

export const formatId = (n: number) => `P-${String(n).padStart(3, '0')}`
const idNumber = (id: string) => Number(id.replace(/^P-/, '')) || 0

/**
 * Fusiona dos versiones del catálogo (p. ej. móvil y PC). Por cada id gana la
 * que tenga `updatedAt` más reciente. Si dos dispositivos crearon a la vez
 * fichas distintas con el mismo id (distinto `createdAt`), la local recibe un id nuevo.
 */
export function mergeCatalogs(local: Catalog, remote: Catalog): Catalog {
  const byId = new Map<string, Plant>(remote.plants.map((p) => [p.id, p]))
  let nextId = Math.max(local.nextId, remote.nextId, ...[...local.plants, ...remote.plants].map((p) => idNumber(p.id) + 1))
  const renamed: Plant[] = []

  for (const lp of local.plants) {
    const rp = byId.get(lp.id)
    if (!rp) byId.set(lp.id, lp)
    else if (rp.createdAt !== lp.createdAt) renamed.push(lp)
    else if (lp.updatedAt > rp.updatedAt) byId.set(lp.id, lp)
  }
  for (const p of renamed) {
    const id = formatId(nextId++)
    byId.set(id, { ...p, id })
  }

  const plants = [...byId.values()].sort((a, b) => idNumber(a.id) - idNumber(b.id))
  return { version: 1, nextId, plants }
}
