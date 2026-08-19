/**
 * TON address utilities.
 *
 * TON user-friendly addresses are 48 base64(url) characters that encode a flags
 * byte, the workchain, the 32-byte account hash and a CRC16 checksum. The flags
 * byte is what produces the familiar prefixes:
 *
 *   EQ… bounceable      mainnet-flagged      UQ… non-bounceable  mainnet-flagged
 *   kQ… bounceable      test-only flag       0Q… non-bounceable  test-only flag
 *
 * Validation goes through @ton/ton rather than a regex on purpose: the regex
 * that used to live here accepted any 48-char base64 string, so a single mistyped
 * character passed validation and the transfer was broadcast to whatever account
 * that garbage decoded to. The CRC16 checksum exists precisely to catch that, and
 * only a real decoder checks it. The old regex also rejected the `0Q…` form —
 * which is the exact form this wallet generates for itself — making it impossible
 * to send between two users of this app.
 */

import { Address } from '@ton/ton'

export type ParsedAddress = {
  /** Canonical non-bounceable, test-only form (0Q…) — our internal key form */
  canonical: string
  /** true when the flags byte carries the test-only bit (kQ… / 0Q…) */
  isTestOnly: boolean
  /** true when the flags byte marks the address bounceable (EQ… / kQ…) */
  isBounceable: boolean
  /** The decoded address object */
  address: Address
}

/** Raw form: workchain:64-hex, e.g. 0:abc… */
const RAW_RE = /^-?\d+:[0-9a-fA-F]{64}$/

/**
 * Decode and checksum-verify an address in any accepted form.
 * Returns null when the input is not a valid TON address.
 */
export function parseTonAddress(input: string): ParsedAddress | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Address.parse accepts both friendly and raw forms and verifies the CRC of
  // friendly ones. Raw forms carry no checksum, hence the explicit shape guard.
  const looksFriendly = !trimmed.includes(':')
  if (!looksFriendly && !RAW_RE.test(trimmed)) return null

  let address: Address
  try {
    address = Address.parse(trimmed)
  } catch {
    return null
  }

  let isTestOnly = false
  let isBounceable = true
  if (looksFriendly) {
    try {
      const info = Address.parseFriendly(trimmed)
      isTestOnly = info.isTestOnly
      isBounceable = info.isBounceable
    } catch {
      return null
    }
  } else {
    // Raw form carries no flags; treat it as non-bounceable so a transfer to a
    // not-yet-deployed account is not silently burned.
    isBounceable = false
  }

  return {
    canonical: address.toString({ urlSafe: true, bounceable: false, testOnly: true }),
    isTestOnly,
    isBounceable,
    address,
  }
}

/**
 * Normalise any valid TON address to the canonical non-bounceable, test-only
 * user-friendly form (0Q…).
 *
 * The test-only flag is preserved deliberately: this wallet derives its own
 * address with `testOnly: true`, so dropping the flag here made a wallet's own
 * address compare unequal to itself — breaking self-send detection and address
 * book lookups. Falls back to the trimmed original on parse failure so callers
 * still get a stable key for unparseable input.
 */
export function normalizeAddress(address: string): string {
  return parseTonAddress(address)?.canonical ?? address.trim()
}

/**
 * Validate a TON address (raw or user-friendly), checksum included.
 */
export function isValidTonAddress(address: string): boolean {
  return parseTonAddress(address) !== null
}

/** True when two addresses refer to the same account, regardless of form. */
export function isSameAddress(a: string, b: string): boolean {
  const pa = parseTonAddress(a)
  const pb = parseTonAddress(b)
  if (!pa || !pb) return false
  return pa.canonical === pb.canonical
}

/**
 * Shorten an address for display: show first `prefix` and last `suffix` chars.
 * e.g. EQBvW…3k9d
 */
export function shortenAddress(address: string, prefix = 6, suffix = 4): string {
  if (address.length <= prefix + suffix) return address
  return `${address.slice(0, prefix)}…${address.slice(-suffix)}`
}

/**
 * Split an address into three parts for visual highlighting:
 * [highlighted-prefix, middle, highlighted-suffix]
 *
 * SECURITY MECHANISM A – Visual highlighting:
 * Users compare only the first/last chars when verifying addresses. By
 * permanently emphasising those chars we encourage checking at least the corners
 * of the address on every send, making prefix-swap attacks harder.
 */
export function splitAddressForHighlight(
  address: string,
  prefixLen = 6,
  suffixLen = 4,
): [string, string, string] {
  if (address.length <= prefixLen + suffixLen) return [address, '', '']
  return [
    address.slice(0, prefixLen),
    address.slice(prefixLen, address.length - suffixLen),
    address.slice(-suffixLen),
  ]
}

/** Format a TON amount (nanotons string | number | bigint) to human-readable TON */
export function formatTon(nanotons: string | number | bigint): string {
  let nano: bigint
  try {
    nano = BigInt(nanotons)
  } catch {
    return '0'
  }
  const negative = nano < BigInt(0)
  if (negative) nano = -nano
  const whole = nano / BigInt(1_000_000_000)
  const frac = nano % BigInt(1_000_000_000)
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '')
  const body = fracStr ? `${whole}.${fracStr}` : `${whole}`
  return negative ? `-${body}` : body
}

/**
 * Convert a decimal TON string to nanotons.
 *
 * Throws on anything that is not a plain non-negative decimal number: this feeds
 * the value of a transfer, so silently coercing junk (`"1e9"`, `"1.2.3"`, `""`)
 * to a number is not acceptable.
 */
export function tonToNano(ton: string): bigint {
  const trimmed = ton.trim()
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error('Invalid TON amount')
  }
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = frac.slice(0, 9).padEnd(9, '0')
  return BigInt(whole || '0') * BigInt(1_000_000_000) + BigInt(fracPadded)
}
