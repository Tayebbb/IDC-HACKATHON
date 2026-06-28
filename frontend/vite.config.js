import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build',
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Smarter chunk splitting: isolate heavy libraries so they don't
        // get accidentally co-bundled into a single page chunk (e.g. the
        // 1.5 MB Profile.js that pulled in face-api + html2canvas + jspdf).
        manualChunks: {
          vendor:    ['react', 'react-dom', 'react-router-dom'],
          firebase:  ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui:        ['framer-motion', 'lucide-react'],
          charts:    ['chart.js', 'react-chartjs-2'],
          faceapi:   ['@vladmandic/face-api'],
          pdf:       ['@react-pdf/renderer', 'jspdf'],
          markdown:  ['react-markdown'],
          flow:      ['@xyflow/react'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
    },
    reportCompressedSize: false, // faster builds, gzip sizes still in logs
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
    ],
  },
})
