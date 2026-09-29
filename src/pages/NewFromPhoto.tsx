import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApproxDateInput } from '../components/ApproxDateInput'
import { PhotoPicker } from '../components/PhotoPicker'
import { PlantForm } from '../components/PlantForm'
import { clearDraft, loadDraft, saveDraft } from '../lib/cache'
import { authErrorMessage } from '../lib/google/auth'
import type { ProcessedPhoto } from '../lib/photos'
import { createPlant, emptyFields, type PlantFields } from '../lib/store'

export function NewFromPhoto() {
  const navigate = useNavigate()
  const [photos, setPhotosState] = useState<ProcessedPhoto[]>([])
  const [fields, setFields] = useState<PlantFields>(emptyFields)
  const [withoutPhoto, setWithoutPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [restored, setRestored] = useState(false)

  // Las URLs de previsualización se liberan solo al salir (no en cada cambio de la lista).
  const previewUrls = useRef(new Set<string>())
  const setPhotos = (next: ProcessedPhoto[]) => {
    next.forEach((p) => previewUrls.current.add(p.previewUrl))
    setPhotosState(next)
  }
  useEffect(() => {
    const urls = previewUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // Recupera el borrador guardado (si la app se cerró, p. ej. al ir al login de Google).
  useEffect(() => {
    let cancelled = false
    void loadDraft().then((d) => {
      if (cancelled) return
      if (d && (d.photos.length || d.fields.commonName || d.withoutPhoto)) {
        const restoredPhotos = d.photos.map((p) => ({ ...p, previewUrl: URL.createObjectURL(p.thumb) }))
        restoredPhotos.forEach((p) => previewUrls.current.add(p.previewUrl))
        setPhotosState(restoredPhotos)
        setFields(d.fields)
        setWithoutPhoto(d.withoutPhoto)
        setRestored(true)
      }
      setDraftLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Guarda el borrador en el dispositivo mientras se edita.
  useEffect(() => {
    if (!draftLoaded || saving) return
    const t = setTimeout(() => {
      const hasContent = photos.length > 0 || fields.commonName.trim() !== '' || withoutPhoto
      if (hasContent) void saveDraft({ fields, withoutPhoto, photos: photos.map(({ full, thumb, date }) => ({ full, thumb, date })) })
      else void clearDraft()
    }, 300)
    return () => clearTimeout(t)
  }, [draftLoaded, saving, photos, fields, withoutPhoto])

  const discard = async () => {
    await clearDraft()
    navigate('/', { replace: true })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(undefined)
    try {
      // Si el login de Google ha caducado, createPlant lo abre aquí mismo y luego guarda.
      const id = await createPlant({ ...fields, commonName: fields.commonName.trim() }, photos)
      await clearDraft()
      navigate(`/planta/${id}`, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
      setSaving(false)
    }
  }

  if (!draftLoaded) return null

  if (!photos.length && !withoutPhoto) {
    return (
      <section className="start">
        <h2>Nueva planta</h2>
        <p className="muted">Empieza con una foto. La fecha se toma de la propia foto.</p>
        <PhotoPicker onPicked={setPhotos} />
        <button type="button" className="link" onClick={() => setWithoutPhoto(true)}>Crear sin foto</button>
      </section>
    )
  }

  return (
    <form onSubmit={save}>
      <h2>Nueva planta</h2>
      {restored && (
        <p className="notice">
          Borrador recuperado.{' '}
          <button type="button" className="link" onClick={() => confirm('¿Descartar el borrador?') && void discard()}>
            Descartar
          </button>
        </p>
      )}
      {photos.length > 0 && (
        <ul className="new-photos">
          {photos.map((p, i) => (
            <li key={p.previewUrl}>
              <img src={p.previewUrl} alt="" />
              <ApproxDateInput label="Fecha de la foto" value={p.date}
                onChange={(date) => setPhotos(photos.map((x, j) => (j === i ? { ...x, date: date ?? x.date } : x)))} />
              <button type="button" className="icon" aria-label="Quitar foto"
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <PhotoPicker onPicked={(more) => setPhotos([...photos, ...more])} />

      <PlantForm value={fields} onChange={setFields} />

      {photos[0] && !fields.acquiredDate && (
        <button type="button" className="link" onClick={() => setFields({ ...fields, acquiredDate: photos[0].date })}>
          Usar la fecha de la foto como adquisición
        </button>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions sticky">
        <button type="button" className="secondary" disabled={saving}
          onClick={() => confirm('¿Descartar esta ficha sin guardar?') && void discard()}>
          Descartar
        </button>
        <button type="submit" disabled={saving || !fields.commonName.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}
