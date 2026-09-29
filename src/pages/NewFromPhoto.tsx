import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApproxDateInput } from '../components/ApproxDateInput'
import { PhotoPicker } from '../components/PhotoPicker'
import { PlantForm } from '../components/PlantForm'
import { isSignedIn } from '../lib/google/auth'
import type { ProcessedPhoto } from '../lib/photos'
import { createPlant, emptyFields, type PlantFields } from '../lib/store'

export function NewFromPhoto() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([])
  const [fields, setFields] = useState<PlantFields>(emptyFields)
  const [withoutPhoto, setWithoutPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)), [photos])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSignedIn()) {
      setError('Inicia sesión con Google (arriba) para guardar.')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const id = await createPlant({ ...fields, commonName: fields.commonName.trim() }, photos)
      navigate(`/planta/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

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
        <button type="button" className="secondary" onClick={() => navigate(-1)} disabled={saving}>Cancelar</button>
        <button type="submit" disabled={saving || !fields.commonName.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}
