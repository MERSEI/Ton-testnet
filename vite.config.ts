import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Content-Security-Policy for the production bundle.
 *
 * This page holds a private key in sessionStorage, so limiting where script can
 * come from and where data can be sent to is a real mitigation rather than
 * paperwork: `connect-src` means injected code cannot exfiltrate the key to an
 * arbitrary host, and `script-src 'self'` blocks remote payloads.
 *
 * 'unsafe-inline' is required for style-src because the UI uses React inline
 * style attributes throughout. Ideally the app would be served with these as real
 * response headers (a meta tag cannot express frame-ancestors); the meta tag is
 * what a static, backend-less deployment can guarantee on its own.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://testnet.toncenter.com",
  "form-action 'none'",
].join('; ')

/**
 * Inject the CSP into the built HTML only.
 *
 * In dev, @vitejs/plugin-react injects an inline react-refresh preamble, which a
 * strict script-src would block — so the policy is applied at build time.
 */
function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), cspPlugin()],

  /**
   * Polyfill Node.js globals for @ton/ton and @ton/crypto.
   *
   * `global` — some CJS bundles inside @ton/* reference `global` directly.
   *            Replacing it with `globalThis` is the safe browser equivalent.
   *
   * Buffer is NOT listed in `define` because it is a runtime value, not a
   * compile-time constant. Instead we polyfill it in src/polyfills.ts which is
   * imported first in main.tsx.
   */
  define: {
    global: 'globalThis',
  },

  resolve: {
    alias: {
      '@': '/src',
      // Ensure any transitive `require('buffer')` / `import 'buffer'` resolves to
      // the browser-compatible npm package instead of an empty shim.
      buffer: 'buffer/',
    },
  },

  optimizeDeps: {
    // Pre-bundle the buffer polyfill so Vite doesn't skip it during dev.
    include: ['buffer'],
  },

  build: {
    rollupOptions: {
      output: {
        // The @ton/* + crypto stack dominates the bundle and changes far less
        // often than app code; splitting it keeps the app chunk cacheable.
        //
        // The 'polyfill' chunk is load-bearing, not a size optimisation. When
        // src/polyfills.ts ends up inside the app chunk, its body runs *after*
        // every chunk that chunk imports — including 'ton', which reads Buffer
        // at module init. That is a blank page in production (dev is unaffected
        // because Vite serves unbundled modules in source order).
        //
        // Giving the polyfill its own chunk makes it a sibling import that
        // Rollup emits ahead of 'ton', mirroring the import order in main.tsx,
        // so globalThis.Buffer exists before @ton/* touches it. Keep polyfills
        // as the first import in main.tsx, and verify with `npm run build &&
        // npm run preview` — never with `npm run dev`.
        manualChunks(id) {
          if (id.includes('src/polyfills') || id.includes('node_modules/buffer/')) return 'polyfill'
          if (id.includes('@ton/')) return 'ton'
          if (id.includes('node_modules/react')) return 'react'
        },
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/tests/**', 'src/main.tsx', 'src/polyfills.ts'],
    },
  },
})
