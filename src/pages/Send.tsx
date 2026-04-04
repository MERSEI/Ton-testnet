import React, { useState, useEffect } from 'react'
import { useWalletContext } from '../store/WalletContext'
import { useBalance } from '../hooks/useBalance'
import { useSend } from '../hooks/useSend'
import { useClipboardGuard } from '../hooks/useClipboardGuard'
import { isValidTonAddress, formatTon, tonToNano, normalizeAddress } from '../utils/address'
import { isKnownAddress, findSimilarKnownAddress } from '../utils/addressBook'
import { AddressDisplay } from '../components/AddressDisplay'
import { ClipboardWarning } from '../components/ClipboardWarning'
import { NewAddressWarning } from '../components/NewAddressWarning'
import { SimilarAddressWarning } from '../components/SimilarAddressWarning'
import { Modal } from '../components/Modal'
import { Spinner } from '../components/Spinner'

export function Send() {
  const { wallet } = useWalletContext()
  const { nanotons, refresh: refreshBalance } = useBalance(wallet?.address ?? null)
  const { loading, txHash, error, send, reset } = useSend()
  const { isPasted, onPaste, onManualEdit, reset: resetClipboard } = useClipboardGuard()

  useEffect(() => {
    const t = setTimeout(refreshBalance, 2400)
    return () => clearTimeout(t)
  }, [refreshBalance])

  const [toAddress, setToAddress]       = useState('')
  const [amount, setAmount]             = useState('')
  const [comment, setComment]           = useState('')
  const [validationError, setValErr]    = useState('')
  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [isTyping, setIsTyping]         = useState(false)

  if (!wallet) return null

  const balanceNano = nanotons ? BigInt(nanotons) : BigInt(0)
  const normAddr    = isValidTonAddress(toAddress) ? normalizeAddress(toAddress) : ''
  const isFirstTime = normAddr && !isKnownAddress(normAddr)
  const similarKnown = normAddr && isFirstTime ? findSimilarKnownAddress(normAddr) : null

  function validate(): string | null {
    if (!toAddress.trim()) return 'Recipient address is required.'
    if (!isValidTonAddress(toAddress)) return 'Invalid TON address format.'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return 'Amount must be greater than 0.'
    try {
      if (tonToNano(amount) > balanceNano) return 'Insufficient balance.'
    } catch { return 'Invalid amount.' }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setValErr(err); return }
    setValErr('')
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    setConfirmOpen(false)
    try {
      await send({
        walletAddress: wallet.address,
        keys: wallet.keys,
        toAddress: normAddr || toAddress.trim(),
        amountTon: amount,
        comment: comment || undefined,
      })
    } catch { /* error already in useSend */ }
  }

  const handleReset = () => {
    setToAddress(''); setAmount(''); setComment('')
    setValErr(''); resetClipboard(); reset()
  }

  /* ── Success screen ──────────────────────────────────────────────── */
  if (txHash) {
    return (
      <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="tg-section" style={{ padding: '2rem', textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
          <h3 style={{ color: 'var(--green)', marginBottom: '0.5rem' }}>Transaction sent!</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Hash:</p>
          <code style={{
            fontSize: '0.7rem', wordBreak: 'break-all',
            background: 'var(--surface-2)', padding: '0.6rem',
            borderRadius: '8px', display: 'block', fontFamily: 'monospace',
          }}>
            {txHash}
          </code>
          <button className="btn btn-primary" onClick={handleReset} style={{ width: '100%', marginTop: '1.25rem' }}>
            Send again
          </button>
        </div>
      </div>
    )
  }

  /* ── Form ────────────────────────────────────────────────────────── */
  return (
    <div className="page-content">
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, padding: '0.25rem 0.25rem 0' }}>Send TON</h2>

      {/* Send error */}
      {error && (
        <div className="tg-section" role="alert" style={{
          padding: '0.75rem 1rem', borderLeft: '4px solid var(--red)',
          fontSize: '0.85rem', color: 'var(--red)',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Recipient */}
        <div>
          <div className="label-text">Recipient</div>
          <div className="tg-section" style={{ padding: '0.6rem 0.75rem' }}>
            <input
              className="tg-input mono"
              style={{ background: 'transparent', padding: '0.1rem 0' }}
              type="text"
              value={toAddress}
              placeholder="UQ… or EQ…"
              onPaste={() => onPaste()}
              onKeyDown={() => { if (isPasted) setIsTyping(true) }}
              onChange={e => {
                setToAddress(e.target.value)
                if (isTyping) { onManualEdit(); setIsTyping(false) }
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {/* Security warnings */}
          <ClipboardWarning visible={isPasted} />
          <SimilarAddressWarning similar={similarKnown ?? null} />
          {isFirstTime && !isPasted && !similarKnown && (
            <div style={{ fontSize: '0.8rem', color: 'var(--orange)', marginTop: '0.4rem', paddingLeft: '0.25rem' }}>
              ⚠️ You have never sent to this address before.
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="label-text">Amount (TON)</div>
            {nanotons && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Balance: {formatTon(nanotons)} TON
              </span>
            )}
          </div>
          <div className="tg-section" style={{ padding: '0.6rem 0.75rem' }}>
            <input
              className="tg-input mono"
              style={{ background: 'transparent', padding: '0.1rem 0', fontSize: '1.1rem' }}
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="any"
            />
          </div>
        </div>

        {/* Comment */}
        <div>
          <div className="label-text">Comment <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></div>
          <div className="tg-section" style={{ padding: '0.6rem 0.75rem' }}>
            <input
              className="tg-input"
              style={{ background: 'transparent', padding: '0.1rem 0' }}
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Payment for…"
            />
          </div>
        </div>

        {validationError && <p className="error-text">{validationError}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.85rem' }}>
          {loading ? <Spinner size={18} /> : 'Review & Send'}
        </button>
      </form>

      {/* ── Confirmation modal ──────────────────────────────────────── */}
      <Modal open={confirmOpen} title="Confirm Transaction" onClose={() => setConfirmOpen(false)}>
        <SimilarAddressWarning similar={similarKnown ?? null} />
        {!similarKnown && <NewAddressWarning visible={!!isFirstTime} />}

        <div className="tg-section" style={{ marginBottom: '1rem' }}>
          <div className="tg-cell">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: 60 }}>To</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', wordBreak: 'break-all' }}>
              {/* SECURITY A — highlighted address */}
              <AddressDisplay address={normAddr || toAddress.trim()} full />
            </span>
          </div>
          <div className="tg-cell">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: 60 }}>Amount</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{amount} TON</span>
          </div>
          {comment && (
            <div className="tg-cell">
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: 60 }}>Comment</span>
              <span style={{ fontSize: '0.9rem' }}>{comment}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)} style={{ flex: 1 }}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleConfirm} style={{ flex: 1 }}>
            Confirm Send
          </button>
        </div>
      </Modal>
    </div>
  )
}
