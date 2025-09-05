// frontend/vite.config.js - Fix API proxy configuration
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Frontend port
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: 'http://localhost:8000', // Backend port
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/admin': {
        target: 'http://localhost:8000', // Backend port  
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    // Define environment variables for frontend
    __API_URL__: JSON.stringify('http://localhost:8000'),
  }
})