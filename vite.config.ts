import { fileURLToPath, URL } from 'node:url'

import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    basicSsl(),
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/draw': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api/draw': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
