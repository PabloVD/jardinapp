import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages la app vive en /<repo>/; la Action pasa BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'JardínApp — catálogo de plantas',
        short_name: 'JardínApp',
        description: 'Catálogo personal de plantas con fotos en Google Drive',
        lang: 'es',
        theme_color: '#2f6b3b',
        background_color: '#f6f4ec',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Las llamadas a Google/GBIF nunca se cachean en el service worker.
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
})
