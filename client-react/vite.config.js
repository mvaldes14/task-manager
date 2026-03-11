import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'TD',
        short_name: 'TD',
        description: 'Smart task manager with natural language input',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1b26',
        theme_color: '#1a1b26',
        orientation: 'any',
        icons: [
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'Add Task', short_name: 'Add', description: 'Quickly add a new task', url: '/?add=1' }
        ],
        share_target: {
          action: '/share-target',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' }
        }
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: /^\/api\//,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache' }
        }]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5001',
      '/share-target': 'http://localhost:5001',
    }
  },
  build: {
    outDir: '../client/dist',
    emptyOutDir: true,
  }
})
