import { useState } from 'react'
import { getSeqno, sendBoc } from '../api/tonCenter'
import { buildTransferBoc } from '../crypto/wallet'
import { addKnownAddress } from '../utils/addressBook'
import type { WalletKeys } from '../crypto/wallet'

type SendState = {
  loading: boolean
  txHash: string | null
  error: string | null
}

export function useSend() {
  const [state, setState] = useState<SendState>({
    loading: false,
    txHash: null,
    error: null,
  })

  const send = async (params: {
    walletAddress: string
    keys: WalletKeys
    toAddress: string
    amountTon: string
    comment?: string
  }) => {
    setState({ loading: true, txHash: null, error: null })
    try {
      const seqno = await getSeqno(params.walletAddress)
      const boc = await buildTransferBoc({
        keys: params.keys,
        toAddress: params.toAddress,
        amountTon: params.amountTon,
        seqno,
        comment: params.comment,
      })
      const result = await sendBoc(boc)

      // SECURITY MECHANISM C: mark this address as known after success
      addKnownAddress(params.toAddress)

      setState({ loading: false, txHash: result.hash, error: null })
      return result.hash
    } catch (e) {
      setState({ loading: false, txHash: null, error: (e as Error).message })
      throw e
    }
  }

  const reset = () => setState({ loading: false, txHash: null, error: null })

  return { ...state, send, reset }
}
