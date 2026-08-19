/**
 * TON Center API v2 — testnet.
 * Docs: https://testnet.toncenter.com/api/v2/
 *
 * Responsibilities of this module:
 *   1. Thin, typed wrappers around the REST endpoints we need.
 *   2. Client-side request serialisation + 429 backoff. The free tier allows
 *      ~1 request/second per IP; React StrictMode alone double-fires effects,
 *      so without a queue the very first render reliably trips the limit.
 *   3. Defensive parsing — the API is a third party and its optional fields
 *      must never be able to crash a render.
 *
 * All failures surface as thrown Error objects so hooks can set error state.
 */

const BASE = 'https://testnet.toncenter.com/api/v2'

/** Optional API key (raises the rate limit). Set VITE_TONCENTER_API_KEY in .env.local */
const API_KEY: string | undefined =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_TONCENTER_API_KEY || undefined

/** Free tier is 1 req/s; keep a small safety margin. */
const DEFAULT_MIN_INTERVAL_MS = API_KEY ? 120 : 1100
const MAX_RETRIES = 3
const REQUEST_TIMEOUT_MS = 20_000

// ─── Types ───────────────────────────────────────────────────────────────────

export type RawMsg = {
  source?: string
  destination?: string
  value?: string
  message?: string
  fwd_fee?: string
}

export type RawTransaction = {
  utime?: number
  transaction_id?: { lt?: string; hash?: string }
  in_msg?: RawMsg
  out_msgs?: RawMsg[]
  fee?: string
  storage_fee?: string
  other_fee?: string
}

export type TonTransaction = {
  hash: string
  lt: string
  timestamp: number // unix seconds
  type: 'in' | 'out'
  amount: string   // nanotons
  address: string  // counterparty address
  fee: string      // nanotons, total fees charged to this account
  comment?: string
}

/** Everything we need about an account in a single round-trip. */
export type WalletInformation = {
  /** Balance in nanotons */
  balance: string
  /** Current seqno. 0 for an account that has not been deployed yet. */
  seqno: number
  /** false when account_state is "uninitialized" / "nonexist" */
  deployed: boolean
  /** e.g. "wallet v4 r2" — undefined for non-wallet or uninitialised accounts */
  walletType?: string
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

let minIntervalMs = DEFAULT_MIN_INTERVAL_MS
let queueTail: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

/** Test seam: shrink the inter-request delay so suites do not sleep for seconds. */
export function setMinRequestInterval(ms: number): void {
  minIntervalMs = ms
}

/** Test seam: forget the queue / backoff state between cases. */
export function resetRateLimiter(): void {
  queueTail = Promise.resolve()
  lastRequestAt = 0
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Serialise every outbound call through a single chain and space the calls at
 * least `minIntervalMs` apart. A rejection must not poison the chain, hence the
 * `.catch()` on the stored tail.
 */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastRequestAt + minIntervalMs - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      return await task()
    } finally {
      lastRequestAt = Date.now()
    }
  })
  queueTail = run.catch(() => undefined)
  return run as Promise<T>
}

// ─── Transport ───────────────────────────────────────────────────────────────

class RateLimitError extends Error {
  constructor() {
    super('TON Center rate limit reached.')
    this.name = 'RateLimitError'
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_KEY) h['X-API-Key'] = API_KEY
  return h
}

/** Some environments (jsdom) lack AbortSignal.timeout — degrade gracefully. */
function timeoutSignal(): AbortSignal | undefined {
  const ctor = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }
  return typeof ctor.timeout === 'function' ? ctor.timeout(REQUEST_TIMEOUT_MS) : undefined
}

type Envelope = { ok?: boolean; result?: unknown; error?: string }

async function once<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers(), signal: timeoutSignal() })

  if (res.status === 429) throw new RateLimitError()
  if (res.status >= 500) throw new Error(`TON Center is unavailable (${res.status}). Try again shortly.`)

  // 4xx bodies still carry a useful `error` string — read it before giving up.
  let json: Envelope | null = null
  try {
    json = (await res.json()) as Envelope
  } catch {
    /* non-JSON body */
  }

  if (json && json.ok === false) throw new Error(json.error ?? `TON Center error ${res.status}`)
  if (!res.ok) throw new Error(`TON Center ${res.status}: ${res.statusText || 'request failed'}`)
  if (!json || json.ok !== true) throw new Error('Malformed response from TON Center.')

  return json.result as T
}

/** Retry 429 / transient failures with exponential backoff. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await enqueue(() => once<T>(url, init))
    } catch (e) {
      lastErr = e
      const msg = String((e as Error)?.message ?? '')
      const retryable = e instanceof RateLimitError || /unavailable|network|fetch failed/i.test(msg)
      if (!retryable || attempt === MAX_RETRIES) break
      await sleep(minIntervalMs * Math.pow(2, attempt))
    }
  }
  if (lastErr instanceof RateLimitError) {
    throw new Error('Rate limited by TON Center (1 req/s on the free tier). Wait a moment and try again.')
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return request<T>(url.toString())
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body) })
}

// ─── Public API ──────────────────────────────────────────────────────────────

type RawWalletInformation = {
  wallet?: boolean
  balance?: string | number
  account_state?: string
  wallet_type?: string
  seqno?: number
}

/**
 * Balance + seqno + deployment state in one call.
 *
 * Using this instead of getAddressBalance + runGetMethod halves the number of
 * requests, which matters against a 1 req/s budget.
 */
export async function getWalletInformation(address: string): Promise<WalletInformation> {
  const r = await getJson<RawWalletInformation>('/getWalletInformation', { address })
  const state = r.account_state ?? 'uninitialized'
  const seqno = Number(r.seqno)
  return {
    balance: String(r.balance ?? '0'),
    seqno: Number.isFinite(seqno) ? seqno : 0,
    deployed: state === 'active',
    walletType: r.wallet_type,
  }
}

/** Get account balance in nanotons (string) */
export async function getBalance(address: string): Promise<string> {
  const info = await getWalletInformation(address)
  return info.balance
}

/**
 * Fetch the wallet seqno.
 *
 * Correctness note: signing with a stale seqno produces a message the network
 * silently rejects, so a *guessed* seqno is worse than a hard failure — the user
 * would see "sent!" for a transaction that never lands. We therefore return 0
 * only when the account is genuinely uninitialised and let network errors throw.
 *
 * `runGetMethod` is POST-only on TON Center v2 (a GET returns 404, which the
 * previous implementation swallowed into a constant seqno of 0). It is used here
 * purely as a fallback for active accounts whose response omits `seqno`.
 */
export async function getSeqno(address: string): Promise<number> {
  const info = await getWalletInformation(address)
  if (!info.deployed) return 0
  if (info.seqno > 0) return info.seqno

  const res = await postJson<{ stack?: Array<[string, string]>; exit_code?: number }>(
    '/runGetMethod',
    { address, method: 'seqno', stack: [] },
  )
  if (res.exit_code !== undefined && res.exit_code !== 0) return 0
  const parsed = parseInt(res.stack?.[0]?.[1] ?? '0x0', 16)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Get last N transactions for an address */
export async function getTransactions(address: string, limit = 20): Promise<TonTransaction[]> {
  const raw = await getJson<RawTransaction[]>('/getTransactions', {
    address,
    limit: String(limit),
  })
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeTransaction)
}

/**
 * Map one raw transaction to our flat shape.
 *
 * Direction: an outgoing wallet transfer arrives as an *external* in_msg with
 * value "0" plus one or more out_msgs. An incoming transfer has an in_msg
 * carrying value and usually no out_msgs. Every field is optional in practice,
 * so nothing here may assume presence.
 */
function normalizeTransaction(tx: RawTransaction): TonTransaction {
  const outMsgs = Array.isArray(tx.out_msgs) ? tx.out_msgs : []
  const inValue = tx.in_msg?.value ?? '0'
  const isIncoming = inValue !== '0' && inValue !== ''

  const base = {
    hash: tx.transaction_id?.hash ?? '',
    lt: tx.transaction_id?.lt ?? '',
    timestamp: Number(tx.utime ?? 0),
    fee: String(tx.fee ?? '0'),
  }

  if (isIncoming) {
    return {
      ...base,
      type: 'in',
      amount: inValue,
      address: tx.in_msg?.source ?? '',
      comment: tx.in_msg?.message || undefined,
    }
  }

  // Outgoing: sum every out_msg so multi-message transfers report the true total.
  const total = outMsgs.reduce((acc, m) => acc + toBigIntSafe(m.value), BigInt(0))
  return {
    ...base,
    type: 'out',
    amount: total.toString(),
    address: outMsgs[0]?.destination ?? '',
    comment: outMsgs[0]?.message || undefined,
  }
}

function toBigIntSafe(v: string | undefined): bigint {
  try {
    return BigInt(v ?? '0')
  } catch {
    return BigInt(0)
  }
}

/**
 * Broadcast a signed BOC (base64) and return its hash.
 *
 * We call `sendBocReturnHash` rather than `sendBoc`: plain `sendBoc` responds
 * with `{"@type":"ok"}` and no hash, which left the UI with nothing to render
 * after a successful send.
 */
export async function sendBoc(boc: string): Promise<{ hash: string }> {
  const result = await postJson<{ hash?: string } | null>('/sendBocReturnHash', { boc })
  return { hash: result?.hash ?? '' }
}
