import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Served from https://<user>.github.io/job-radar/, so every build needs that
// prefix. It is applied in dev too, deliberately: a base that differs between
// dev and production hides subpath bugs until deploy, and `vite preview`
// reports itself as a serve command, so switching on that silently serves the
// built site at the wrong root.
//
// Local URLs therefore also carry the prefix, e.g. http://localhost:5210/job-radar/.
// Anything that builds a URL at runtime must use import.meta.env.BASE_URL.
export default defineConfig(() => ({
  base: '/job-radar/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5210, strictPort: true },
  preview: { port: 5211, strictPort: true },
  build: {
    // pdf.js and mammoth are dynamically imported and split out on their own,
    // so a visitor who never uploads a CV never downloads either. three is a
    // static import because the globe is above the fold, but it is worth its
    // own chunk so it can be cached separately from the app code.
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
}))
