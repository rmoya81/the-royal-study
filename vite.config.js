import { defineConfig } from 'vite';

// Build config tuned for a small, fast-loading 3D game.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep three.js in its own cacheable chunk.
          three: ['three'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
