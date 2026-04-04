/**
 * Send page — the most security-sensitive screen.
 *
 * All three security mechanisms are active here:
 *  A) AddressDisplay highlights prefix+suffix of the confirmed address in modal
 *  B) ClipboardWarning shown when address was pasted
 *  C) NewAddressWarning shown for first-time recipients
 */

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

  // Load balance on mount with a 2.4 s delay so it doesn't collide with the
  // Wallet page's balance + tx requests (TON Center free tier: 1 req/s).
  useEffect(() => {
    const t = setTimeout(refreshBalance, 2400)
    return () => clearTimeout(t)
  }, [refreshBalance])
  const { isPasted, onPaste, onManualEdit, reset: resetClipboard } = useClipboardGuard()

  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [validationError, setValidationError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  if (!wallet) return null

  const balanceNano = nanotons ? BigInt(nanotons) : BigInt(0)

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!toAddress.trim()) return 'Recipient address is required.'
    if (!isValidTonAddress(toAddress)) return 'Invalid TON address format.'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return 'Amount must be greater than 0.'
    try {
      const sendNano = tonToNano(amount)
      if (sendNano > balanceNano) return 'Insufficient balance.'
    } catch {
      return 'Invalid amount.'
    }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError('')
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    setConfirmOpen(false)
    // Always send to the normalised address to prevent format-mismatch issues
    const destination = normAddr || toAddress.trim()
    try {
      await send({
        walletAddress: wallet.address,
        keys: wallet.keys,
        toAddress: destination,
        amountTon: amount,
        comment: comment || undefined,
      })
    } catch {
      // error already set in useSend
    }
  }

  const handleReset = () => {
    setToAddress('')
    setAmount('')
    setComment('')
    setValidationError('')
    resetClipboard()
    reset()
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <div className="page" style={{ padding: '1.5rem', maxWidth: '420px', margin: '0 auto' }}>
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <h3 style={{ color: '#16a34a', marginBottom: '0.75rem' }}>Transaction Sent!</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
            Transaction hash:
          </p>
          <code
            style={{
              fontSize: '0.7rem',
              wordBreak: 'break-all',
              background: '#dcfce7',
              padding: '0.5rem',
              borderRadius: '6px',
              display: 'block',
            }}
          >
            {txHash}
          </code>
          <button className="btn btn-primary" onClick={handleReset} style={{ marginTop: '1.25rem' }}>
            Send another
          </button>
        </div>
      </div>
    )
  }

  // Normalised address is used for all security checks so EQ/UQ/raw
  // variants of the same account are treated identically.
  const normAddr = isValidTonAddress(toAddress) ? normalizeAddress(toAddress) : ''
  const isFirstTime = normAddr && !isKnownAddress(normAddr)
  // SECURITY MECHANISM C (extension): detect prefix-swap attacks
  const similarKnown = normAddr && isFirstTime ? findSimilarKnownAddress(normAddr) : null

  return (
    <div className="page" style={{ padding: '1.5rem', maxWidth: '420px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Send TON</h2>

      {error && (
        <div
          className="error-banner"
          style={{
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: '#991b1b',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Recipient address */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Recipient address</label>
          <input
            type="text"
            value={toAddress}
            placeholder="UQ…"
            onPaste={() => onPaste()}
            onKeyDown={() => {
              if (isPasted) {
                // user is manually editing after paste — clear the warning
                setIsTyping(true)
              }
            }}
            onChange={e => {
              setToAddress(e.target.value)
              if (isTyping) {
                onManualEdit()
                setIsTyping(false)
              }
            }}
            style={inputStyle}
            autoComplete="off"
            spellCheck={false}
          />
          {/* SECURITY MECHANISM B — shown immediately after paste */}
          <ClipboardWarning visible={isPasted} />

          {/* SECURITY MECHANISM C (extension) — similar-address attack warning */}
          <SimilarAddressWarning similar={similarKnown ?? null} />

          {/* SECURITY MECHANISM C — first-time address inline hint (only when no stronger warning) */}
          {isFirstTime && !isPasted && !similarKnown && (
            <p style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.4rem' }}>
              ⚠️ You've never sent to this address before.
            </p>
          )}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Amount (TON)
            {nanotons && (
              <span style={{ float: 'right', color: 'var(--color-muted)', fontWeight: 400 }}>
                Balance: {formatTon(nanotons)} TON
              </span>
            )}
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.5"
            min="0"
            step="any"
            style={inputStyle}
          />
        </div>

        {/* Comment (optional) */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>Comment (optional)</label>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Payment for..."
            style={inputStyle}
          />
        </div>

        {validationError && (
          <p className="error-text" style={{ marginBottom: '0.75rem' }}>
            {validationError}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? <Spinner size={18} /> : 'Review & Send'}
        </button>
      </form>

      {/* Confirmation modal */}
      <Modal open={confirmOpen} title="Confirm Transaction" onClose={() => setConfirmOpen(false)}>
        {/* SECURITY MECHANISM C (extension) — highest-priority warning */}
        <SimilarAddressWarning similar={similarKnown ?? null} />
        {/* SECURITY MECHANISM C — first-send warning (shown when no similar-address warning) */}
        {!similarKnown && <NewAddressWarning visible={!!isFirstTime} />}

        <div style={{ fontSize: '0.9rem', lineHeight: 1.8, marginBottom: '1.25rem' }}>
          <div>
            <span style={{ color: 'var(--color-muted)' }}>To: </span>
            {/* SECURITY MECHANISM A — full highlighted address in confirmation */}
            <AddressDisplay address={normAddr || toAddress.trim()} full />
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)' }}>Amount: </span>
            <strong>{amount} TON</strong>
          </div>
          {comment && (
            <div>
              <span style={{ color: 'var(--color-muted)' }}>Comment: </span>
              {comment}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setConfirmOpen(false)}
            style={{ flex: 1 }}
          >
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.35rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--color-border, #ccc)',
  borderRadius: '8px',
  fontSize: '0.9rem',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
}
