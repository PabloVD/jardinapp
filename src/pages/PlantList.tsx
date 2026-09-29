import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DriveImage } from '../components/DriveImage'
import { formatDate, sortKey } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Plant } from '../lib/types'

type Status = 'alive' | 'dead' | 'all'
type Sort = 'id' | 'name' | 'acquired' | 'updated'

const cover = (p: Plant) => p.photos.find((ph) => ph.id === p.coverPhotoId) ?? p.photos[0]
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const SORTERS: Record<Sort, (a: Plant, b: Plant) => number> = {
  id: (a, b) => a.id.localeCompare(b.id),
  name: (a, b) => a.commonName.localeCompare(b.commonName, 'es'),
  acquired: (a, b) => sortKey(b.acquiredDate).localeCompare(sortKey(a.acquiredDate)),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
}

export function PlantList() {
  const { catalog, status } = useStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status>('alive')
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState<Sort>('updated')

  const live = catalog.plants.filter((p) => !p.deleted)
  const locations = useMemo(() => [...new Set(live.map((p) => p.location).filter(Boolean))].sort() as string[], [live])

  const shown = useMemo(() => {
    const q = norm(query.trim())
    return live
      .filter((p) => statusFilter === 'all' || (statusFilter === 'dead') === Boolean(p.deathDate))
      .filter((p) => !location || p.location === location)
      .filter((p) => !q || norm([p.id, p.commonName, p.scientificName, p.location, p.origin, p.notes].join(' ')).includes(q))
      .sort(SORTERS[sort])
  }, [live, query, statusFilter, location, sort])

  return (
    <section>
      <div className="filters">
        <input type="search" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="filter-row">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status)} aria-label="Estado">
            <option value="alive">Vivas</option>
            <option value="dead">Muertas</option>
            <option value="all">Todas</option>
          </select>
          <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Localización">
            <option value="">📍 Todas</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Orden">
            <option value="updated">Editadas ↓</option>
            <option value="id">Por ID</option>
            <option value="name">Por nombre</option>
            <option value="acquired">Adquisición ↓</option>
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          {status === 'loading' || status === 'syncing' ? (
            <p>Cargando…</p>
          ) : live.length === 0 ? (
            <>
              <p>Aún no hay plantas.</p>
              <Link className="button" to="/nueva">📷 Crear la primera ficha</Link>
            </>
          ) : (
            <p>Ninguna planta coincide con el filtro.</p>
          )}
        </div>
      ) : (
        <ul className="grid">
          {shown.map((p) => (
            <li key={p.id} className={p.deathDate ? 'dead' : undefined}>
              <Link to={`/planta/${p.id}`}>
                <DriveImage fileId={cover(p)?.thumbFileId} className="thumb" loading="lazy" />
                <div className="card-text">
                  <strong>{p.commonName || 'Sin nombre'}</strong>
                  {p.scientificName && <i className="muted">{p.scientificName}</i>}
                  <span className="muted small">
                    {p.id}
                    {p.location && ` · ${p.location}`}
                    {p.deathDate && ` · † ${formatDate(p.deathDate)}`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small center">{shown.length} de {live.length} plantas</p>

      <Link to="/nueva" className="fab" aria-label="Nueva planta">+</Link>
    </section>
  )
}
