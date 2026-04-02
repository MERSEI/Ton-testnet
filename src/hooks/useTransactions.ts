import { useState, useCallback } from 'react'
import { getTransactions, type TonTransaction } from '../api/tonCenter'

type TxState = {
  transactions: TonTransaction[]
  loading: boolean
  error: string | null
}

export function useTransactions(address: string | null) {
  const [state, setState] = useState<TxState>({
    transactions: [],
    loading: false,
    error: null,
  })

  const refresh = useCallback(async () => {
    if (!address) return
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const txs = await getTransactions(address, 20)
      setState({ transactions: txs, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [address])

  return { ...state, refresh }
}
