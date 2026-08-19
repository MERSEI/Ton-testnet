// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { Cell } from '@ton/ton'
import {
  generateWallet,
  deriveWallet,
  normalizeMnemonicInput,
  buildTransferBoc,
  MAX_COMMENT_BYTES,
} from '../wallet'
import { isValidTonAddress, parseTonAddress } from '../../utils/address'
import { MNEMONIC_24, WALLET, PEER_A } from '../../tests/fixtures'

describe('generateWallet', () => {
  it('produces 24 words and a valid non-bounceable test-only address', async () => {
    const w = await generateWallet()
    expect(w.mnemonic).toHaveLength(24)
    expect(w.address.startsWith('0Q')).toBe(true)
    expect(isValidTonAddress(w.address)).toBe(true)
    expect(w.keys.publicKey).toHaveLength(32)
    expect(w.keys.secretKey).toHaveLength(64)
  })

  it('produces a different wallet each time', async () => {
    const [a, b] = await Promise.all([generateWallet(), generateWallet()])
    expect(a.address).not.toBe(b.address)
  })

  it('generates a phrase that passes its own import validation', async () => {
    const w = await generateWallet()
    await expect(deriveWallet(w.mnemonic)).resolves.toMatchObject({ address: w.address })
  })
})

describe('deriveWallet', () => {
  it('is deterministic for a known mnemonic', async () => {
    const w = await deriveWallet(MNEMONIC_24)
    expect(w.address).toBe(WALLET.nonBounceableTest)
  })

  it('rejects a phrase whose checksum fails', async () => {
    // Regression: mnemonicToPrivateKey derives a keypair from ANY 24 words, so a
    // single typo used to silently open a different, empty wallet — indistinguishable
    // from "my funds are gone".
    const typo = [...MNEMONIC_24]
    typo[0] = 'zebra'
    await expect(deriveWallet(typo)).rejects.toThrow(/checksum/i)
  })

  it('rejects a phrase with a swapped word order', async () => {
    const swapped = [...MNEMONIC_24]
    ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]
    await expect(deriveWallet(swapped)).rejects.toThrow(/checksum/i)
  })

  it.each([12, 23, 25])('rejects a %i-word phrase', async n => {
    const words = Array.from({ length: n }, (_, i) => MNEMONIC_24[i % 24])
    await expect(deriveWallet(words)).rejects.toThrow(/24 words/)
  })
})

describe('normalizeMnemonicInput', () => {
  it('splits on any whitespace', () => {
    expect(normalizeMnemonicInput(' dose   ice\nenrich\t')).toEqual(['dose', 'ice', 'enrich'])
  })

  it('lowercases words', () => {
    expect(normalizeMnemonicInput('DOSE Ice')).toEqual(['dose', 'ice'])
  })

  it('strips the numbering people paste with their backup', () => {
    expect(normalizeMnemonicInput('1. dose 2. ice 3) enrich')).toEqual(['dose', 'ice', 'enrich'])
  })

  it('strips punctuation', () => {
    expect(normalizeMnemonicInput('dose, ice; enrich.')).toEqual(['dose', 'ice', 'enrich'])
  })

  it('returns an empty array for empty input', () => {
    expect(normalizeMnemonicInput('   ')).toEqual([])
  })

  it('normalises a real phrase back to exactly 24 words', () => {
    const messy = MNEMONIC_24.map((w, i) => `${i + 1}. ${w.toUpperCase()}`).join('  ')
    expect(normalizeMnemonicInput(messy)).toEqual(MNEMONIC_24)
  })
})

describe('buildTransferBoc', () => {
  async function keys() {
    return (await deriveWallet(MNEMONIC_24)).keys
  }

  const base = { amountTon: '1.5', seqno: 0 }

  it('returns a base64 BOC that parses back into a cell', async () => {
    const boc = await buildTransferBoc({ ...base, keys: await keys(), toAddress: PEER_A.bounceable })
    expect(boc).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(() => Cell.fromBase64(boc)).not.toThrow()
  })

  it('accepts every address form for the same recipient', async () => {
    const k = await keys()
    for (const form of [PEER_A.bounceable, PEER_A.canonical]) {
      await expect(
        buildTransferBoc({ ...base, keys: k, toAddress: form }),
      ).resolves.toBeTypeOf('string')
    }
  })

  it('takes the bounce flag from the recipient address', async () => {
    // Same account, opposite bounce flags → different message bodies. Hardcoding
    // bounce:false burned funds sent to a bounceable address that does not exist.
    const k = await keys()
    const parsedB = parseTonAddress(WALLET.bounceableMain)!
    const parsedNB = parseTonAddress(WALLET.nonBounceableMain)!
    expect(parsedB.isBounceable).toBe(true)
    expect(parsedNB.isBounceable).toBe(false)

    const bounceable = await buildTransferBoc({ ...base, keys: k, toAddress: WALLET.bounceableMain })
    const nonBounceable = await buildTransferBoc({ ...base, keys: k, toAddress: WALLET.nonBounceableMain })
    expect(bounceable).not.toBe(nonBounceable)
  })

  it('produces a different BOC when a comment is attached', async () => {
    const k = await keys()
    const plain = await buildTransferBoc({ ...base, keys: k, toAddress: PEER_A.bounceable })
    const commented = await buildTransferBoc({
      ...base,
      keys: k,
      toAddress: PEER_A.bounceable,
      comment: 'invoice 42',
    })
    expect(commented).not.toBe(plain)
  })

  it('is deterministic for identical input', async () => {
    const k = await keys()
    const a = await buildTransferBoc({ ...base, keys: k, toAddress: PEER_A.bounceable })
    const b = await buildTransferBoc({ ...base, keys: k, toAddress: PEER_A.bounceable })
    expect(a).toBe(b)
  })

  it('changes with the seqno', async () => {
    const k = await keys()
    const a = await buildTransferBoc({ ...base, keys: k, toAddress: PEER_A.bounceable, seqno: 0 })
    const b = await buildTransferBoc({ ...base, keys: k, toAddress: PEER_A.bounceable, seqno: 1 })
    expect(a).not.toBe(b)
  })

  it('rejects an invalid recipient', async () => {
    await expect(
      buildTransferBoc({ ...base, keys: await keys(), toAddress: 'not-an-address' }),
    ).rejects.toThrow(/Invalid recipient/)
  })

  it('rejects an address with a broken checksum', async () => {
    await expect(
      buildTransferBoc({
        ...base,
        keys: await keys(),
        toAddress: '0QDwzJzZsHarII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTd7Pa',
      }),
    ).rejects.toThrow(/Invalid recipient/)
  })

  it.each(['0', '0.0', ''])('rejects the non-positive amount %o', async amount => {
    await expect(
      buildTransferBoc({ ...base, amountTon: amount, keys: await keys(), toAddress: PEER_A.bounceable }),
    ).rejects.toThrow()
  })

  it('rejects a malformed amount rather than coercing it', async () => {
    await expect(
      buildTransferBoc({ ...base, amountTon: '1e9', keys: await keys(), toAddress: PEER_A.bounceable }),
    ).rejects.toThrow(/Invalid TON amount/)
  })

  it('rejects a negative or non-integer seqno', async () => {
    const k = await keys()
    await expect(
      buildTransferBoc({ ...base, seqno: -1, keys: k, toAddress: PEER_A.bounceable }),
    ).rejects.toThrow(/seqno/)
    await expect(
      buildTransferBoc({ ...base, seqno: 1.5, keys: k, toAddress: PEER_A.bounceable }),
    ).rejects.toThrow(/seqno/)
  })

  it('rejects an over-long comment before signing', async () => {
    await expect(
      buildTransferBoc({
        ...base,
        keys: await keys(),
        toAddress: PEER_A.bounceable,
        comment: 'x'.repeat(MAX_COMMENT_BYTES + 1),
      }),
    ).rejects.toThrow(/too long/)
  })

  it('measures the comment in bytes, not characters', async () => {
    // Multi-byte characters must count towards the cell budget.
    const emoji = '🚀'.repeat(31) // 4 bytes each = 124 bytes
    await expect(
      buildTransferBoc({ ...base, keys: await keys(), toAddress: PEER_A.bounceable, comment: emoji }),
    ).rejects.toThrow(/too long/)
  })

  it('accepts a comment exactly at the limit', async () => {
    await expect(
      buildTransferBoc({
        ...base,
        keys: await keys(),
        toAddress: PEER_A.bounceable,
        comment: 'x'.repeat(MAX_COMMENT_BYTES),
      }),
    ).resolves.toBeTypeOf('string')
  })
})
