/**
 * TON address utilities.
 *
 * TON uses base64url-encoded addresses (48 chars) in two forms:
 *   - bounceable   (EQ…)  – default for smart contracts
 *   - non-bounceable (UQ…) – recommended for plain wallets
 *
 * We accept both forms and normalise them for display.
 */

/** Validate a TON address (raw or user-friendly) */
export function isValidTonAddress(address: string): boolean {
  const trimmed = address.trim()

  // User-friendly format: 48 base64url chars (with + / - _)
  if (/^[UEkf][Qq0-9A-Za-z+/\-_]{47}$/.test(trimmed)) {
    return true
  }

  // Raw format: workchain:hex  e.g. 0:abc123…  (64 hex chars after colon)
  if (/^-?[0-9]+:[0-9a-fA-F]{64}$/.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Shorten an address for display: show first 6 and last 4 chars.
 * e.g.  EQBvW…3k9d
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
 * Studies show users compare only the first/last chars when verifying addresses.
 * By permanently emphasising those chars we encourage users to check at least
 * the corners of the address on every send, making prefix-swap attacks harder.
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

/** Format a TON amount (nanotons string | number) to human-readable TON */
export function formatTon(nanotons: string | number | bigint): string {
  const nano = BigInt(nanotons)
  const whole = nano / BigInt(1_000_000_000)
  const frac = nano % BigInt(1_000_000_000)
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : `${whole}`
}

/** Convert TON float string to nanotons bigint */
export function tonToNano(ton: string): bigint {
  const [whole, frac = ''] = ton.split('.')
  const fracPadded = frac.slice(0, 9).padEnd(9, '0')
  return BigInt(whole) * BigInt(1_000_000_000) + BigInt(fracPadded)
}
