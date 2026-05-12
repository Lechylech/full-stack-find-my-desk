import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['harper-calgary-routes-phd.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:4000',
    },
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
  publicDir: resolve(__dirname, '../floorplans'),
});
