import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApproxDateInput } from '../components/ApproxDateInput'
import { DriveImage } from '../components/DriveImage'
import { PhotoPicker } from '../components/PhotoPicker'
import { formatDate, sortKey } from '../lib/dates'
import type { ProcessedPhoto } from '../lib/photos'
import { authErrorMessage, ensureSignedIn, isSignedIn } from '../lib/google/auth'
import { addPhotos, removePhoto, updatePlant, usePlant } from '../lib/store'
import { gbifUrl } from '../lib/taxonomy'
import type { Photo, Plant } from '../lib/types'

export function PlantDetail() {
  const { id } = useParams()
  const plant = usePlant(id)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>()
  // Fotos elegidas que aún no se han podido subir (p. ej. sesión de Google caducada).
  const [pending, setPending] = useState<ProcessedPhoto[]>([])
  const [openPhoto, setOpenPhoto] = useState<string>()

  if (!plant) return <p className="empty">Planta no encontrada. <Link to="/">Volver</Link></p>

  const photos = [...plant.photos].sort((a, b) => sortKey(b.date).localeCompare(sortKey(a.date)))
  const cover = plant.photos.find((p) => p.id === plant.coverPhotoId) ?? photos[0]
  const viewing = plant.photos.find((p) => p.id === openPhoto)

  const upload = async (picked: ProcessedPhoto[]) => {
    setUploading(true)
    setError(undefined)
    try {
      await addPhotos(plant.id, picked)
      picked.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      setPending([])
    } catch (e) {
      setPending(picked)
      setError(authErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  // Tras elegir la foto ya no hay «gesto del usuario» para abrir el login de Google,
  // así que si la sesión caducó las fotos esperan a que se pulse «Conectar y subir».
  const onPicked = (picked: ProcessedPhoto[]) => {
    if (isSignedIn()) void upload(picked)
    else setPending([...pending, ...picked])
  }

  const connectAndUpload = async () => {
    try {
      await ensureSignedIn()
    } catch (e) {
      setError(authErrorMessage(e))
      return
    }
    await upload(pending)
  }

  const dropPending = () => {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPending([])
    setError(undefined)
  }

  return (
    <article className="detail">
      {cover && (
        <button type="button" className="cover" onClick={() => setOpenPhoto(cover.id)}>
          <DriveImage fileId={cover.driveFileId} cache={false} />
        </button>
      )}
      <header className="detail-head">
        <div>
          <h2>{plant.commonName}</h2>
          {plant.scientificName && (
            <p>
              <i>{plant.scientificName}</i>
              {plant.gbifKey && <> · <a href={gbifUrl(plant.gbifKey)} target="_blank" rel="noreferrer">GBIF ↗</a></>}
            </p>
          )}
          <p className="muted">{plant.id}{plant.deathDate && ' · muerta'}</p>
        </div>
        <Link className="button secondary" to={`/planta/${plant.id}/editar`}>Editar</Link>
      </header>

      <Facts plant={plant} />

      <h3>Fotos ({plant.photos.length})</h3>
      <PhotoPicker onPicked={onPicked} />
      {uploading && <p className="muted">Subiendo a Drive…</p>}
      {pending.length > 0 && !uploading && (
        <div className="notice pending">
          <div className="pending-thumbs">
            {pending.map((p) => <img key={p.previewUrl} src={p.previewUrl} alt="" />)}
          </div>
          <span>{pending.length === 1 ? '1 foto pendiente' : `${pending.length} fotos pendientes`} de subir.</span>
          <div className="actions">
            <button type="button" className="secondary small" onClick={dropPending}>Descartar</button>
            <button type="button" className="small" onClick={() => void connectAndUpload()}>
              {isSignedIn() ? 'Reintentar' : 'Conectar y subir'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="gallery">
        {photos.map((ph) => (
          <li key={ph.id}>
            <button type="button" onClick={() => setOpenPhoto(ph.id)}>
              <DriveImage fileId={ph.thumbFileId} loading="lazy" />
              <span className="small">{formatDate(ph.date)}{ph.id === cover?.id && ' ★'}</span>
            </button>
          </li>
        ))}
      </ul>

      {viewing && <PhotoViewer plant={plant} photo={viewing} isCover={viewing.id === cover?.id} onClose={() => setOpenPhoto(undefined)} />}
    </article>
  )
}

function Facts({ plant }: { plant: Plant }) {
  const rows: [string, string | undefined][] = [
    ['Adquirida', formatDate(plant.acquiredDate)],
    ['Plantada', formatDate(plant.plantedDate)],
    ['Origen', plant.origin],
    ['Localización', plant.location],
    ['Defunción', formatDate(plant.deathDate)],
  ]
  return (
    <>
      <dl className="facts">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {plant.notes && <p className="notes">{plant.notes}</p>}
    </>
  )
}

function PhotoViewer({ plant, photo, isCover, onClose }: { plant: Plant; photo: Photo; isCover: boolean; onClose: () => void }) {
  const [date, setDate] = useState(photo.date)
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [busy, setBusy] = useState(false)

  const patchPhoto = (patch: Partial<Photo>) =>
    updatePlant(plant.id, { photos: plant.photos.map((p) => (p.id === photo.id ? { ...p, ...patch } : p)) })

  const run = async (fn: () => Promise<void>, close = false) => {
    setBusy(true)
    try {
      await fn()
      if (close) onClose()
    } finally {
      setBusy(false)
    }
  }

  const dirty = date !== photo.date || caption !== (photo.caption ?? '')

  return (
    <div className="viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="viewer-body" onClick={(e) => e.stopPropagation()}>
        <DriveImage fileId={photo.driveFileId} cache={false} className="viewer-img" />
        <ApproxDateInput label="Fecha de la foto" value={date} onChange={(v) => v && setDate(v)} />
        <label>
          Pie de foto
          <input value={caption} onChange={(e) => setCaption(e.target.value)} />
        </label>
        <div className="actions">
          {!isCover && (
            <button type="button" className="secondary" disabled={busy} onClick={() => run(() => updatePlant(plant.id, { coverPhotoId: photo.id }))}>
              ★ Portada
            </button>
          )}
          <button type="button" className="danger secondary" disabled={busy}
            onClick={() => confirm('¿Borrar esta foto? (irá a la papelera de Drive)') && run(() => removePhoto(plant.id, photo.id), true)}>
            Borrar
          </button>
          <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
          {dirty && (
            <button type="button" disabled={busy} onClick={() => run(() => patchPhoto({ date, caption: caption || undefined }), true)}>
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
