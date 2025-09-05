import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy requests starting with '/api' to your backend server
      '/api': {
        target: 'http://localhost:8000', // ตรงกับ backend port
        changeOrigin: true,
        secure: false, // Set to true for HTTPS
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})