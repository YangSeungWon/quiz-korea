import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Custom domain: quiz-korea.ysw.kr
  server: {
    port: 10000,
    // Allow access via the ysw.kr reverse-proxy hosts (e.g. lab.ysw.kr)
    allowedHosts: ['.ysw.kr'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
