import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isKnownAddress,
  isConfirmedAddress,
  getKnownAddress,
  addKnownAddress,
  getAddressBook,
  removeKnownAddress,
  clearAddressBook,
  findSimilarKnownAddress,
  seedAddressBookFromHistory,
} from '../addressBook'
import type { TonTransaction } from '../../api/tonCenter'
import { WALLET, WALLET_CANONICAL, PEER_A, PEER_B, FAKE } from '../../tests/fixtures'

beforeEach(() => clearAddressBook())
afterEach(() => clearAddressBook())

function makeTx(type: 'in' | 'out', address: string, timestamp = 1_700_000_000): TonTransaction {
  return {
    hash: `hash-${Math.random()}`,
    lt: '1',
    timestamp,
    type,
    amount: '1000000000',
    address,
    fee: '5000000',
  }
}

describe('SECURITY MECHANISM C — Address Book (core)', () => {
  it('returns false for an unknown address', () => {
    expect(isKnownAddress(PEER_A.bounceable)).toBe(false)
  })

  it('returns true after adding an address', () => {
    addKnownAddress(PEER_A.bounceable)
    expect(isKnownAddress(PEER_A.bounceable)).toBe(true)
  })

  it('keeps different addresses independent', () => {
    addKnownAddress(PEER_A.bounceable)
    expect(isKnownAddress(PEER_B.bounceable)).toBe(false)
  })

  it('does not duplicate entries', () => {
    addKnownAddress(PEER_A.bounceable)
    addKnownAddress(PEER_A.bounceable)
    expect(getAddressBook()).toHaveLength(1)
  })

  it('stores a label when provided', () => {
    addKnownAddress(PEER_A.bounceable, 'Exchange')
    expect(getKnownAddress(PEER_A.bounceable)?.label).toBe('Exchange')
  })

  it('keeps an existing label when re-added without one', () => {
    addKnownAddress(PEER_A.bounceable, 'Exchange')
    addKnownAddress(PEER_A.bounceable)
    expect(getKnownAddress(PEER_A.bounceable)?.label).toBe('Exchange')
  })

  it('removeKnownAddress removes the entry', () => {
    addKnownAddress(PEER_A.bounceable)
    removeKnownAddress(PEER_A.bounceable)
    expect(isKnownAddress(PEER_A.bounceable)).toBe(false)
  })

  it('clearAddressBook empties the book', () => {
    addKnownAddress(PEER_A.bounceable)
    addKnownAddress(PEER_B.bounceable)
    clearAddressBook()
    expect(getAddressBook()).toHaveLength(0)
  })

  it('records an addedAt timestamp', () => {
    const before = Date.now()
    addKnownAddress(PEER_A.bounceable)
    const entry = getAddressBook()[0]
    expect(entry.addedAt).toBeGreaterThanOrEqual(before)
    expect(entry.addedAt).toBeLessThanOrEqual(Date.now())
  })

  it('sorts the book newest-first', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable, 1_600_000_000)])
    addKnownAddress(PEER_B.bounceable)
    expect(getAddressBook()[0].address).toBe(PEER_B.canonical)
  })

  it('survives a corrupt localStorage payload', () => {
    localStorage.setItem('ton_address_book', 'not json')
    expect(getAddressBook()).toEqual([])
    expect(isKnownAddress(PEER_A.bounceable)).toBe(false)
  })

  it('ignores a payload of the wrong shape', () => {
    localStorage.setItem('ton_address_book', '["array","not","object"]')
    expect(getAddressBook()).toEqual([])
  })
})

describe('Address book — normalisation across formats', () => {
  it('treats every user-friendly form of one account as the same entry', () => {
    addKnownAddress(WALLET.bounceableMain)
    for (const form of Object.values(WALLET)) {
      expect(isKnownAddress(form)).toBe(true)
    }
    expect(getAddressBook()).toHaveLength(1)
  })

  it('stores the canonical form regardless of the input form', () => {
    addKnownAddress(WALLET.raw)
    expect(getAddressBook()[0].address).toBe(WALLET_CANONICAL)
  })
})

describe('Address book — provenance (source tag)', () => {
  it('marks a manual add as confirmed', () => {
    addKnownAddress(PEER_A.bounceable)
    expect(getKnownAddress(PEER_A.bounceable)?.source).toBe('sent')
    expect(isConfirmedAddress(PEER_A.bounceable)).toBe(true)
  })

  it('marks a history-seeded entry as unconfirmed', () => {
    // A malicious or compromised API could fabricate an outgoing transaction and
    // thereby silence the first-send warning, so seeded entries stay weaker.
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable)])
    expect(isKnownAddress(PEER_A.bounceable)).toBe(true)
    expect(isConfirmedAddress(PEER_A.bounceable)).toBe(false)
    expect(getKnownAddress(PEER_A.bounceable)?.source).toBe('history')
  })

  it('upgrades a seeded entry to confirmed after a real send', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable)])
    addKnownAddress(PEER_A.bounceable)
    expect(isConfirmedAddress(PEER_A.bounceable)).toBe(true)
  })

  it('never downgrades a confirmed entry back to history', () => {
    addKnownAddress(PEER_A.bounceable)
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable)])
    expect(isConfirmedAddress(PEER_A.bounceable)).toBe(true)
  })

  it('treats a legacy entry with no source as confirmed', () => {
    localStorage.setItem(
      'ton_address_book',
      JSON.stringify({ [PEER_A.canonical]: { address: PEER_A.canonical, addedAt: 1 } }),
    )
    expect(isConfirmedAddress(PEER_A.bounceable)).toBe(true)
  })
})

describe('SECURITY MECHANISM C — look-alike detection', () => {
  it('returns null when the book is empty', () => {
    expect(findSimilarKnownAddress(FAKE.base)).toBeNull()
  })

  it('returns null for an address that is itself known', () => {
    addKnownAddress(FAKE.base)
    expect(findSimilarKnownAddress(FAKE.base)).toBeNull()
  })

  it('returns null when nothing resembles the input', () => {
    addKnownAddress(FAKE.base)
    expect(findSimilarKnownAddress(FAKE.unrelated)).toBeNull()
  })

  it('flags a shared leading prefix', () => {
    addKnownAddress(FAKE.base)
    const match = findSimilarKnownAddress(FAKE.samePrefix)
    expect(match).not.toBeNull()
    expect(match!.reason).toBe('prefix')
    expect(match!.entry.address).toBe(FAKE.base)
  })

  it('flags a shared trailing suffix', () => {
    // A vanity grinder can brute-force the tail as easily as the head.
    addKnownAddress(FAKE.base)
    const match = findSimilarKnownAddress(FAKE.sameSuffix)
    expect(match).not.toBeNull()
    expect(match!.reason).toBe('suffix')
  })

  it('flags a corner collision as the strongest reason', () => {
    // Matching the exact characters Mechanism A highlights defeats the visual
    // check entirely, so it must outrank a plain prefix or suffix match.
    addKnownAddress(FAKE.base)
    const match = findSimilarKnownAddress(FAKE.sameCorners)
    expect(match!.reason).toBe('corners')
  })

  it('prefers a corner collision over a prefix collision', () => {
    addKnownAddress(FAKE.samePrefix)
    addKnownAddress(FAKE.base)
    const match = findSimilarKnownAddress(FAKE.sameCorners)
    expect(match!.reason).toBe('corners')
    expect(match!.entry.address).toBe(FAKE.base)
  })

  it('ignores different formats of the same account', () => {
    // EQ… and 0Q… for one account share their payload; that is not an attack.
    addKnownAddress(WALLET.bounceableMain)
    expect(findSimilarKnownAddress(WALLET.nonBounceableTest)).toBeNull()
  })

  it('returns null for an input too short to compare', () => {
    addKnownAddress(FAKE.base)
    expect(findSimilarKnownAddress('SHORT')).toBeNull()
  })

  it('also matches against history-seeded entries', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable)])
    const nearMiss = `${PEER_A.canonical.slice(0, 6)}${'Z'.repeat(38)}${PEER_A.canonical.slice(-4)}`
    expect(findSimilarKnownAddress(nearMiss)?.reason).toBe('corners')
  })
})

describe('Address book — seed from history', () => {
  it('seeds outgoing destinations', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable)])
    expect(isKnownAddress(PEER_A.bounceable)).toBe(true)
  })

  it('does NOT seed incoming sources', () => {
    seedAddressBookFromHistory([makeTx('in', PEER_A.bounceable)])
    expect(isKnownAddress(PEER_A.bounceable)).toBe(false)
  })

  it('rejects an unparseable address from the API', () => {
    // Nothing that fails a checksum may enter the book — it is compared against
    // user input to decide whether to show a warning.
    seedAddressBookFromHistory([makeTx('out', 'garbage-from-api')])
    expect(getAddressBook()).toHaveLength(0)
  })

  it('skips transactions with an empty counterparty', () => {
    seedAddressBookFromHistory([makeTx('out', '')])
    expect(getAddressBook()).toHaveLength(0)
  })

  it('does not duplicate an already-known address', () => {
    addKnownAddress(PEER_A.bounceable)
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable), makeTx('out', PEER_A.bounceable)])
    expect(getAddressBook()).toHaveLength(1)
  })

  it('seeds multiple destinations', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable), makeTx('out', PEER_B.bounceable)])
    expect(isKnownAddress(PEER_A.bounceable)).toBe(true)
    expect(isKnownAddress(PEER_B.bounceable)).toBe(true)
  })

  it('uses the on-chain timestamp', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable, 1_650_000_000)])
    expect(getAddressBook()[0].addedAt).toBe(1_650_000_000_000)
  })

  it('is idempotent', () => {
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable, 1_650_000_000)])
    const first = getAddressBook()[0].addedAt
    seedAddressBookFromHistory([makeTx('out', PEER_A.bounceable, 1_660_000_000)])
    expect(getAddressBook()[0].addedAt).toBe(first)
  })

  it('handles an empty history without writing anything', () => {
    seedAddressBookFromHistory([])
    expect(localStorage.getItem('ton_address_book')).toBeNull()
  })
})
