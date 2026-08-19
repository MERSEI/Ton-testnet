/**
 * Tests for the TON Center transport layer.
 *
 * fetch is mocked throughout — these assert our contract with the API, not the
 * API itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getWalletInformation,
  getBalance,
  getSeqno,
  getTransactions,
  sendBoc,
  setMinRequestInterval,
  resetRateLimiter,
  type RawTransaction,
} from '../tonCenter'
import { WALLET, PEER_A } from '../../tests/fixtures'

const ADDR = WALLET.nonBounceableTest

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response
}

function okResponse(result: unknown): Response {
  return jsonResponse({ ok: true, result })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  // Keep the suite fast: the production 1.1 s spacing is exercised separately.
  setMinRequestInterval(0)
  resetRateLimiter()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lastUrl(): string {
  return String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])
}

function callUrl(i: number): string {
  return String(fetchMock.mock.calls[i][0])
}

// ─── getWalletInformation ────────────────────────────────────────────────────

describe('getWalletInformation', () => {
  it('returns balance, seqno and deployment state from one request', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        wallet: true,
        balance: '995994535',
        account_state: 'active',
        wallet_type: 'wallet v4 r2',
        seqno: 7,
      }),
    )

    const info = await getWalletInformation(ADDR)

    expect(info).toEqual({
      balance: '995994535',
      seqno: 7,
      deployed: true,
      walletType: 'wallet v4 r2',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(lastUrl()).toContain('/getWalletInformation')
    expect(lastUrl()).toContain(encodeURIComponent(ADDR))
  })

  it('reports an uninitialised account as not deployed with seqno 0', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ wallet: false, balance: '0', account_state: 'uninitialized' }),
    )

    const info = await getWalletInformation(ADDR)

    expect(info.deployed).toBe(false)
    expect(info.seqno).toBe(0)
    expect(info.balance).toBe('0')
  })

  it('coerces a numeric balance to a string', async () => {
    fetchMock.mockResolvedValue(okResponse({ balance: 12345, account_state: 'active', seqno: 1 }))
    expect((await getWalletInformation(ADDR)).balance).toBe('12345')
  })

  it('survives a response missing every optional field', async () => {
    fetchMock.mockResolvedValue(okResponse({}))
    expect(await getWalletInformation(ADDR)).toEqual({
      balance: '0',
      seqno: 0,
      deployed: false,
      walletType: undefined,
    })
  })

  it('getBalance is a thin wrapper over it', async () => {
    fetchMock.mockResolvedValue(okResponse({ balance: '42', account_state: 'active', seqno: 1 }))
    expect(await getBalance(ADDR)).toBe('42')
  })
})

// ─── getSeqno ────────────────────────────────────────────────────────────────

describe('getSeqno', () => {
  it('returns the seqno of a deployed wallet', async () => {
    fetchMock.mockResolvedValue(okResponse({ account_state: 'active', seqno: 12 }))
    expect(await getSeqno(ADDR)).toBe(12)
  })

  it('returns 0 for an account that is not deployed yet', async () => {
    fetchMock.mockResolvedValue(okResponse({ account_state: 'uninitialized' }))
    expect(await getSeqno(ADDR)).toBe(0)
  })

  it('propagates a network failure instead of guessing 0', async () => {
    // Regression: the old implementation swallowed every error into seqno 0, so a
    // rate-limited request produced a signed message the network silently dropped
    // while the UI reported success.
    fetchMock.mockRejectedValue(new Error('boom'))
    await expect(getSeqno(ADDR)).rejects.toThrow('boom')
  })

  it('propagates an API-level error instead of guessing 0', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, error: 'Not Found' }, 404))
    await expect(getSeqno(ADDR)).rejects.toThrow('Not Found')
  })

  it('falls back to runGetMethod via POST when an active account omits seqno', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ account_state: 'active' }))
      .mockResolvedValueOnce(okResponse({ exit_code: 0, stack: [['num', '0x1f']] }))

    expect(await getSeqno(ADDR)).toBe(31)

    // runGetMethod is POST-only on v2 — a GET returns 404.
    const init = fetchMock.mock.calls[1][1] as RequestInit
    expect(callUrl(1)).toContain('/runGetMethod')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ address: ADDR, method: 'seqno', stack: [] })
  })

  it('returns 0 when the get-method exits non-zero', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ account_state: 'active' }))
      .mockResolvedValueOnce(okResponse({ exit_code: 11, stack: [] }))

    expect(await getSeqno(ADDR)).toBe(0)
  })
})

// ─── getTransactions ─────────────────────────────────────────────────────────

describe('getTransactions', () => {
  const incoming: RawTransaction = {
    utime: 1_700_000_000,
    transaction_id: { lt: '100', hash: 'HASH_IN' },
    fee: '8571176',
    in_msg: { source: PEER_A.bounceable, destination: ADDR, value: '2000000000', message: 'hello' },
    out_msgs: [],
  }

  const outgoing: RawTransaction = {
    utime: 1_700_000_100,
    transaction_id: { lt: '200', hash: 'HASH_OUT' },
    fee: '5434289',
    in_msg: { source: '', destination: ADDR, value: '0' },
    out_msgs: [{ source: ADDR, destination: PEER_A.bounceable, value: '1000000000', message: 'bye' }],
  }

  it('classifies an external in_msg with value 0 plus out_msgs as outgoing', async () => {
    fetchMock.mockResolvedValue(okResponse([outgoing]))
    const [tx] = await getTransactions(ADDR)
    expect(tx).toMatchObject({
      type: 'out',
      amount: '1000000000',
      address: PEER_A.bounceable,
      hash: 'HASH_OUT',
      lt: '200',
      fee: '5434289',
      comment: 'bye',
      timestamp: 1_700_000_100,
    })
  })

  it('classifies an in_msg carrying value as incoming', async () => {
    fetchMock.mockResolvedValue(okResponse([incoming]))
    const [tx] = await getTransactions(ADDR)
    expect(tx).toMatchObject({
      type: 'in',
      amount: '2000000000',
      address: PEER_A.bounceable,
      comment: 'hello',
    })
  })

  it('sums every out_msg so a multi-message transfer reports the true total', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        {
          ...outgoing,
          out_msgs: [
            { destination: PEER_A.bounceable, value: '1000000000' },
            { destination: PEER_A.bounceable, value: '250000000' },
          ],
        },
      ]),
    )
    const [tx] = await getTransactions(ADDR)
    expect(tx.amount).toBe('1250000000')
  })

  it('does not crash when out_msgs is absent', async () => {
    fetchMock.mockResolvedValue(
      okResponse([{ transaction_id: { hash: 'H', lt: '1' }, in_msg: { value: '0' } }]),
    )
    const [tx] = await getTransactions(ADDR)
    expect(tx).toMatchObject({ type: 'out', amount: '0', address: '', fee: '0' })
  })

  it('does not crash when fields are missing entirely', async () => {
    fetchMock.mockResolvedValue(okResponse([{}]))
    const [tx] = await getTransactions(ADDR)
    expect(tx).toMatchObject({ hash: '', lt: '', timestamp: 0, fee: '0', amount: '0' })
  })

  it('tolerates a non-numeric out_msg value', async () => {
    fetchMock.mockResolvedValue(
      okResponse([{ ...outgoing, out_msgs: [{ destination: PEER_A.bounceable, value: 'oops' }] }]),
    )
    expect((await getTransactions(ADDR))[0].amount).toBe('0')
  })

  it('returns an empty list when the API returns a non-array', async () => {
    fetchMock.mockResolvedValue(okResponse({ unexpected: true }))
    expect(await getTransactions(ADDR)).toEqual([])
  })

  it('passes the limit through', async () => {
    fetchMock.mockResolvedValue(okResponse([]))
    await getTransactions(ADDR, 5)
    expect(lastUrl()).toContain('limit=5')
  })

  it('leaves an empty comment undefined rather than empty string', async () => {
    fetchMock.mockResolvedValue(okResponse([{ ...outgoing, out_msgs: [{ value: '1', message: '' }] }]))
    expect((await getTransactions(ADDR))[0].comment).toBeUndefined()
  })
})

// ─── sendBoc ─────────────────────────────────────────────────────────────────

describe('sendBoc', () => {
  it('posts to sendBocReturnHash and returns the hash', async () => {
    // Regression: plain /sendBoc answers {"@type":"ok"} with no hash, so the UI
    // had nothing to show and never rendered the success screen.
    fetchMock.mockResolvedValue(okResponse({ hash: 'TX_HASH' }))

    expect(await sendBoc('te6ccg')).toEqual({ hash: 'TX_HASH' })
    expect(lastUrl()).toContain('/sendBocReturnHash')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ boc: 'te6ccg' })
  })

  it('returns an empty hash when the endpoint omits one', async () => {
    fetchMock.mockResolvedValue(okResponse({ '@type': 'ok' }))
    expect(await sendBoc('te6ccg')).toEqual({ hash: '' })
  })

  it('surfaces a rejection reason from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, error: 'invalid external message' }, 422))
    await expect(sendBoc('bad')).rejects.toThrow('invalid external message')
  })
})

// ─── Error handling and retries ──────────────────────────────────────────────

describe('error handling', () => {
  it('retries a 429 and succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(okResponse({ balance: '5', account_state: 'active', seqno: 1 }))

    expect(await getBalance(ADDR)).toBe('5')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives a human-readable message when rate limiting persists', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429))
    await expect(getBalance(ADDR)).rejects.toThrow(/Rate limited by TON Center/)
    // 1 initial attempt + 3 retries
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('retries a 5xx', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(okResponse({ balance: '9', account_state: 'active', seqno: 1 }))

    expect(await getBalance(ADDR)).toBe('9')
  })

  it('does not retry a 4xx', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, error: 'bad address' }, 422))
    await expect(getBalance(ADDR)).rejects.toThrow('bad address')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a body that is JSON but not an ok envelope', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ something: 'else' }))
    await expect(getBalance(ADDR)).rejects.toThrow(/Malformed response/)
  })

  it('rejects a non-JSON body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)
    await expect(getBalance(ADDR)).rejects.toThrow(/Malformed response/)
  })
})

// ─── Rate limiter ────────────────────────────────────────────────────────────

describe('request queue', () => {
  it('serialises concurrent calls and spaces them out', async () => {
    setMinRequestInterval(30)
    resetRateLimiter()

    const stamps: number[] = []
    fetchMock.mockImplementation(async () => {
      stamps.push(Date.now())
      return okResponse({ balance: '1', account_state: 'active', seqno: 1 })
    })

    // Fired together — exactly the situation StrictMode's double effect creates.
    await Promise.all([getBalance(ADDR), getBalance(ADDR), getBalance(ADDR)])

    expect(stamps).toHaveLength(3)
    expect(stamps[1] - stamps[0]).toBeGreaterThanOrEqual(25)
    expect(stamps[2] - stamps[1]).toBeGreaterThanOrEqual(25)
  })

  it('a failed request does not stall the queue', async () => {
    setMinRequestInterval(0)
    resetRateLimiter()

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'nope' }, 422))
      .mockResolvedValueOnce(okResponse({ balance: '3', account_state: 'active', seqno: 1 }))

    await expect(getBalance(ADDR)).rejects.toThrow('nope')
    expect(await getBalance(ADDR)).toBe('3')
  })
})
