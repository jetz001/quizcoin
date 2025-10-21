import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/merkle': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/data': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist-organized',
    sourcemap: true
  },
  define: {
    'process.env.VITE_API_URL': JSON.stringify('http://localhost:3001'),
    'process.env.VITE_BACKEND_TYPE': JSON.stringify('organized')
  }
})
