import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
// `npm run dev`       → http://localhost:5173 (this PC)
// `npm run dev:phone` → https://<this PC's IP>:5174 — phones only allow the camera (POS scanning) on https pages.
//   It uses a self-signed certificate: the first time, the phone warns that the connection is not private; continue once.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl({ name: 'hq-inventory' })] : [])],
  server: {
    port: mode === 'phone' ? 5174 : 5173,
    strictPort: true,
    // Listen on the local network too, so phones and tablets on the same Wi-Fi can open the app
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      },
      // Live updates go through the same address as the page (works from a phone, not only this PC)
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true
      }
    }
  }
}))
