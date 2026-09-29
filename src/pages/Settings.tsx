import { useState } from 'react'
import { buildExportZip, downloadBlob } from '../lib/export'
import { isSignedIn, signIn, signOut } from '../lib/google/auth'
import { ensureFolders } from '../lib/google/drive'
import { getImage, resetLocalCache, sync, useStore } from '../lib/store'

export function Settings() {
  const { catalog, status, error, dirty } = useStore()
  const [progress, setProgress] = useState<[number, number]>()
  const [exportMsg, setExportMsg] = useState<string>()
  const signedIn = isSignedIn()

  const exportZip = async () => {
    setExportMsg(undefined)
    setProgress([0, 0])
    try {
      const { blob, fileName, failed } = await buildExportZip(catalog, (id) => getImage(id, false), (d, t) => setProgress([d, t]))
      downloadBlob(blob, fileName)
      setExportMsg(failed.length ? `Exportado, pero fallaron ${failed.length} fotos: ${failed.join(', ')}` : `Descargado ${fileName}`)
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(undefined)
    }
  }

  const openDrive = async () => {
    const { root } = await ensureFolders()
    window.open(root.webViewLink ?? `https://drive.google.com/drive/folders/${root.id}`, '_blank')
  }

  const count = catalog.plants.filter((p) => !p.deleted).length

  return (
    <section className="settings">
      <h2>Ajustes</h2>

      <h3>Google Drive</h3>
      <p>
        Estado: <strong>{signedIn ? 'conectado' : 'sin conectar'}</strong>
        {status === 'syncing' && ' · sincronizando…'}
        {dirty && ' · hay cambios pendientes de subir'}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {signedIn ? (
          <>
            <button type="button" className="secondary" onClick={() => void sync()}>Sincronizar ahora</button>
            <button type="button" className="secondary" onClick={() => void openDrive()}>Abrir carpeta en Drive</button>
            <button type="button" className="secondary" onClick={signOut}>Cerrar sesión</button>
          </>
        ) : (
          <button type="button" onClick={() => void signIn()}>Conectar con Google</button>
        )}
      </div>

      <h3>Exportar</h3>
      <p className="muted">ZIP con <code>plants.csv</code>, <code>photos.csv</code>, <code>plants.json</code> y todas las fotos ({count} plantas).</p>
      <button type="button" onClick={exportZip} disabled={!signedIn || progress !== undefined}>
        {progress ? `Descargando fotos ${progress[0]}/${progress[1]}…` : '⬇️ Exportar CSV + fotos'}
      </button>
      {progress && progress[1] > 0 && <progress value={progress[0]} max={progress[1]} />}
      {exportMsg && <p>{exportMsg}</p>}

      <h3>Avanzado</h3>
      <button type="button" className="secondary small" disabled={!signedIn}
        onClick={() => confirm('Borra la copia local y vuelve a descargar todo de Drive. ¿Seguir?') && void resetLocalCache()}>
        Recargar desde Drive
      </button>
    </section>
  )
}
