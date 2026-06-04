import { fileURLToPath, URL } from 'node:url'

import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:8787'

  const apiProxy = {
    target: backendUrl,
    changeOrigin: true,
  }

  const logApiProxy: Plugin = {
    name: 'log-api-proxy',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => {
        console.log(`[vite] /api/* → ${backendUrl}`)
      })
    },
  }

  return {
  plugins: [
    basicSsl(),
    vue(),
    vueDevTools(),
    logApiProxy,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: [
      '@mediapipe/tasks-vision',
      '@mlightcad/cad-simple-viewer',
      '@mlightcad/cad-html-exporter',
      '@mlightcad/data-model',
      '@mlightcad/mtext-renderer',
      '@mlightcad/three-renderer',
      '@mlightcad/libredwg-converter',
      'lodash-es',
      '@velipso/polybool',
    ],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': apiProxy,
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': apiProxy,
    },
  },
  }
})
