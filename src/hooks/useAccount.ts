import { useState, useCallback, useEffect, useRef } from 'react'
import { getWalletInformation } from '../api/tonCenter'

export type AccountState = {
  /** Balance in nanotons, or null while unknown */
  nanotons: string | null
  /** Current seqno, or null while unknown */
  seqno: number | null
  /** Whether the wallet contract exists on-chain, or null while unknown */
  deployed: boolean | null
  loading: boolean
  /**
   * True once a fetch has succeeded at least once.
   *
   * Callers must distinguish "balance is zero" from "balance is unknown": the
   * Send screen previously treated a failed load as a zero balance and rejected
   * every transfer with "Insufficient balance", which reads as a wallet bug
   * rather than a network problem.
   */
  loaded: boolean
  error: string | null
}

const INITIAL: AccountState = {
  nanotons: null,
  seqno: null,
  deployed: null,
  loading: false,
  loaded: false,
  error: null,
}

/**
 * Balance + seqno + deployment state for one address.
 *
 * One request covers all three (see api/tonCenter#getWalletInformation), which
 * keeps us well inside the free-tier rate limit.
 */
export function useAccount(address: string | null) {
  const [state, setState] = useState<AccountState>(INITIAL)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!address) return
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const info = await getWalletInformation(address)
      if (!alive.current) return
      setState({
        nanotons: info.balance,
        seqno: info.seqno,
        deployed: info.deployed,
        loading: false,
        loaded: true,
        error: null,
      })
    } catch (e) {
      if (!alive.current) return
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [address])

  return { ...state, refresh }
}
