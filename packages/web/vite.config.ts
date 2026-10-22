import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, `npm run dev` starts the API server and passes its port here.
const apiPort = process.env.DEVDRILL_API_PORT ?? '3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      // changeOrigin rewrites Host to the API server, which only accepts its own Host.
      '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // Monaco is large; it's loaded once from disk, so the warning isn't useful.
    chunkSizeWarningLimit: 5000,
  },
});
