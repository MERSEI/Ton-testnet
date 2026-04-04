import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isKnownAddress,
  addKnownAddress,
  getAddressBook,
  removeKnownAddress,
  clearAddressBook,
  findSimilarKnownAddress,
  seedAddressBookFromHistory,
} from '../addressBook'
import type { TonTransaction } from '../../api/tonCenter'

// 48-char test addresses (NOT valid TON — wrong CRC — so normalizeAddress falls back to original).
// ADDR_A chars 2-9 (0-based): 'BvWWFP2p'
const ADDR_A = 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'
// ADDR_B has DIFFERENT chars 2-9: 'ZZZZZZZZZn' → 'ZZZZZZZZ'  (no shared prefix with ADDR_A)
const ADDR_B = 'UQZZZZZZZZnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dXYZe'

// Deliberately crafted to share positions 2-9 with ADDR_A ('BvWWFP2p')
// but differ in the rest — simulates a prefix-swap attack target.
const ADDR_SIMILAR_TO_A = 'UQBvWWFP2pZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'

beforeEach(() => clearAddressBook())
afterEach(() => clearAddressBook())

describe('SECURITY MECHANISM C — Address Book (core)', () => {
  it('returns false for unknown address', () => {
    expect(isKnownAddress(ADDR_A)).toBe(false)
  })

  it('returns true after adding address', () => {
    addKnownAddress(ADDR_A)
    expect(isKnownAddress(ADDR_A)).toBe(true)
  })

  it('keeps different addresses independent', () => {
    addKnownAddress(ADDR_A)
    expect(isKnownAddress(ADDR_B)).toBe(false)
  })

  it('does not duplicate entries', () => {
    addKnownAddress(ADDR_A)
    addKnownAddress(ADDR_A)
    const book = getAddressBook()
    expect(book.filter(e => e.address === ADDR_A)).toHaveLength(1)
  })

  it('stores label when provided', () => {
    addKnownAddress(ADDR_A, 'Exchange')
    const book = getAddressBook()
    const entry = book.find(e => e.address === ADDR_A)
    expect(entry?.label).toBe('Exchange')
  })

  it('getAddressBook returns all entries', () => {
    addKnownAddress(ADDR_A)
    addKnownAddress(ADDR_B)
    expect(getAddressBook()).toHaveLength(2)
  })

  it('removeKnownAddress removes the entry', () => {
    addKnownAddress(ADDR_A)
    removeKnownAddress(ADDR_A)
    expect(isKnownAddress(ADDR_A)).toBe(false)
  })

  it('clearAddressBook empties the book', () => {
    addKnownAddress(ADDR_A)
    addKnownAddress(ADDR_B)
    clearAddressBook()
    expect(getAddressBook()).toHaveLength(0)
  })

  it('persists across function calls (via localStorage)', () => {
    addKnownAddress(ADDR_A)
    expect(isKnownAddress(ADDR_A)).toBe(true)
  })

  it('each entry has an addedAt timestamp', () => {
    const before = Date.now()
    addKnownAddress(ADDR_A)
    const after = Date.now()
    const entry = getAddressBook()[0]
    expect(entry.addedAt).toBeGreaterThanOrEqual(before)
    expect(entry.addedAt).toBeLessThanOrEqual(after)
  })
})

describe('SECURITY MECHANISM C — Similar address detection (P1 fix)', () => {
  it('returns null when address book is empty', () => {
    expect(findSimilarKnownAddress(ADDR_A)).toBeNull()
  })

  it('returns null when address is already known (exact match, not "similar")', () => {
    addKnownAddress(ADDR_A)
    expect(findSimilarKnownAddress(ADDR_A)).toBeNull()
  })

  it('returns null when address shares no prefix with any known address', () => {
    addKnownAddress(ADDR_A)
    expect(findSimilarKnownAddress(ADDR_B)).toBeNull()
  })

  it('detects an address that shares positions 2-9 with a known address', () => {
    // ADDR_A chars 2-9: ADDR_A.slice(2,10) = 'BvWWFP2p'
    // ADDR_SIMILAR_TO_A chars 2-9: 'BvWWFP2p' — same!
    addKnownAddress(ADDR_A)
    const found = findSimilarKnownAddress(ADDR_SIMILAR_TO_A)
    expect(found).not.toBeNull()
    expect(found!.address).toBe(ADDR_A)
  })

  it('does not flag completely different addresses as similar', () => {
    // ADDR_B has chars 2-9 = 'ZZZZZZZZ' — different from ADDR_A 'BvWWFP2p'
    addKnownAddress(ADDR_B)
    expect(findSimilarKnownAddress(ADDR_A)).toBeNull()
  })

  it('returns null for a very short address (cannot compute prefix)', () => {
    addKnownAddress(ADDR_A)
    expect(findSimilarKnownAddress('SHORT')).toBeNull()
  })
})

describe('Address book — seed from history (P2 fix)', () => {
  function makeTx(type: 'in' | 'out', address: string): TonTransaction {
    return {
      hash: 'hash' + Math.random(),
      lt: '1',
      timestamp: Math.floor(Date.now() / 1000),
      type,
      amount: '1000000000',
      address,
      fee: '5000000',
    }
  }

  it('seeds outgoing transaction destinations as known', () => {
    seedAddressBookFromHistory([makeTx('out', ADDR_A)])
    expect(isKnownAddress(ADDR_A)).toBe(true)
  })

  it('does NOT seed incoming transaction sources', () => {
    seedAddressBookFromHistory([makeTx('in', ADDR_A)])
    expect(isKnownAddress(ADDR_A)).toBe(false)
  })

  it('does not duplicate already-known addresses', () => {
    addKnownAddress(ADDR_A)
    seedAddressBookFromHistory([makeTx('out', ADDR_A), makeTx('out', ADDR_A)])
    expect(getAddressBook().filter(e => e.address === ADDR_A)).toHaveLength(1)
  })

  it('seeds multiple destinations from history', () => {
    seedAddressBookFromHistory([makeTx('out', ADDR_A), makeTx('out', ADDR_B)])
    expect(isKnownAddress(ADDR_A)).toBe(true)
    expect(isKnownAddress(ADDR_B)).toBe(true)
  })

  it('is idempotent — seeding twice does not change timestamps', () => {
    seedAddressBookFromHistory([makeTx('out', ADDR_A)])
    const firstBook = getAddressBook()
    const firstTs = firstBook[0].addedAt
    seedAddressBookFromHistory([makeTx('out', ADDR_A)])
    const secondBook = getAddressBook()
    expect(secondBook[0].addedAt).toBe(firstTs)
  })
})
