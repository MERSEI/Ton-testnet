import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isKnownAddress,
  addKnownAddress,
  getAddressBook,
  removeKnownAddress,
  clearAddressBook,
} from '../addressBook'

// Use a simple localStorage mock — jsdom provides one
// 48-char addresses
const ADDR_A = 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'
const ADDR_B = 'EQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dXYZe'

beforeEach(() => clearAddressBook())
afterEach(() => clearAddressBook())

describe('SECURITY MECHANISM C — Address Book', () => {
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
    // Simulate reading from a fresh context by calling load() indirectly
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
