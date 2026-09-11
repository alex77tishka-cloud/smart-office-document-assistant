import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-only: makes the browser see one origin, so the frontend calls
    // /api/... and never learns where n8n lives. The Express server is what
    // holds the API key.
    proxy: {
      '/api': {
        target: PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
