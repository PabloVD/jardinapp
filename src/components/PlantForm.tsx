import { useMemo } from 'react'
import { useStore, type PlantFields } from '../lib/store'
import { ApproxDateInput } from './ApproxDateInput'
import { ScientificNameAutocomplete } from './ScientificNameAutocomplete'

interface Props {
  value: PlantFields
  onChange: (v: PlantFields) => void
}

/** Campos editables de una ficha (sin fotos). */
export function PlantForm({ value, onChange }: Props) {
  const { catalog } = useStore()
  const set = <K extends keyof PlantFields>(k: K, v: PlantFields[K]) => onChange({ ...value, [k]: v })

  // Sugerencias de valores ya usados, para escribir menos.
  const [locations, origins] = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort()
    const live = catalog.plants.filter((p) => !p.deleted)
    return [uniq(live.map((p) => p.location)), uniq(live.map((p) => p.origin))]
  }, [catalog])

  return (
    <div className="plant-form">
      <label>
        Nombre común *
        <input required value={value.commonName} onChange={(e) => set('commonName', e.target.value)} placeholder="p. ej. Romero" />
      </label>

      <ScientificNameAutocomplete
        commonName={value.commonName}
        scientificName={value.scientificName}
        gbifKey={value.gbifKey}
        onChange={(scientificName, gbifKey) => onChange({ ...value, scientificName, gbifKey })}
      />

      <ApproxDateInput label="Fecha de adquisición" value={value.acquiredDate} onChange={(v) => set('acquiredDate', v)} />
      <ApproxDateInput label="Fecha de plantado" value={value.plantedDate} onChange={(v) => set('plantedDate', v)} />

      <label>
        Origen
        <input list="origins" value={value.origin ?? ''} onChange={(e) => set('origin', e.target.value || undefined)}
          placeholder="Vivero, esqueje de…, regalo de…" />
        <datalist id="origins">{origins.map((o) => <option key={o} value={o} />)}</datalist>
      </label>

      <label>
        Localización
        <input list="locations" value={value.location ?? ''} onChange={(e) => set('location', e.target.value || undefined)}
          placeholder="Terraza, salón, huerto…" />
        <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
      </label>

      <label>
        Notas
        <textarea rows={4} value={value.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
      </label>

      <ApproxDateInput label="Fecha de defunción" value={value.deathDate} onChange={(v) => set('deathDate', v)} />
    </div>
  )
}
