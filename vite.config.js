// ─── Vite Build Configuration for Tauri + Web ───────────────────────────────
//
// Usage:
//   npm run dev           — Vite dev server (for browser testing or Tauri dev)
//   npm run build         — Production build to dist/ (minified)
//   npm run build:dev     — Dev build without minification
//   npm run tauri:dev     — Tauri dev mode (opens native window)
//   npm run tauri:build   — Tauri production build (creates installer)

import { defineConfig } from 'vite';
import { resolve } from 'path';
// Tauri sets TAURI_DEV_HOST for mobile dev
const host = process.env.TAURI_DEV_HOST;
const isDebug = !!process.env.TAURI_ENV_DEBUG;

// Remove <script type="importmap"> from production HTML — Vite bundles these deps.
// Only applies during build; dev server needs the importmap for bare import resolution.
function removeImportMapPlugin() {
  return {
    name: 'remove-importmap',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/g, '');
    },
  };
}

export default defineConfig({
  plugins: [removeImportMapPlugin()],
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
    target: isDebug
      ? 'esnext'
      : process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari14',
    minify: !isDebug ? 'esbuild' : false,
    // No source maps in production (obfuscated code shouldn't be mappable)
    sourcemap: isDebug ? true : false,

    rollupOptions: {
      input: resolve(__dirname, 'app/index.html'),
      // Optional deps loaded via try/catch dynamic import — don't fail build
      external: ['katex'],
      output: {
        manualChunks: {
          'pdf-lib': ['pdf-lib', '@pdf-lib/fontkit'],
          'pdfjs': ['pdfjs-dist'],
          'docx': ['docx'],
          'fflate': ['fflate'],
          'tesseract': ['tesseract.js'],
        },
        assetFileNames: 'assets/[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },

    chunkSizeWarningLimit: 600,
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
    exclude: ['tesseract.js', 'pdfjs-dist'],
  },

  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '4.0.0'),
  },
});
