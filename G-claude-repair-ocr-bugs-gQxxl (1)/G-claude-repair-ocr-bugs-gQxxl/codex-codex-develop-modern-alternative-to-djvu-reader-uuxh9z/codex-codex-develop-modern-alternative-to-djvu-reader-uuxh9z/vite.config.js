// ─── Vite Build Configuration ───────────────────────────────────────────────
// Production bundler for NovaReader. Bundles app/ into dist-vite/ with
// tree-shaking, minification, and code splitting.
//
// Usage:
//   npx vite build          — Production build to dist-vite/
//   npx vite --config vite.config.js  — Dev server (for browser testing)
//
// Electron still loads app/index.html directly in development.
// For production Electron builds, point electron-builder at dist-vite/.

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'app',
  base: './',

  build: {
    outDir: resolve(__dirname, 'dist-vite'),
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,

    rollupOptions: {
      input: resolve(__dirname, 'app/index.html'),
      output: {
        // Code splitting: separate chunks for large dependencies
        manualChunks: {
          'pdf-lib': ['pdf-lib'],
          'docx': ['docx'],
        },
        // Asset file naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },

    // Performance thresholds
    chunkSizeWarningLimit: 800, // KB — pdf-lib is ~500KB
  },

  resolve: {
    alias: {
      // Map importmap entries to node_modules for Vite resolution
      'pdf-lib': resolve(__dirname, 'node_modules/pdf-lib/dist/pdf-lib.esm.min.js'),
      'docx': resolve(__dirname, 'node_modules/docx/dist/index.mjs'),
    },
  },

  // Optimize dependencies for faster dev server startup
  optimizeDeps: {
    include: ['pdf-lib', 'docx'],
    exclude: ['electron'],
  },

  server: {
    port: 5173,
    open: false,
    // Allow loading worker scripts and wasm from node_modules
    fs: {
      allow: ['..'],
    },
  },

  // Environment variables
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '2.0.0-alpha'),
  },
});
