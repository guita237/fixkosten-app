import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Im Dev-Modus leitet Vite /api an das Backend weiter (kein CORS nötig)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:5000',
    },
  },
});
