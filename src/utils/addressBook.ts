/**
 * Address Book – persisted in localStorage.
 *
 * SECURITY MECHANISM C – Address book / first-send warning:
 * When a user sends to an address they've never used before, we show a modal
 * warning: "You are sending to a new address for the first time."
 * Once a transaction to that address succeeds, the address is saved as
 * "familiar".  On future sends the warning is suppressed.
 *
 * Rationale: clipboard hijackers and phishing sites typically substitute a
 * different address each time.  If the user has a history with the address,
 * the risk of substitution is much lower.
 */

const STORAGE_KEY = 'ton_address_book'

export type AddressEntry = {
  address: string
  label?: string
  addedAt: number // unix ms
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

/** Returns true if this address has been used successfully before */
export function isKnownAddress(address: string): boolean {
  const book = load()
  return address in book
}

/** Mark address as known (call after a successful transaction) */
export function addKnownAddress(address: string, label?: string): void {
  const book = load()
  if (!(address in book)) {
    book[address] = { address, label, addedAt: Date.now() }
    save(book)
  }
}

/** Return all known addresses */
export function getAddressBook(): AddressEntry[] {
  return Object.values(load()).sort((a, b) => b.addedAt - a.addedAt)
}

/** Remove an address from the book (for testing or manual cleanup) */
export function removeKnownAddress(address: string): void {
  const book = load()
  delete book[address]
  save(book)
}

/** Completely wipe the address book (useful in tests) */
export function clearAddressBook(): void {
  localStorage.removeItem(STORAGE_KEY)
}
