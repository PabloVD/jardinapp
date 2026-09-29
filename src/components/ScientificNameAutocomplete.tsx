import { useEffect, useState } from 'react'
import { gbifUrl, searchScientificName, type TaxonSuggestion } from '../lib/taxonomy'

interface Props {
  commonName: string
  scientificName: string | undefined
  gbifKey: number | undefined
  onChange: (scientificName: string | undefined, gbifKey: number | undefined) => void
}

/** Campo de nombre científico con sugerencias según el nombre común escrito. */
export function ScientificNameAutocomplete({ commonName, scientificName, gbifKey, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<TaxonSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()

  const search = (q: string, signal?: AbortSignal) => {
    setLoading(true)
    setError(undefined)
    searchScientificName(q, signal)
      .then((r) => {
        setSuggestions(r)
        setOpen(true)
      })
      .catch((e) => {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Error de búsqueda')
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false)
      })
  }

  // Busca sola al escribir el nombre común, pero solo si aún no hay nombre científico.
  useEffect(() => {
    if (scientificName || commonName.trim().length < 3) return
    const ctrl = new AbortController()
    const t = setTimeout(() => search(commonName, ctrl.signal), 600)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [commonName, scientificName])

  // Si ya hay nombre científico o el común es muy corto, no se muestran sugerencias antiguas.
  const shown = open && !scientificName && commonName.trim().length >= 3 ? suggestions : []

  return (
    <div className="autocomplete">
      <label>
        Nombre científico
        <div className="input-with-button">
          <input
            value={scientificName ?? ''}
            placeholder={loading ? 'Buscando…' : 'p. ej. Salvia rosmarinus'}
            onChange={(e) => onChange(e.target.value || undefined, undefined)}
            onFocus={() => suggestions.length && setOpen(true)}
            autoCapitalize="off"
            spellCheck={false}
          />
          <button type="button" className="secondary small" disabled={loading || commonName.trim().length < 3}
            onClick={() => search(commonName)} title="Buscar a partir del nombre común">
            {loading ? '…' : 'Buscar'}
          </button>
        </div>
      </label>
      {gbifKey && (
        <a className="hint" href={gbifUrl(gbifKey)} target="_blank" rel="noreferrer">Ver en GBIF ↗</a>
      )}
      {error && <p className="hint error">{error}</p>}
      {shown.length > 0 && (
        <ul className="suggestions" role="listbox">
          {shown.map((s) => (
            <li key={s.scientificName}>
              <button type="button" onClick={() => {
                onChange(s.scientificName, s.gbifKey)
                setOpen(false)
              }}>
                <i>{s.scientificName}</i>
                <span className="muted">
                  {[s.commonName, s.family, s.rank !== 'species' ? s.rank : undefined].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="muted" onClick={() => setOpen(false)}>Cerrar</button>
          </li>
        </ul>
      )}
      {open && !loading && suggestions.length === 0 && commonName.trim().length >= 3 && !scientificName && (
        <p className="hint">Sin sugerencias para «{commonName}».</p>
      )}
    </div>
  )
}
