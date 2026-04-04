/**
 * Browser polyfills — must be imported BEFORE any @ton/* library.
 *
 * Problem: @ton/ton and @ton/crypto are Node.js-compatible packages that
 * reference the global `Buffer` (and sometimes `global`) at module
 * initialisation time.  In a browser environment bundled with Vite, neither
 * `Buffer` nor `global` are defined by default.
 *
 * Fix:
 *  1. The `buffer` npm package is a browser-compatible polyfill of Node's
 *     Buffer.  We import it explicitly and assign it to `globalThis.Buffer`
 *     so every subsequent module sees it as a global.
 *  2. We also alias `global → globalThis` in vite.config.ts (define option)
 *     so that CJS modules that reference `global` work without errors.
 *
 * This file must be the FIRST import in main.tsx.
 */

import { Buffer } from 'buffer'

// Make Buffer a true browser global — equivalent to what Node provides.
// The nullish-assignment guard avoids overwriting an already-existing Buffer
// (e.g., in test environments that have their own polyfill via jsdom).
if (typeof (globalThis as Record<string, unknown>)['Buffer'] === 'undefined') {
  ;(globalThis as Record<string, unknown>)['Buffer'] = Buffer
}
