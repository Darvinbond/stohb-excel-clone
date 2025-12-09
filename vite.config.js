import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    host: true, // Expose to LAN
    https: true, // Enable HTTPS
    proxy: {
      '/socket.io': {
        target: 'http://localhost:9000', // Proxy socket requests to our HTTP server
        ws: true,
        secure: false
      }
    }
  }
})
