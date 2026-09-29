import { useEffect, useState } from 'react'
import { getImage } from '../lib/store'

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  fileId: string | undefined
  /** false para no guardar fotos grandes en la caché local. */
  cache?: boolean
}

type Loaded = { fileId: string; url?: string; failed?: boolean }

/** <img> de un archivo de Drive (hace falta token, así que se descarga como blob). */
export function DriveImage({ fileId, cache = true, alt = '', ...rest }: Props) {
  const [loaded, setLoaded] = useState<Loaded>()

  useEffect(() => {
    if (!fileId) return
    let objectUrl: string | undefined
    let cancelled = false
    getImage(fileId, cache)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ fileId, url: objectUrl })
      })
      .catch(() => !cancelled && setLoaded({ fileId, failed: true }))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId, cache])

  const current = loaded?.fileId === fileId ? loaded : undefined
  const cls = rest.className ?? ''
  if (!fileId || current?.failed) return <div className={`img-placeholder ${cls}`}>🌱</div>
  if (!current?.url) return <div className={`img-placeholder loading ${cls}`} />
  return <img src={current.url} alt={alt} {...rest} />
}
