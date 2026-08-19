/**
 * Shared test fixtures.
 *
 * These are REAL TON addresses with valid CRC16 checksums, derived from the
 * mnemonic below (a throwaway testnet phrase). Hand-written 48-char strings are
 * useless for testing address validation now that the checksum is verified, and
 * using real values is what lets the tests prove the checksum path works.
 */

/** Throwaway testnet mnemonic — valid checksum. */
export const MNEMONIC_24 =
  'dose ice enrich trigger test dove century still betray gas diet dune use other base gym mad law immense village world example praise game'.split(
    ' ',
  )

/** All four user-friendly forms of the SAME account derived from MNEMONIC_24. */
export const WALLET = {
  /** non-bounceable, test-only — the form this app generates for itself */
  nonBounceableTest: '0QDwzJzZsH2rII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTd7Pa',
  /** non-bounceable, mainnet flag */
  nonBounceableMain: 'UQDwzJzZsH2rII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTdwhQ',
  /** bounceable, test-only */
  bounceableTest: 'kQDwzJzZsH2rII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTd-4f',
  /** bounceable, mainnet flag */
  bounceableMain: 'EQDwzJzZsH2rII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTd1WV',
  /** raw workchain:hex */
  raw: '0:f0cc9cd9b07dab208f52bf892b006221227d76a448428f82d870a6bc8dd5d377',
} as const

/** The canonical form every other form normalises to. */
export const WALLET_CANONICAL = WALLET.nonBounceableTest

/** Three other real, unrelated accounts (observed on testnet). */
export const PEER_A = {
  bounceable: 'EQB8D0jMgaptSs8Jr79WLmFumjm3WxhTT8GyfP_gyRaaSQj5',
  canonical: '0QB8D0jMgaptSs8Jr79WLmFumjm3WxhTT8GyfP_gyRaaSe62',
} as const

export const PEER_B = {
  bounceable: 'EQD_N0hrgbiQzAh72500KZbYU76VOOEg5RxIu4unxZGhAdXC',
  canonical: '0QD_N0hrgbiQzAh72500KZbYU76VOOEg5RxIu4unxZGhATON',
} as const

export const PEER_C = {
  bounceable: 'EQCSES0TZYqcVkgoguhIb8iMEo4cvaEwmIrU5qbQgnN8fmvP',
  canonical: '0QCSES0TZYqcVkgoguhIb8iMEo4cvaEwmIrU5qbQgnN8fo2A',
} as const

/**
 * WALLET.nonBounceableTest with one character of the payload flipped.
 * Passes any 48-char base64 regex; fails the checksum.
 */
export const CHECKSUM_BROKEN = '0QDwzJzZsHarII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTd7Pa'

/**
 * Synthetic 48-char strings used only for the look-alike detection tests.
 *
 * These are intentionally NOT valid TON addresses: normalizeAddress falls back to
 * the trimmed original for unparseable input, so they land in the address book
 * verbatim, which is what lets us construct exact prefix/suffix collisions that
 * a real vanity-address grinder would have to brute-force.
 */
export const FAKE = {
  base: 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd',
  /** shares chars 2–9 with base */
  samePrefix: 'UQBvWWFP2pZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
  /** shares the last 6 chars with base ('9dABCd'), nothing else */
  sameSuffix: `UQ${'Z'.repeat(40)}9dABCd`,
  /** shares first 6 AND last 4 with base — defeats the visual corner check */
  sameCorners: 'UQBvWWZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZABCd',
  /** shares nothing with base */
  unrelated: 'UQZZQQQQQQnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dXYZe',
} as const
