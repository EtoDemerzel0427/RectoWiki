import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  // Electron needs './', GitHub Pages needs '/repo-name/', Local dev needs '/'
  base: process.env.ELECTRON_BUILD === 'true' ? './' : (process.env.REPO_NAME ? `/${process.env.REPO_NAME}/` : '/'),
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: [
        '**/content/**',
        '**/public/content.json',
        '**/public/content-pages/**',
        '**/public/search-index.json'
      ]
    }
  }
}))
