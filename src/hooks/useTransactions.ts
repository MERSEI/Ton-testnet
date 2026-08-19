import { useState, useCallback, useEffect, useRef } from 'react'
import { getTransactions, type TonTransaction } from '../api/tonCenter'

type TxState = {
  transactions: TonTransaction[]
  loading: boolean
  loaded: boolean
  error: string | null
}

export function useTransactions(address: string | null) {
  const [state, setState] = useState<TxState>({
    transactions: [],
    loading: false,
    loaded: false,
    error: null,
  })
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
      const txs = await getTransactions(address, 20)
      if (!alive.current) return
      setState({ transactions: txs, loading: false, loaded: true, error: null })
    } catch (e) {
      if (!alive.current) return
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [address])

  return { ...state, refresh }
}
