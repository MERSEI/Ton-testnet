import { useState, useRef } from 'react'
import { getSeqno, sendBoc } from '../api/tonCenter'
import { buildTransferBoc } from '../crypto/wallet'
import { addKnownAddress } from '../utils/addressBook'
import type { WalletKeys } from '../crypto/wallet'

type SendState = {
  loading: boolean
  /** Set once the network accepted the message. '' means accepted without a hash. */
  txHash: string | null
  error: string | null
}

export function useSend() {
  const [state, setState] = useState<SendState>({
    loading: false,
    txHash: null,
    error: null,
  })
  /** Re-entrancy guard: two rapid confirms would sign two messages with the same seqno. */
  const inFlight = useRef(false)

  const send = async (params: {
    walletAddress: string
    keys: WalletKeys
    toAddress: string
    amountTon: string
    comment?: string
  }) => {
    if (inFlight.current) return null
    inFlight.current = true
    setState({ loading: true, txHash: null, error: null })
    try {
      // Always read the seqno immediately before signing — a stale value produces
      // a message the network rejects without telling us.
      const seqno = await getSeqno(params.walletAddress)
      const boc = await buildTransferBoc({
        keys: params.keys,
        toAddress: params.toAddress,
        amountTon: params.amountTon,
        seqno,
        comment: params.comment,
      })
      const result = await sendBoc(boc)

      // SECURITY MECHANISM C: the address is now confirmed by an actual send.
      addKnownAddress(params.toAddress)

      setState({ loading: false, txHash: result.hash, error: null })
      return result.hash
    } catch (e) {
      setState({ loading: false, txHash: null, error: (e as Error).message })
      throw e
    } finally {
      inFlight.current = false
    }
  }

  const reset = () => setState({ loading: false, txHash: null, error: null })

  return { ...state, send, reset }
}
