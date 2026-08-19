import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAccount } from '../useAccount'
import { useTransactions } from '../useTransactions'
import * as api from '../../api/tonCenter'
import { WALLET, PEER_A } from '../../tests/fixtures'

const ADDR = WALLET.nonBounceableTest

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAccount', () => {
  it('starts empty and not loaded', () => {
    const { result } = renderHook(() => useAccount(ADDR))
    expect(result.current).toMatchObject({
      nanotons: null, seqno: null, deployed: null, loading: false, loaded: false, error: null,
    })
  })

  it('fills balance, seqno and deployment state on refresh', async () => {
    vi.spyOn(api, 'getWalletInformation').mockResolvedValue({
      balance: '1500000000', seqno: 4, deployed: true, walletType: 'wallet v4 r2',
    })

    const { result } = renderHook(() => useAccount(ADDR))
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current).toMatchObject({
      nanotons: '1500000000', seqno: 4, deployed: true, loaded: true, loading: false, error: null,
    })
  })

  it('records an error without clobbering a previously loaded balance', async () => {
    const spy = vi
      .spyOn(api, 'getWalletInformation')
      .mockResolvedValueOnce({ balance: '10', seqno: 1, deployed: true })
      .mockRejectedValueOnce(new Error('Rate limited'))

    const { result } = renderHook(() => useAccount(ADDR))
    await act(async () => {
      await result.current.refresh()
    })
    await act(async () => {
      await result.current.refresh()
    })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBe('Rate limited')
    // A stale-but-real balance beats blanking the screen on a transient failure.
    expect(result.current.nanotons).toBe('10')
    expect(result.current.loaded).toBe(true)
  })

  it('keeps loaded=false when the very first load fails', async () => {
    // Callers rely on this to tell "zero balance" from "unknown balance".
    vi.spyOn(api, 'getWalletInformation').mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useAccount(ADDR))
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.loaded).toBe(false)
    expect(result.current.nanotons).toBeNull()
    expect(result.current.error).toBe('offline')
  })

  it('does nothing without an address', async () => {
    const spy = vi.spyOn(api, 'getWalletInformation')
    const { result } = renderHook(() => useAccount(null))
    await act(async () => {
      await result.current.refresh()
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('gives a stable refresh identity for the same address', () => {
    const { result, rerender } = renderHook(({ a }) => useAccount(a), {
      initialProps: { a: ADDR as string | null },
    })
    const first = result.current.refresh
    rerender({ a: ADDR })
    expect(result.current.refresh).toBe(first)
    rerender({ a: PEER_A.canonical })
    expect(result.current.refresh).not.toBe(first)
  })

  it('does not update state after unmount', async () => {
    let release: (v: api.WalletInformation) => void = () => {}
    vi.spyOn(api, 'getWalletInformation').mockReturnValue(
      new Promise<api.WalletInformation>(res => {
        release = res
      }),
    )

    const { result, unmount } = renderHook(() => useAccount(ADDR))
    const pending = result.current.refresh()
    unmount()
    release({ balance: '1', seqno: 1, deployed: true })
    await pending
    // No "update on unmounted component" warning and no leaked state write.
    expect(result.current.nanotons).toBeNull()
  })
})

describe('useTransactions', () => {
  const tx: api.TonTransaction = {
    hash: 'H', lt: '1', timestamp: 1_700_000_000, type: 'in',
    amount: '1000000000', address: PEER_A.bounceable, fee: '1',
  }

  it('starts empty', () => {
    const { result } = renderHook(() => useTransactions(ADDR))
    expect(result.current).toMatchObject({ transactions: [], loading: false, loaded: false, error: null })
  })

  it('loads transactions', async () => {
    vi.spyOn(api, 'getTransactions').mockResolvedValue([tx])
    const { result } = renderHook(() => useTransactions(ADDR))
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.transactions).toEqual([tx])
    expect(result.current.loaded).toBe(true)
  })

  it('requests 20 transactions', async () => {
    const spy = vi.spyOn(api, 'getTransactions').mockResolvedValue([])
    const { result } = renderHook(() => useTransactions(ADDR))
    await act(async () => {
      await result.current.refresh()
    })
    expect(spy).toHaveBeenCalledWith(ADDR, 20)
  })

  it('records an error and keeps the previous list', async () => {
    vi.spyOn(api, 'getTransactions')
      .mockResolvedValueOnce([tx])
      .mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useTransactions(ADDR))
    await act(async () => {
      await result.current.refresh()
    })
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBe('boom')
    expect(result.current.transactions).toEqual([tx])
  })

  it('does nothing without an address', async () => {
    const spy = vi.spyOn(api, 'getTransactions')
    const { result } = renderHook(() => useTransactions(null))
    await act(async () => {
      await result.current.refresh()
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('sets loading during the request', async () => {
    let release: (v: api.TonTransaction[]) => void = () => {}
    vi.spyOn(api, 'getTransactions').mockReturnValue(
      new Promise(res => {
        release = res
      }),
    )
    const { result } = renderHook(() => useTransactions(ADDR))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.refresh()
    })
    await waitFor(() => expect(result.current.loading).toBe(true))
    await act(async () => {
      release([])
      await pending
    })
    expect(result.current.loading).toBe(false)
  })
})
