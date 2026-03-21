// ─── Vite Build Configuration for Tauri + Web ───────────────────────────────
//
// Usage:
//   npm run dev           — Vite dev server (for browser testing or Tauri dev)
//   npm run build         — Production build to dist/
//   npm run tauri:dev     — Tauri dev mode (opens native window)
//   npm run tauri:build   — Tauri production build (creates installer)

import { defineConfig } from 'vite';
import { resolve } from 'path';

// Tauri sets TAURI_DEV_HOST for mobile dev
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: 'app',
  base: './',

  // Don't clear screen on HMR (Tauri logs are useful)
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 5174 }
      : undefined,
    watch: {
      // Don't watch Rust files — cargo handles that
      ignored: ['**/src-tauri/**'],
    },
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // WebView2 on Windows supports es2021+
    target: process.env.TAURI_ENV_PLATFORM === 'windows'
      ? 'chrome105'
      : 'safari14',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,

    rollupOptions: {
      input: resolve(__dirname, 'app/index.html'),
      output: {
        manualChunks: {
          'pdf-lib': ['pdf-lib'],
          'docx': ['docx'],
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },

    chunkSizeWarningLimit: 800,
  },

  resolve: {
    alias: {
      'pdf-lib': resolve(__dirname, 'node_modules/pdf-lib/dist/pdf-lib.esm.js'),
      'docx': resolve(__dirname, 'node_modules/docx/dist/index.mjs'),
      'pdfjs-dist/build/pdf.mjs': resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.mjs'),
    },
  },

  optimizeDeps: {
    include: ['pdf-lib', 'docx'],
    exclude: ['tesseract.js'],
  },

  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '4.0.0'),
  },
});
