import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The backend only listens on 127.0.0.1 (see backend/src/server.ts).
const BACKEND = 'http://127.0.0.1:4317';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // Must match the backend FRONTEND_ORIGIN (http://localhost:5173): the proxy
    // forwards the browser's Origin header, and the backend rejects any other origin.
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND },
      '/ws': { target: BACKEND, ws: true },
    },
  },
});
