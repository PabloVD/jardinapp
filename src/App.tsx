import { useState } from 'react'
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router'
import { isConfigured, signIn } from './lib/google/auth'
import { useStore } from './lib/store'
import { NewFromPhoto } from './pages/NewFromPhoto'
import { PlantDetail } from './pages/PlantDetail'
import { PlantEdit } from './pages/PlantEdit'
import { PlantList } from './pages/PlantList'
import { Settings } from './pages/Settings'

const STATUS_LABEL = {
  loading: 'Cargando…',
  syncing: 'Sincronizando…',
  idle: 'Guardado en Drive',
  needsAuth: 'Sin conectar',
  offline: 'Sin conexión',
  error: 'Error',
} as const

function StatusBar() {
  const { status, dirty, error } = useStore()
  const [loginError, setLoginError] = useState<string>()

  if (!isConfigured()) {
    return <div className="banner error">Falta configurar VITE_GOOGLE_CLIENT_ID (ver README).</div>
  }
  if (status === 'needsAuth') {
    return (
      <div className="banner">
        <span>Conecta tu Google Drive para ver y guardar tus plantas.</span>
        <button type="button" className="small" onClick={() => signIn().catch((e) => setLoginError(e.message))}>Conectar</button>
        {loginError && <span className="error">{loginError}</span>}
      </div>
    )
  }
  if (status === 'error' || status === 'offline') {
    return (
      <div className="banner warn">
        {status === 'offline' ? 'Sin conexión.' : `Error al sincronizar: ${error}`}
        {dirty && ' Los cambios se subirán al reconectar.'}
      </div>
    )
  }
  return null
}

export default function App() {
  const { status, dirty } = useStore()
  return (
    <HashRouter>
      <header className="topbar">
        <Link to="/" className="brand">🌿 JardínApp</Link>
        <span className={`sync-dot ${status}${dirty ? ' dirty' : ''}`} title={STATUS_LABEL[status]} />
        <nav>
          <NavLink to="/" end>Plantas</NavLink>
          <NavLink to="/ajustes">Ajustes</NavLink>
        </nav>
      </header>
      <StatusBar />
      <main>
        <Routes>
          <Route path="/" element={<PlantList />} />
          <Route path="/nueva" element={<NewFromPhoto />} />
          <Route path="/planta/:id" element={<PlantDetail />} />
          <Route path="/planta/:id/editar" element={<PlantEdit />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<p className="empty">Página no encontrada.</p>} />
        </Routes>
      </main>
    </HashRouter>
  )
}
