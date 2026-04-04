import { describe, it, expect } from 'vitest'
import {
  isValidTonAddress,
  normalizeAddress,
  shortenAddress,
  splitAddressForHighlight,
  formatTon,
  tonToNano,
} from '../address'

// 48-char valid TON address used throughout this test file
const VALID_EQ = 'EQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'
const VALID_UQ = 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'

describe('isValidTonAddress', () => {
  it('rejects address that is too short (47 chars)', () => {
    // 47 chars — one short of the required 48
    expect(isValidTonAddress('EQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9ABC')).toBe(false)
  })

  it('accepts valid non-bounceable address (UQ...)', () => {
    // 48 chars total, starts with UQ
    expect(VALID_UQ.length).toBe(48)
    expect(isValidTonAddress(VALID_UQ)).toBe(true)
  })

  it('accepts bounceable address (EQ...)', () => {
    expect(VALID_EQ.length).toBe(48)
    expect(isValidTonAddress(VALID_EQ)).toBe(true)
  })

  it('accepts raw workchain:hex format', () => {
    const raw = '0:' + 'a'.repeat(64)
    expect(isValidTonAddress(raw)).toBe(true)
  })

  it('accepts negative workchain raw format', () => {
    const raw = '-1:' + 'b'.repeat(64)
    expect(isValidTonAddress(raw)).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidTonAddress('')).toBe(false)
  })

  it('rejects short string', () => {
    expect(isValidTonAddress('UQBshort')).toBe(false)
  })

  it('rejects random text', () => {
    expect(isValidTonAddress('not-an-address')).toBe(false)
  })

  it('rejects Ethereum address', () => {
    expect(isValidTonAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')).toBe(false)
  })

  it('trims whitespace before validating', () => {
    expect(isValidTonAddress(`  ${VALID_UQ}  `)).toBe(true)
  })
})

describe('shortenAddress', () => {
  const addr = VALID_UQ

  it('returns prefix+ellipsis+suffix', () => {
    const result = shortenAddress(addr)
    expect(result).toBe('UQBvWW…ABCd')
  })

  it('uses custom prefix/suffix lengths', () => {
    const result = shortenAddress(addr, 4, 4)
    expect(result).toBe('UQBv…ABCd')
  })

  it('returns full address when shorter than threshold', () => {
    expect(shortenAddress('ABCDE', 6, 4)).toBe('ABCDE')
  })
})

describe('splitAddressForHighlight', () => {
  const addr = VALID_UQ

  it('splits into [prefix, middle, suffix]', () => {
    const [prefix, middle, suffix] = splitAddressForHighlight(addr, 6, 4)
    expect(prefix).toBe('UQBvWW')
    expect(suffix).toBe('ABCd')
    expect(middle).toBe(addr.slice(6, addr.length - 4))
    expect(prefix + middle + suffix).toBe(addr)
  })

  it('reconstructs original address', () => {
    const [a, b, c] = splitAddressForHighlight(addr)
    expect(a + b + c).toBe(addr)
  })

  it('handles short address gracefully', () => {
    const [a, b, c] = splitAddressForHighlight('SHORT', 6, 4)
    expect(a).toBe('SHORT')
    expect(b).toBe('')
    expect(c).toBe('')
  })
})

describe('formatTon', () => {
  it('formats whole nanotons to TON', () => {
    expect(formatTon('1000000000')).toBe('1')
  })

  it('formats fractional amounts', () => {
    expect(formatTon('1500000000')).toBe('1.5')
  })

  it('formats zero', () => {
    expect(formatTon('0')).toBe('0')
  })

  it('formats large amount', () => {
    expect(formatTon('100000000000')).toBe('100')
  })

  it('accepts bigint', () => {
    expect(formatTon(BigInt('2000000000'))).toBe('2')
  })

  it('trims trailing zeros in fraction', () => {
    expect(formatTon('1100000000')).toBe('1.1')
  })
})

describe('normalizeAddress (P2 fix — address normalization)', () => {
  it('returns original string when address is invalid (CRC mismatch)', () => {
    // Our hand-crafted test addresses are not valid TON (wrong CRC),
    // so normalizeAddress falls back to the trimmed original.
    const fake = 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'
    expect(normalizeAddress(fake)).toBe(fake)
  })

  it('trims whitespace', () => {
    const fake = '  UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd  '
    expect(normalizeAddress(fake)).toBe(fake.trim())
  })

  it('returns original for empty string', () => {
    expect(normalizeAddress('')).toBe('')
  })

  it('returns original for random text', () => {
    expect(normalizeAddress('not-an-address')).toBe('not-an-address')
  })
})

describe('tonToNano', () => {
  it('converts integer TON to nanotons', () => {
    expect(tonToNano('1')).toBe(BigInt('1000000000'))
  })

  it('converts fractional TON', () => {
    expect(tonToNano('0.5')).toBe(BigInt('500000000'))
  })

  it('converts zero', () => {
    expect(tonToNano('0')).toBe(BigInt(0))
  })

  it('round-trips with formatTon', () => {
    const original = '2.75'
    const nano = tonToNano(original)
    expect(formatTon(nano)).toBe(original)
  })
})
