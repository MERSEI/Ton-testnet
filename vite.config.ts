import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  /**
   * Polyfill Node.js globals for @ton/ton and @ton/crypto.
   *
   * `global` — some CJS bundles inside @ton/* reference `global` directly.
   *            Replacing it with `globalThis` is the safe browser equivalent.
   *
   * Buffer is NOT listed in `define` because it is a runtime value, not a
   * compile-time constant.  Instead we polyfill it in src/polyfills.ts which
   * is imported first in main.tsx.
   */
  define: {
    global: 'globalThis',
  },

  resolve: {
    alias: {
      '@': '/src',
      // Ensure any transitive `require('buffer')` / `import 'buffer'`
      // resolves to the browser-compatible npm package instead of an empty shim.
      buffer: 'buffer/',
    },
  },

  optimizeDeps: {
    // Pre-bundle the buffer polyfill so Vite doesn't skip it during dev.
    include: ['buffer'],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
})
