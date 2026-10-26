import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base so it works on GitHub Pages (e.g. username.github.io/repo/) or any subpath
  base: './',
  server: {
    port: 5173,
    host: true
  }
})
