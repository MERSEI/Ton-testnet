/**
 * TON Center API v2 — testnet, no auth required.
 * Docs: https://testnet.toncenter.com/api/v2/
 *
 * Design: thin wrappers around fetch().  No caching or retry logic here —
 * that lives in React hooks.  All errors surface as thrown Error objects so
 * hooks can set error state.
 */

const BASE = 'https://testnet.toncenter.com/api/v2'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TonCenterBalance = {
  ok: boolean
  result: string // nanotons as string
}

export type RawTransaction = {
  utime: number
  transaction_id: {
    lt: string
    hash: string
  }
  in_msg?: {
    source: string
    destination: string
    value: string // nanotons
    message?: string
  }
  out_msgs: Array<{
    source: string
    destination: string
    value: string
    message?: string
  }>
  fee: string
}

export type TonTransaction = {
  hash: string
  lt: string
  timestamp: number // unix seconds
  type: 'in' | 'out'
  amount: string   // nanotons
  address: string  // counterparty address
  fee: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TON Center ${res.status}: ${res.statusText}`)
  const json = (await res.json()) as { ok: boolean; result: unknown; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'TON Center API error')
  return json.result as T
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get account balance in nanotons (string) */
export async function getBalance(address: string): Promise<string> {
  const result = await get<string>('/getAddressBalance', { address })
  return result
}

/** Get last N transactions for an address */
export async function getTransactions(
  address: string,
  limit = 20,
): Promise<TonTransaction[]> {
  const raw = await get<RawTransaction[]>('/getTransactions', {
    address,
    limit: String(limit),
  })

  return raw.map((tx): TonTransaction => {
    // Determine direction: if in_msg has a non-empty value, it's incoming
    const isIncoming =
      tx.in_msg !== undefined &&
      tx.in_msg.value !== '0' &&
      tx.in_msg.value !== ''

    if (isIncoming && tx.in_msg) {
      return {
        hash: tx.transaction_id.hash,
        lt: tx.transaction_id.lt,
        timestamp: tx.utime,
        type: 'in',
        amount: tx.in_msg.value,
        address: tx.in_msg.source,
        fee: tx.fee,
      }
    }

    // Outgoing: take first out_msg
    const out = tx.out_msgs[0]
    return {
      hash: tx.transaction_id.hash,
      lt: tx.transaction_id.lt,
      timestamp: tx.utime,
      type: 'out',
      amount: out?.value ?? '0',
      address: out?.destination ?? '',
      fee: tx.fee,
    }
  })
}

/** Send a signed BOC (base64 encoded cell) to the network */
export async function sendBoc(boc: string): Promise<{ hash: string }> {
  const url = `${BASE}/sendBoc`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boc }),
  })
  if (!res.ok) throw new Error(`TON Center ${res.status}: ${res.statusText}`)
  const json = (await res.json()) as { ok: boolean; result?: { hash: string }; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'sendBoc failed')
  return json.result ?? { hash: '' }
}

/** Get seqno for a wallet address (returns 0 if account not yet deployed) */
export async function getSeqno(address: string): Promise<number> {
  try {
    const result = await get<{ stack: Array<[string, string]> }>('/runGetMethod', {
      address,
      method: 'seqno',
      stack: '[]',
    })
    // Stack result: [["num", "0x0"]]
    const hex = result.stack?.[0]?.[1] ?? '0x0'
    return parseInt(hex, 16)
  } catch {
    // Account not deployed yet — seqno is 0
    return 0
  }
}
