/**
 * Address Book – persisted in localStorage.
 *
 * SECURITY MECHANISM C – Address book / first-send warning:
 * When a user sends to an address they've never used before, we show a
 * warning: "You are sending to a new address for the first time."
 * Once a transaction to that address succeeds, the address is saved as
 * "familiar".  On future sends the warning is suppressed.
 *
 * Extension — similar-address detection:
 * If the entered address is unknown BUT shares its first 8 significant
 * characters (positions 2-9, skipping the 2-char format prefix that
 * encodes bounceable/workchain flags) with a KNOWN address, we surface
 * a stronger warning: "This address looks suspiciously similar to one
 * you've used before."  This catches prefix-swap attacks where an
 * attacker crafts an address that starts with the same characters as a
 * legitimate recipient.
 *
 * Address normalisation:
 * All addresses are stored and looked up in canonical non-bounceable
 * user-friendly form (UQ…) via normalizeAddress().  This means EQ…,
 * UQ…, and raw 0:hex… for the same account are treated as identical,
 * preventing "same wallet different format" false positives.
 */

import { normalizeAddress } from './address'
import type { TonTransaction } from '../api/tonCenter'

const STORAGE_KEY = 'ton_address_book'

export type AddressEntry = {
  address: string   // always stored in normalised (UQ…) form
  label?: string
  addedAt: number   // unix ms
}

function load(): Record<string, AddressEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, AddressEntry>) : {}
  } catch {
    return {}
  }
}

function save(book: Record<string, AddressEntry>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(book))
}

/** Returns true if this address (in any format) has been used successfully before */
export function isKnownAddress(address: string): boolean {
  const book = load()
  return normalizeAddress(address) in book
}

/** Mark address as known (call after a successful transaction) */
export function addKnownAddress(address: string, label?: string): void {
  const book = load()
  const norm = normalizeAddress(address)
  if (!(norm in book)) {
    book[norm] = { address: norm, label, addedAt: Date.now() }
    save(book)
  }
}

/**
 * Detect suspiciously similar known addresses.
 *
 * Two TON user-friendly addresses share the same "account prefix" if
 * characters at positions 2–9 are identical.  Those 8 chars encode the
 * first ~36 bits of the 32-byte account hash, so a match indicates the
 * attacker deliberately chose an address starting like a known recipient.
 *
 * We skip positions 0-1 because they encode the flags byte (bounceable /
 * workchain), which differs between EQ and UQ forms of the SAME account.
 *
 * Returns the first matching known entry, or null if none.
 */
export function findSimilarKnownAddress(address: string): AddressEntry | null {
  const norm = normalizeAddress(address)
  const book = load()

  // Need at least 10 chars to have a meaningful prefix to compare
  if (norm.length < 10) return null

  const needle = norm.slice(2, 10)  // 8 chars of account payload

  for (const entry of Object.values(book)) {
    const entryNorm = normalizeAddress(entry.address)
    if (entryNorm === norm) continue  // identical — not "similar", it's known

    if (entryNorm.length >= 10 && entryNorm.slice(2, 10) === needle) {
      return entry
    }
  }
  return null
}

/** Return all known addresses sorted newest-first */
export function getAddressBook(): AddressEntry[] {
  return Object.values(load()).sort((a, b) => b.addedAt - a.addedAt)
}

/** Remove an address from the book (for testing or manual cleanup) */
export function removeKnownAddress(address: string): void {
  const book = load()
  delete book[normalizeAddress(address)]
  save(book)
}

/** Completely wipe the address book (useful in tests) */
export function clearAddressBook(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Seed the address book from the wallet's on-chain transaction history.
 *
 * This solves the "imported wallet loses context" problem: when a user
 * imports an existing mnemonic, their past recipients are already on-chain
 * but the local address book is empty.  By seeding from history we avoid
 * false-positive first-send warnings for addresses they've paid many times.
 *
 * Only outgoing transactions are seeded (we've sent TO those addresses).
 * Timestamps are taken from the blockchain, preserving accurate history.
 */
export function seedAddressBookFromHistory(transactions: TonTransaction[]): void {
  const book = load()
  let changed = false
  for (const tx of transactions) {
    if (tx.type === 'out' && tx.address) {
      const norm = normalizeAddress(tx.address)
      if (norm && !(norm in book)) {
        book[norm] = { address: norm, addedAt: tx.timestamp * 1000 }
        changed = true
      }
    }
  }
  if (changed) save(book)
}
