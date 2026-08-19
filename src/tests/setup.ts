/**
 * Vitest setup.
 *
 * Pure-logic suites (crypto) opt into the `node` environment via a
 * `@vitest-environment node` docblock — @ton/crypto feeds Buffers to tweetnacl's
 * `instanceof Uint8Array` check, which fails across the jsdom/Node realm boundary
 * even though it is fine in a real browser. jest-dom is imported unconditionally
 * because it only registers matchers on `expect`.
 */
import '@testing-library/jest-dom'
