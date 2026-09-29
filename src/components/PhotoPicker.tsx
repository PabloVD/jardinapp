import { useRef, useState } from 'react'
import { processPhoto, type ProcessedPhoto } from '../lib/photos'

interface Props {
  onPicked: (photos: ProcessedPhoto[]) => void
  multiple?: boolean
}

/** Dos botones: cámara (captura directa en el móvil) y galería. */
export function PhotoPicker({ onPicked, multiple = true }: Props) {
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const handle = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(undefined)
    try {
      onPicked(await Promise.all([...files].map(processPhoto)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la foto')
    } finally {
      setBusy(false)
      if (camera.current) camera.current.value = ''
      if (gallery.current) gallery.current.value = ''
    }
  }

  return (
    <div className="photo-picker">
      <button type="button" disabled={busy} onClick={() => camera.current?.click()}>📷 Cámara</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => gallery.current?.click()}>🖼️ Galería</button>
      {busy && <span className="muted">Procesando…</span>}
      {error && <span className="error">{error}</span>}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handle(e.target.files)} />
      <input ref={gallery} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => handle(e.target.files)} />
    </div>
  )
}
