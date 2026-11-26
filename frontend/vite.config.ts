import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The API runs on port 4000 during local development. Proxying /api keeps the
// browser on a single origin, so the httpOnly session cookie is sent without
// any CORS configuration. A deployed build can point elsewhere with
// VITE_API_URL.
const apiProxy = {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
