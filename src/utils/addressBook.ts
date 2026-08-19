/**
 * Address Book – persisted in localStorage.
 *
 * SECURITY MECHANISM C – Address book / first-send warning:
 * When a user sends to an address they have never used before, we warn. Once a
 * transaction to that address succeeds, the address is saved as "familiar" and
 * the warning is suppressed on future sends.
 *
 * Provenance matters. Entries come from two sources:
 *   'sent'    – this device broadcast a transfer to the address. Trusted.
 *   'history' – seeded from the on-chain transaction list returned by TON Center.
 *
 * 'history' entries solve the "imported wallet loses context" problem, but they
 * are derived from third-party API output. A compromised or malicious endpoint
 * could inject a fabricated outgoing transaction and thereby silence the
 * first-send warning for the attacker's own address — turning Mechanism C off
 * exactly when it matters. So seeded entries are tagged and the UI treats them as
 * weaker evidence instead of full familiarity.
 *
 * Address normalisation: everything is stored and looked up in canonical
 * non-bounceable test-only form (0Q…) via normalizeAddress(), so EQ…, UQ…, kQ…,
 * 0Q… and raw 0:hex… for one account are treated as the same entry.
 */

import { normalizeAddress, parseTonAddress } from './address'
import type { TonTransaction } from '../api/tonCenter'

const STORAGE_KEY = 'ton_address_book'
/** Guard against unbounded localStorage growth. */
const MAX_ENTRIES = 500

export type AddressSource = 'sent' | 'history'

export type AddressEntry = {
  address: string   // always stored in normalised (0Q…) form
  label?: string
  addedAt: number   // unix ms
  /** Where this entry came from. Absent in books written by older versions → 'sent'. */
  source?: AddressSource
}

/** Why an unknown address was flagged as resembling a known one. */
export type SimilarityReason = 'corners' | 'prefix' | 'suffix'

export type SimilarMatch = {
  entry: AddressEntry
  reason: SimilarityReason
}

function load(): Record<string, AddressEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, AddressEntry>
  } catch {
    return {}
  }
}

function save(book: Record<string, AddressEntry>): void {
  try {
    let entries = Object.entries(book)
    if (entries.length > MAX_ENTRIES) {
      // Drop the oldest entries first.
      entries = entries
        .sort((a, b) => (b[1].addedAt ?? 0) - (a[1].addedAt ?? 0))
        .slice(0, MAX_ENTRIES)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    /* storage full or unavailable (private mode) — the book is a convenience, not a requirement */
  }
}

/** The stored entry for an address in any format, or null. */
export function getKnownAddress(address: string): AddressEntry | null {
  const entry = load()[normalizeAddress(address)]
  if (!entry) return null
  return { ...entry, source: entry.source ?? 'sent' }
}

/** Returns true if this address (in any format) is in the book at all. */
export function isKnownAddress(address: string): boolean {
  return getKnownAddress(address) !== null
}

/**
 * True only for addresses this device actually sent to.
 *
 * The Send screen uses this — rather than isKnownAddress — to decide whether the
 * first-send warning may be fully suppressed.
 */
export function isConfirmedAddress(address: string): boolean {
  return getKnownAddress(address)?.source === 'sent'
}

/** Mark address as known (call after a successful transaction) */
export function addKnownAddress(address: string, label?: string): void {
  const book = load()
  const norm = normalizeAddress(address)
  if (!norm) return
  const existing = book[norm]
  // A confirmed send always upgrades a 'history' entry, and refreshes the label.
  book[norm] = {
    address: norm,
    label: label ?? existing?.label,
    addedAt: existing?.addedAt ?? Date.now(),
    source: 'sent',
  }
  save(book)
}

/**
 * Detect a known address that an unknown one suspiciously resembles.
 *
 * Vanity-address generators can brute-force both ends of an address, so we check
 * three overlapping patterns, strongest first:
 *
 *   'corners' – the exact characters Mechanism A highlights (first 6 + last 4)
 *               both match. An attacker who achieves this defeats the visual
 *               check entirely, so this is the most dangerous case.
 *   'prefix'  – characters 2–9 match. Positions 0–1 are skipped because they
 *               encode the flags byte, which differs between forms of the same
 *               account.
 *   'suffix'  – the last 6 characters match.
 *
 * Returns the strongest match, or null.
 */
export function findSimilarKnownAddress(address: string): SimilarMatch | null {
  const norm = normalizeAddress(address)
  if (norm.length < 12) return null

  const book = load()
  const needlePrefix = norm.slice(2, 10)
  const needleCornerHead = norm.slice(0, 6)
  const needleCornerTail = norm.slice(-4)
  const needleSuffix = norm.slice(-6)

  let prefixMatch: AddressEntry | null = null
  let suffixMatch: AddressEntry | null = null

  for (const raw of Object.values(book)) {
    const entry: AddressEntry = { ...raw, source: raw.source ?? 'sent' }
    const other = normalizeAddress(entry.address)
    if (other === norm) continue          // identical — known, not "similar"
    if (other.length < 12) continue

    const cornersMatch =
      other.slice(0, 6) === needleCornerHead && other.slice(-4) === needleCornerTail
    if (cornersMatch) return { entry, reason: 'corners' }

    if (!prefixMatch && other.slice(2, 10) === needlePrefix) prefixMatch = entry
    if (!suffixMatch && other.slice(-6) === needleSuffix) suffixMatch = entry
  }

  if (prefixMatch) return { entry: prefixMatch, reason: 'prefix' }
  if (suffixMatch) return { entry: suffixMatch, reason: 'suffix' }
  return null
}

/** Return all known addresses sorted newest-first */
export function getAddressBook(): AddressEntry[] {
  return Object.values(load())
    .map(e => ({ ...e, source: e.source ?? ('sent' as AddressSource) }))
    .sort((a, b) => b.addedAt - a.addedAt)
}

/** Remove an address from the book (for testing or manual cleanup) */
export function removeKnownAddress(address: string): void {
  const book = load()
  delete book[normalizeAddress(address)]
  save(book)
}

/** Completely wipe the address book (useful in tests and on logout) */
export function clearAddressBook(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Seed the address book from the wallet's on-chain transaction history.
 *
 * Only outgoing transactions are seeded — those are addresses we have sent TO.
 * Timestamps come from the blockchain, preserving accurate history. Entries are
 * tagged source:'history' (see the module comment on why that distinction is a
 * security property, not bookkeeping) and never downgrade an existing 'sent'
 * entry.
 */
export function seedAddressBookFromHistory(transactions: TonTransaction[]): void {
  const book = load()
  let changed = false
  for (const tx of transactions) {
    if (tx.type !== 'out' || !tx.address) continue
    // Only seed addresses that actually decode — never let API junk into the book.
    if (!parseTonAddress(tx.address)) continue
    const norm = normalizeAddress(tx.address)
    if (norm in book) continue
    book[norm] = { address: norm, addedAt: tx.timestamp * 1000, source: 'history' }
    changed = true
  }
  if (changed) save(book)
}
