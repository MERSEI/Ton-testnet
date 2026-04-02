import { useState, useCallback } from 'react'
import { getBalance } from '../api/tonCenter'

type BalanceState = {
  nanotons: string | null
  loading: boolean
  error: string | null
}

export function useBalance(address: string | null) {
  const [state, setState] = useState<BalanceState>({
    nanotons: null,
    loading: false,
    error: null,
  })

  const refresh = useCallback(async () => {
    if (!address) return
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const nano = await getBalance(address)
      setState({ nanotons: nano, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [address])

  return { ...state, refresh }
}
