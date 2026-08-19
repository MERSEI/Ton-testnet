import React, { useState, useEffect, useMemo } from 'react'
import { useWalletContext } from '../store/WalletContext'
import { useAccount } from '../hooks/useAccount'
import { useSend } from '../hooks/useSend'
import { useClipboardGuard } from '../hooks/useClipboardGuard'
import {
  formatTon,
  tonToNano,
  normalizeAddress,
  parseTonAddress,
  isSameAddress,
} from '../utils/address'
import { getKnownAddress, findSimilarKnownAddress } from '../utils/addressBook'
import { MAX_COMMENT_BYTES } from '../crypto/wallet'
import { AddressPlate } from '../components/AddressPlate'
import { ClipboardWarning } from '../components/ClipboardWarning'
import { NewAddressWarning } from '../components/NewAddressWarning'
import { SimilarAddressWarning } from '../components/SimilarAddressWarning'
import { Modal } from '../components/Modal'
import { Spinner } from '../components/Spinner'

/**
 * Reserved for network fees when computing the maximum sendable amount.
 *
 * A simple v4 transfer costs roughly 0.005 TON. Reserving 0.01 TON keeps "Max"
 * from producing a transfer the network then rejects for insufficient funds.
 * A production wallet would call estimateFee instead of using a constant.
 */
const FEE_RESERVE_NANO = BigInt(10_000_000)

export function Send() {
  const { wallet } = useWalletContext()
  const account = useAccount(wallet?.address ?? null)
  const {
    nanotons, deployed, loaded: balanceLoaded, loading: balanceLoading,
    error: balanceError, refresh: refreshAccount,
  } = account
  const { loading, txHash, error, send, reset } = useSend()
  const { isPasted, onPaste, onManualEdit, reset: resetClipboard } = useClipboardGuard()

  const [toAddress, setToAddress]     = useState('')
  const [amount, setAmount]           = useState('')
  const [comment, setComment]         = useState('')
  const [validationError, setValErr]  = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isTyping, setIsTyping]       = useState(false)

  useEffect(() => {
    refreshAccount()
  }, [refreshAccount])

  const walletAddress = wallet?.address ?? ''

  const parsed = useMemo(() => parseTonAddress(toAddress), [toAddress])
  const normAddr = parsed?.canonical ?? ''

  const isSelfSend = !!normAddr && isSameAddress(normAddr, walletAddress)

  const knownEntry = normAddr && !isSelfSend ? getKnownAddress(normAddr) : null
  /** Only a send from this device counts as full familiarity — see utils/addressBook. */
  const isConfirmedRecipient = knownEntry?.source === 'sent'
  const isSeededRecipient    = knownEntry?.source === 'history'
  const isFirstTime          = !!normAddr && !isSelfSend && !knownEntry

  const similarKnown = useMemo(
    () => (normAddr && !isSelfSend && !isConfirmedRecipient ? findSimilarKnownAddress(normAddr) : null),
    [normAddr, isSelfSend, isConfirmedRecipient],
  )

  const commentBytes = useMemo(() => new TextEncoder().encode(comment).length, [comment])

  const balanceNano = nanotons !== null ? BigInt(nanotons) : null
  const maxSendable =
    balanceNano !== null && balanceNano > FEE_RESERVE_NANO ? balanceNano - FEE_RESERVE_NANO : BigInt(0)

  const addressTouched = toAddress.trim().length > 0
  const addressInvalid = addressTouched && !parsed

  if (!wallet) return null

  function validate(): string | null {
    if (!toAddress.trim()) return 'Recipient address is required.'
    if (!parsed) return 'Invalid TON address — check the characters, the checksum does not match.'
    if (isSelfSend) return 'This is your own address. Sending to yourself only burns fees.'
    if (!amount.trim()) return 'Amount is required.'

    let value: bigint
    try {
      value = tonToNano(amount)
    } catch {
      return 'Amount must be a plain decimal number, e.g. 1.25.'
    }
    if (value <= BigInt(0)) return 'Amount must be greater than 0.'

    // Never fall back to "zero balance" when the balance simply failed to load —
    // that used to surface a network problem as "Insufficient balance".
    if (!balanceLoaded || balanceNano === null) {
      return 'Your balance could not be loaded yet. Refresh before sending.'
    }
    if (value > balanceNano) return 'Insufficient balance.'
    if (value > balanceNano - FEE_RESERVE_NANO) {
      return `Leave at least ${formatTon(FEE_RESERVE_NANO)} TON for network fees. Use Max to fill the largest safe amount.`
    }
    if (commentBytes > MAX_COMMENT_BYTES) {
      return `Comment is too long (${commentBytes}/${MAX_COMMENT_BYTES} bytes).`
    }
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
    if (loading) return
    setConfirmOpen(false)
    try {
      await send({
        walletAddress: wallet.address,
        keys: wallet.keys,
        toAddress: normAddr,
        amountTon: amount,
        comment: comment.trim() || undefined,
      })
      refreshAccount()
    } catch { /* error already surfaced by useSend */ }
  }

  const handleMax = () => setAmount(formatTon(maxSendable))

  const handleReset = () => {
    setToAddress(''); setAmount(''); setComment('')
    setValErr(''); resetClipboard(); reset()
    refreshAccount()
  }

  /* ── Success ─────────────────────────────────────────────────────── */
  // txHash may legitimately be '' — the network accepted the message but the
  // endpoint returned no hash. `!== null` is what marks a completed send.
  if (txHash !== null) {
    return (
      <div className="shell">
        <div className="panel rise rise-1">
          <div className="panel__head">
            <span className="chip chip--live">
              <span className="chip__dot" aria-hidden="true" />
              Broadcast
            </span>
          </div>
          <div className="panel__body stack" style={{ textAlign: 'center' }}>
            <div className="glyph-badge" style={{ margin: '0 auto' }} aria-hidden="true">✓</div>
            <h2 className="title">Transaction sent</h2>

            {txHash ? (
              <div style={{ textAlign: 'left' }}>
                <div className="label" style={{ marginBottom: 'calc(var(--step) * 2)' }}>Hash</div>
                <div className="panel panel--quiet" style={{ padding: 'calc(var(--step) * 3)' }}>
                  <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--bone-dim)' }}>
                    {txHash}
                  </code>
                </div>
              </div>
            ) : (
              <p className="meta">
                The network accepted the message. It will appear in your history within a few seconds.
              </p>
            )}

            <div className="alert alert--info" style={{ textAlign: 'left' }}>
              <span className="alert__glyph" aria-hidden="true">○</span>
              <span>
                Broadcast is not confirmation — check the Wallet tab to see it land in a block.
              </span>
            </div>

            <button className="btn btn--primary btn--block btn--tall" onClick={handleReset}>
              Send again
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Form ────────────────────────────────────────────────────────── */
  return (
    <div className="shell">
      <header className="row rise rise-1">
        <h2 className="title">Send</h2>
        <span className="chip">Testnet</span>
      </header>

      {error && (
        <div className="alert alert--danger rise rise-1" role="alert">
          <span className="alert__glyph" aria-hidden="true">▲</span>
          <span>{error}</span>
        </div>
      )}

      {balanceError && (
        <div className="alert alert--warn rise rise-1" role="alert">
          <span className="alert__glyph" aria-hidden="true">◆</span>
          <span>
            <strong>Balance unavailable:</strong> {balanceError}
            <span style={{ display: 'block', marginTop: 'calc(var(--step) * 2)' }}>
              <button className="btn btn--small" type="button" onClick={refreshAccount} disabled={balanceLoading}>
                {balanceLoading ? <Spinner size={12} /> : 'Retry'}
              </button>
            </span>
          </span>
        </div>
      )}

      {deployed === false && (
        <div className="alert alert--info rise rise-1">
          <span className="alert__glyph" aria-hidden="true">○</span>
          <span>
            This wallet is not on-chain yet. Your first outgoing transfer also deploys the
            contract, which costs a small extra fee.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="stack rise rise-2">
        {/* Recipient */}
        <div className="field">
          <span className="label">Recipient</span>
          <div className={`field__frame ${addressInvalid ? 'field__frame--alert' : ''}`}>
            <input
              className="input"
              type="text"
              value={toAddress}
              placeholder="UQ…, EQ…, kQ… or 0Q…"
              aria-label="Recipient address"
              onPaste={() => onPaste()}
              onKeyDown={() => { if (isPasted) setIsTyping(true) }}
              onChange={e => {
                setToAddress(e.target.value)
                if (isTyping) { onManualEdit(); setIsTyping(false) }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {parsed && !isSelfSend && (
              <span className="chip chip--live" aria-hidden="true">✓ Valid</span>
            )}
          </div>

          {/* A verification plate: grouped, corners marked. The point of the whole app. */}
          {parsed && !isSelfSend && (
            <div className="panel panel--quiet" style={{ padding: 'calc(var(--step) * 3)' }}>
              <AddressPlate address={normAddr} size="sm" />
            </div>
          )}

          <ClipboardWarning visible={isPasted} />
          <SimilarAddressWarning similar={similarKnown} />

          {isSelfSend && (
            <div className="hint hint--danger" role="alert">
              <span aria-hidden="true">⛔</span> This is your own address.
            </div>
          )}

          {isFirstTime && !isPasted && !similarKnown && (
            <div className="hint hint--warn">
              <span aria-hidden="true">◆</span> You have never sent to this address before.
            </div>
          )}

          {/* Provenance matters: a history-seeded match is weaker evidence than a
              send this device performed, so it does not silence the warning. */}
          {isSeededRecipient && !similarKnown && (
            <div className="hint">
              <span aria-hidden="true">○</span> Recognised from this wallet&rsquo;s on-chain
              history, not from a send made on this device. Verify the address anyway.
            </div>
          )}

          {isConfirmedRecipient && !similarKnown && (
            <div className="hint hint--ok">
              <span aria-hidden="true">✓</span> You have sent to this address from this device before.
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="field">
          <div className="section-head">
            <span className="label">Amount · TON</span>
            {nanotons !== null && (
              <span className="counter">Balance: {formatTon(nanotons)} TON</span>
            )}
          </div>
          <div className="field__frame">
            {/* Deliberately type="text" rather than type="number": a number input
                renders the value in the browser's locale (so "0.98" shows as "0,98"
                where commas are decimal separators, which our strict parser
                rejects) and mutates the amount on an accidental scroll. inputMode
                still brings up the numeric keypad on mobile. */}
            <input
              className="input input--lg"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(',', '.'))}
              placeholder="0.0"
              aria-label="Amount in TON"
            />
            <button
              type="button"
              className="btn btn--small"
              onClick={handleMax}
              disabled={maxSendable <= BigInt(0)}
              title={`Send everything except a ${formatTon(FEE_RESERVE_NANO)} TON fee reserve`}
            >
              Max
            </button>
          </div>
        </div>

        {/* Comment */}
        <div className="field">
          <div className="section-head">
            <span className="label">Comment · optional</span>
            <span className={`counter ${commentBytes > MAX_COMMENT_BYTES ? 'counter--over' : ''}`}>
              {commentBytes}/{MAX_COMMENT_BYTES}
            </span>
          </div>
          <div className="field__frame">
            <input
              className="input"
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Payment for…"
              aria-label="Comment"
            />
          </div>
        </div>

        {validationError && <p className="error-text" role="alert">{validationError}</p>}

        <button className="btn btn--primary btn--block btn--tall" type="submit" disabled={loading}>
          {loading ? <Spinner size={16} /> : 'Review & Send'}
        </button>
      </form>

      {/* ── Confirmation ────────────────────────────────────────────── */}
      <Modal open={confirmOpen} title="Confirm Transaction" onClose={() => setConfirmOpen(false)}>
        <SimilarAddressWarning similar={similarKnown} />
        {!similarKnown && <NewAddressWarning visible={isFirstTime} />}
        {/* A history-seeded match is weaker evidence than a send from this device,
            so the confirmation step must repeat that caveat rather than look clean. */}
        {!similarKnown && isSeededRecipient && (
          <div className="alert alert--info" style={{ marginBottom: '0.75rem' }}>
            <span className="alert__glyph" aria-hidden="true">○</span>
            <span>
              Recognised from on-chain history only — you have not sent to this address from
              this device.
            </span>
          </div>
        )}

        <div className="stack-s" style={{ marginBottom: 'calc(var(--step) * 5)' }}>
          <span className="label">Sending to</span>
          <div className="panel panel--quiet" style={{ padding: 'calc(var(--step) * 4)' }}>
            <AddressPlate address={normAddr || normalizeAddress(toAddress)} />
          </div>
        </div>

        <div>
          <div className="def">
            <span className="def__key">Amount</span>
            <span className="def__val num" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              {amount} TON
            </span>
          </div>
          <div className="def">
            <span className="def__key">Bounce</span>
            <span className="def__val">
              {parsed?.isBounceable
                ? 'On — funds return if the account does not exist'
                : 'Off — standard for wallet addresses'}
            </span>
          </div>
          {comment.trim() && (
            <div className="def">
              <span className="def__key">Comment</span>
              <span className="def__val">{comment}</span>
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 'calc(var(--step) * 3)', marginTop: 'calc(var(--step) * 5)' }}>
          <button className="btn btn--block" onClick={() => setConfirmOpen(false)}>
            Cancel
          </button>
          <button className="btn btn--danger btn--block" onClick={handleConfirm} disabled={loading}>
            {loading ? <Spinner size={14} /> : 'Confirm Send'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
