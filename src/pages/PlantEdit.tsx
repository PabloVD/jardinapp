import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PlantForm } from '../components/PlantForm'
import { deletePlant, updatePlant, usePlant, type PlantFields } from '../lib/store'
import type { Plant } from '../lib/types'

const pickFields = (p: Plant): PlantFields => {
  const { id: _id, photos: _ph, createdAt: _c, updatedAt: _u, deleted: _d, coverPhotoId: _cv, ...fields } = p
  return fields
}

export function PlantEdit() {
  const { id } = useParams()
  const plant = usePlant(id)
  if (!plant) return <p className="empty">Planta no encontrada.</p>
  return <EditForm key={plant.id} plant={plant} />
}

function EditForm({ plant }: { plant: Plant }) {
  const navigate = useNavigate()
  const [fields, setFields] = useState(() => pickFields(plant))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(undefined)
    try {
      // Los campos vaciados se guardan como undefined para que desaparezcan del JSON.
      await updatePlant(plant.id, { ...fields, commonName: fields.commonName.trim() })
      navigate(`/planta/${plant.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm(`¿Borrar la ficha ${plant.id} (${plant.commonName})? Si la planta ha muerto, mejor pon la fecha de defunción.`)) return
    await deletePlant(plant.id)
    navigate('/', { replace: true })
  }

  return (
    <form onSubmit={save}>
      <h2>Editar {plant.id}</h2>
      <PlantForm value={fields} onChange={setFields} />
      {error && <p className="error">{error}</p>}
      <button type="button" className="danger link" onClick={remove}>Borrar ficha</button>
      <div className="actions sticky">
        <button type="button" className="secondary" onClick={() => navigate(-1)} disabled={saving}>Cancelar</button>
        <button type="submit" disabled={saving || !fields.commonName.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}
