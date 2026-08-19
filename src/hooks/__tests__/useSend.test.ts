import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSend } from '../useSend'
import * as api from '../../api/tonCenter'
import * as walletCrypto from '../../crypto/wallet'
import * as addressBook from '../../utils/addressBook'
import { WALLET, PEER_A } from '../../tests/fixtures'

const keys = {
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
} as unknown as walletCrypto.WalletKeys

const params = {
  walletAddress: WALLET.nonBounceableTest,
  keys,
  toAddress: PEER_A.bounceable,
  amountTon: '1.5',
}

beforeEach(() => {
  vi.restoreAllMocks()
  addressBook.clearAddressBook()
})

afterEach(() => {
  vi.restoreAllMocks()
  addressBook.clearAddressBook()
})

function mockHappyPath(seqno = 3, hash = 'TX_HASH') {
  const seqnoSpy = vi.spyOn(api, 'getSeqno').mockResolvedValue(seqno)
  const bocSpy = vi.spyOn(walletCrypto, 'buildTransferBoc').mockResolvedValue('BOC')
  const sendSpy = vi.spyOn(api, 'sendBoc').mockResolvedValue({ hash })
  return { seqnoSpy, bocSpy, sendSpy }
}

describe('useSend', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useSend())
    expect(result.current).toMatchObject({ loading: false, txHash: null, error: null })
  })

  it('reads the seqno immediately before signing', async () => {
    // A stale seqno produces a message the network drops silently, so it must be
    // fetched per send rather than reused from screen state.
    const { seqnoSpy, bocSpy } = mockHappyPath(7)
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send(params)
    })
    expect(seqnoSpy).toHaveBeenCalledWith(WALLET.nonBounceableTest)
    expect(bocSpy.mock.calls[0][0]).toMatchObject({ seqno: 7, toAddress: PEER_A.bounceable })
  })

  it('broadcasts the built BOC and exposes the hash', async () => {
    const { sendSpy } = mockHappyPath(1, 'HASH42')
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send(params)
    })
    expect(sendSpy).toHaveBeenCalledWith('BOC')
    expect(result.current.txHash).toBe('HASH42')
    expect(result.current.error).toBeNull()
  })

  it('treats an empty hash as success, not as failure', async () => {
    // The endpoint can accept the message without returning a hash.
    mockHappyPath(1, '')
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send(params)
    })
    expect(result.current.txHash).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('confirms the recipient in the address book after a successful send', async () => {
    mockHappyPath()
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send(params)
    })
    expect(addressBook.isConfirmedAddress(PEER_A.bounceable)).toBe(true)
  })

  it('does not touch the address book when the send fails', async () => {
    vi.spyOn(api, 'getSeqno').mockResolvedValue(1)
    vi.spyOn(walletCrypto, 'buildTransferBoc').mockResolvedValue('BOC')
    vi.spyOn(api, 'sendBoc').mockRejectedValue(new Error('rejected'))

    const { result } = renderHook(() => useSend())
    await act(async () => {
      await expect(result.current.send(params)).rejects.toThrow('rejected')
    })
    expect(addressBook.isKnownAddress(PEER_A.bounceable)).toBe(false)
  })

  it('surfaces a seqno failure instead of signing with a guess', async () => {
    vi.spyOn(api, 'getSeqno').mockRejectedValue(new Error('Rate limited'))
    const bocSpy = vi.spyOn(walletCrypto, 'buildTransferBoc')

    const { result } = renderHook(() => useSend())
    await act(async () => {
      await expect(result.current.send(params)).rejects.toThrow('Rate limited')
    })
    expect(bocSpy).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Rate limited')
    expect(result.current.txHash).toBeNull()
  })

  it('surfaces a build failure', async () => {
    vi.spyOn(api, 'getSeqno').mockResolvedValue(1)
    vi.spyOn(walletCrypto, 'buildTransferBoc').mockRejectedValue(new Error('Invalid recipient address.'))
    const sendSpy = vi.spyOn(api, 'sendBoc')

    const { result } = renderHook(() => useSend())
    await act(async () => {
      await expect(result.current.send(params)).rejects.toThrow('Invalid recipient')
    })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('ignores a second concurrent send', async () => {
    // Two confirms in the same tick would sign two messages with one seqno; the
    // network accepts one and drops the other with no feedback.
    let release: (v: { hash: string }) => void = () => {}
    vi.spyOn(api, 'getSeqno').mockResolvedValue(1)
    vi.spyOn(walletCrypto, 'buildTransferBoc').mockResolvedValue('BOC')
    const sendSpy = vi.spyOn(api, 'sendBoc').mockReturnValue(
      new Promise(res => {
        release = res
      }),
    )

    const { result } = renderHook(() => useSend())
    await act(async () => {
      const first = result.current.send(params)
      const second = result.current.send(params)
      expect(await second).toBeNull()
      release({ hash: 'H' })
      await first
    })
    expect(sendSpy).toHaveBeenCalledTimes(1)
  })

  it('allows a new send after the previous one settles', async () => {
    const { sendSpy } = mockHappyPath()
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send(params)
    })
    await act(async () => {
      await result.current.send(params)
    })
    expect(sendSpy).toHaveBeenCalledTimes(2)
  })

  it('reset returns to the idle state', async () => {
    mockHappyPath()
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send(params)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current).toMatchObject({ loading: false, txHash: null, error: null })
  })

  it('passes a comment through to the builder', async () => {
    const { bocSpy } = mockHappyPath()
    const { result } = renderHook(() => useSend())
    await act(async () => {
      await result.current.send({ ...params, comment: 'invoice 42' })
    })
    expect(bocSpy.mock.calls[0][0].comment).toBe('invoice 42')
  })
})
