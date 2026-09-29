// Login con Google Identity Services (token client): OAuth implícito, sin backend.
// El token de acceso dura ~1 h; lo guardamos en localStorage para no pedir login
// cada vez que se abre la app dentro de esa hora.

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const STORAGE_KEY = 'jardin.token'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface StoredToken {
  accessToken: string
  expiresAt: number
}

export class NeedsAuthError extends Error {
  constructor() {
    super('Hace falta iniciar sesión con Google')
  }
}

let current: StoredToken | null = load()
const listeners = new Set<() => void>()

function load(): StoredToken | null {
  try {
    const t = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredToken | null
    return t && t.expiresAt > Date.now() ? t : null
  } catch {
    return null
  }
}

function save(t: StoredToken | null) {
  current = t
  try {
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // almacenamiento no disponible: el token queda solo en memoria
  }
  listeners.forEach((l) => l())
}

export const isConfigured = () => Boolean(CLIENT_ID)

export function isSignedIn(): boolean {
  return current !== null && current.expiresAt - 60_000 > Date.now()
}

export function onAuthChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Token válido o NeedsAuthError (la UI muestra entonces el botón de login). */
export function getToken(): string {
  if (!isSignedIn()) throw new NeedsAuthError()
  return current!.accessToken
}

function waitForGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (window.google?.accounts?.oauth2) resolve()
      else if (Date.now() - started > 10_000) reject(new Error('No se pudo cargar Google Identity Services'))
      else setTimeout(tick, 100)
    }
    tick()
  })
}

/** Abre el popup de Google. Llamar desde un gesto del usuario (click). */
export async function signIn(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Falta VITE_GOOGLE_CLIENT_ID (ver README)')
  await waitForGis()
  await new Promise<void>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      prompt: '',
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Login cancelado'))
          return
        }
        save({ accessToken: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in) * 1000 })
        resolve()
      },
      error_callback: (err) => reject(new Error(err.message || err.type)),
    })
    client.requestAccessToken()
  })
}

export function signOut() {
  if (current && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(current.accessToken, () => {})
  save(null)
}

/** Si el token caduca en mitad de una sesión, las llamadas lo invalidan con esto. */
export function invalidateToken() {
  save(null)
}
