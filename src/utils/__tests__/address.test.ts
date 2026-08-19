import { describe, it, expect } from 'vitest'
import {
  isValidTonAddress,
  parseTonAddress,
  normalizeAddress,
  isSameAddress,
  shortenAddress,
  splitAddressForHighlight,
  formatTon,
  tonToNano,
} from '../address'
import { WALLET, WALLET_CANONICAL, PEER_A, CHECKSUM_BROKEN } from '../../tests/fixtures'

describe('isValidTonAddress — accepted forms', () => {
  it.each([
    ['non-bounceable test-only (0Q…)', WALLET.nonBounceableTest],
    ['non-bounceable mainnet flag (UQ…)', WALLET.nonBounceableMain],
    ['bounceable test-only (kQ…)', WALLET.bounceableTest],
    ['bounceable mainnet flag (EQ…)', WALLET.bounceableMain],
    ['raw workchain:hex', WALLET.raw],
  ])('accepts %s', (_label, addr) => {
    expect(isValidTonAddress(addr)).toBe(true)
  })

  it('accepts the 0Q… form this wallet generates for itself', () => {
    // Regression: the old regex required a leading [UEkf], so a user could not
    // paste an address produced by this very app.
    expect(WALLET.nonBounceableTest.startsWith('0Q')).toBe(true)
    expect(isValidTonAddress(WALLET.nonBounceableTest)).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    expect(isValidTonAddress(`  ${WALLET.bounceableMain}  `)).toBe(true)
  })

  it('accepts a negative workchain in raw form', () => {
    expect(isValidTonAddress(`-1:${'b'.repeat(64)}`)).toBe(true)
  })
})

describe('isValidTonAddress — rejected input', () => {
  it('rejects an address whose checksum does not match', () => {
    // This is the core reason validation goes through a decoder instead of a
    // regex: a single mistyped character must not reach the network.
    expect(CHECKSUM_BROKEN).toHaveLength(48)
    expect(isValidTonAddress(CHECKSUM_BROKEN)).toBe(false)
  })

  it('rejects 48 base64 chars that are not a real address', () => {
    expect(isValidTonAddress(`EQ${'Q'.repeat(46)}`)).toBe(false)
  })

  it('rejects an address one char too short', () => {
    expect(isValidTonAddress(WALLET.bounceableMain.slice(0, 47))).toBe(false)
  })

  it('rejects an address one char too long', () => {
    expect(isValidTonAddress(`${WALLET.bounceableMain}A`)).toBe(false)
  })

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['short string', 'UQBshort'],
    ['random text', 'not-an-address'],
    ['ethereum address', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'],
    ['raw with short hex', `0:${'a'.repeat(63)}`],
    ['raw with long hex', `0:${'a'.repeat(65)}`],
    ['raw with non-hex', `0:${'z'.repeat(64)}`],
    ['colon only', ':'],
  ])('rejects %s', (_label, addr) => {
    expect(isValidTonAddress(addr)).toBe(false)
  })
})

describe('parseTonAddress — flags', () => {
  it('reports the test-only flag', () => {
    expect(parseTonAddress(WALLET.nonBounceableTest)!.isTestOnly).toBe(true)
    expect(parseTonAddress(WALLET.bounceableTest)!.isTestOnly).toBe(true)
    expect(parseTonAddress(WALLET.nonBounceableMain)!.isTestOnly).toBe(false)
    expect(parseTonAddress(WALLET.bounceableMain)!.isTestOnly).toBe(false)
  })

  it('reports the bounceable flag', () => {
    expect(parseTonAddress(WALLET.bounceableMain)!.isBounceable).toBe(true)
    expect(parseTonAddress(WALLET.bounceableTest)!.isBounceable).toBe(true)
    expect(parseTonAddress(WALLET.nonBounceableMain)!.isBounceable).toBe(false)
    expect(parseTonAddress(WALLET.nonBounceableTest)!.isBounceable).toBe(false)
  })

  it('treats a raw address as non-bounceable so funds are not burned', () => {
    expect(parseTonAddress(WALLET.raw)!.isBounceable).toBe(false)
  })

  it('returns null instead of throwing on junk', () => {
    expect(parseTonAddress('nope')).toBeNull()
  })
})

describe('normalizeAddress', () => {
  it('maps every form of one account to the same canonical string', () => {
    for (const form of Object.values(WALLET)) {
      expect(normalizeAddress(form)).toBe(WALLET_CANONICAL)
    }
  })

  it('preserves the test-only flag in the canonical form', () => {
    // Regression: dropping testOnly made a wallet's own address unequal to
    // itself, which broke self-send detection and address-book lookups.
    expect(normalizeAddress(WALLET.bounceableMain).startsWith('0Q')).toBe(true)
  })

  it('is idempotent', () => {
    const once = normalizeAddress(WALLET.bounceableMain)
    expect(normalizeAddress(once)).toBe(once)
  })

  it('falls back to the trimmed original for unparseable input', () => {
    expect(normalizeAddress('  not-an-address  ')).toBe('not-an-address')
    expect(normalizeAddress('')).toBe('')
  })
})

describe('isSameAddress', () => {
  it('matches different forms of the same account', () => {
    expect(isSameAddress(WALLET.bounceableMain, WALLET.nonBounceableTest)).toBe(true)
    expect(isSameAddress(WALLET.raw, WALLET.bounceableTest)).toBe(true)
  })

  it('does not match different accounts', () => {
    expect(isSameAddress(WALLET.bounceableMain, PEER_A.bounceable)).toBe(false)
  })

  it('does not match when either side is invalid', () => {
    expect(isSameAddress('junk', 'junk')).toBe(false)
    expect(isSameAddress(WALLET.bounceableMain, CHECKSUM_BROKEN)).toBe(false)
  })
})

describe('shortenAddress', () => {
  it('returns prefix + ellipsis + suffix', () => {
    expect(shortenAddress(WALLET.nonBounceableTest)).toBe('0QDwzJ…d7Pa')
  })

  it('uses custom prefix/suffix lengths', () => {
    expect(shortenAddress(WALLET.nonBounceableTest, 4, 4)).toBe('0QDw…d7Pa')
  })

  it('returns the input unchanged when shorter than the threshold', () => {
    expect(shortenAddress('ABCDE', 6, 4)).toBe('ABCDE')
  })
})

describe('splitAddressForHighlight', () => {
  const addr = WALLET.nonBounceableTest

  it('splits into [prefix, middle, suffix]', () => {
    const [prefix, middle, suffix] = splitAddressForHighlight(addr, 6, 4)
    expect(prefix).toBe('0QDwzJ')
    expect(suffix).toBe('d7Pa')
    expect(middle).toBe(addr.slice(6, addr.length - 4))
  })

  it('reconstructs the original address', () => {
    const [a, b, c] = splitAddressForHighlight(addr)
    expect(a + b + c).toBe(addr)
  })

  it('handles a short address gracefully', () => {
    expect(splitAddressForHighlight('SHORT', 6, 4)).toEqual(['SHORT', '', ''])
  })
})

describe('formatTon', () => {
  it.each([
    ['1000000000', '1'],
    ['1500000000', '1.5'],
    ['0', '0'],
    ['100000000000', '100'],
    ['1100000000', '1.1'],
    ['1', '0.000000001'],
    ['999999999', '0.999999999'],
  ])('formats %s nanotons as %s TON', (nano, expected) => {
    expect(formatTon(nano)).toBe(expected)
  })

  it('accepts bigint and number', () => {
    expect(formatTon(BigInt('2000000000'))).toBe('2')
    expect(formatTon(2_000_000_000)).toBe('2')
  })

  it('formats negative amounts', () => {
    expect(formatTon('-1500000000')).toBe('-1.5')
  })

  it('returns 0 rather than throwing on garbage', () => {
    // A malformed API value must never crash a render.
    expect(formatTon('abc')).toBe('0')
    expect(formatTon('')).toBe('0')
  })
})

describe('tonToNano', () => {
  it.each([
    ['1', '1000000000'],
    ['0.5', '500000000'],
    ['0', '0'],
    ['0.000000001', '1'],
    ['12.345', '12345000000'],
    ['1.', '1000000000'],
    ['.5', '500000000'],
  ])('converts %s TON', (ton, expected) => {
    expect(tonToNano(ton)).toBe(BigInt(expected))
  })

  it('truncates beyond 9 decimal places rather than rounding up', () => {
    expect(tonToNano('0.0000000019')).toBe(BigInt(1))
  })

  it('round-trips with formatTon', () => {
    expect(formatTon(tonToNano('2.75'))).toBe('2.75')
  })

  it.each([
    ['empty', ''],
    ['bare dot', '.'],
    ['scientific notation', '1e9'],
    ['negative', '-1'],
    ['two dots', '1.2.3'],
    ['letters', 'abc'],
    ['comma decimal', '1,5'],
    ['hex', '0x10'],
  ])('throws on %s instead of silently coercing', (_label, input) => {
    expect(() => tonToNano(input)).toThrow()
  })
})
