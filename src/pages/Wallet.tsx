import React, { useEffect, useRef, useState } from 'react'
import { useWalletContext } from '../store/WalletContext'
import { useAccount } from '../hooks/useAccount'
import { useTransactions } from '../hooks/useTransactions'
import { AddressDisplay } from '../components/AddressDisplay'
import { AddressPlate } from '../components/AddressPlate'
import { Spinner } from '../components/Spinner'
import { HelpModal } from '../components/HelpModal'
import { formatTon } from '../utils/address'
import { seedAddressBookFromHistory } from '../utils/addressBook'
import { copyToClipboard } from '../utils/clipboard'
import type { TonTransaction } from '../api/tonCenter'

type Tab = 'wallet' | 'send' | 'receive'
type Props = { onNavigate: (tab: Tab) => void }

const REFRESH_COOLDOWN_MS = 5000
const EXPLORER = 'https://testnet.tonviewer.com'

/** The wallet dashboard: balance, address, quick actions and transaction ledger. */
export function Wallet({ onNavigate }: Props) {
  const { wallet, clearWallet } = useWalletContext()
  const {
    nanotons, deployed, loading: balLoading, loaded: balLoaded, error: balError,
    refresh: refreshAccount,
  } = useAccount(wallet?.address ?? null)
  const {
    transactions, loading: txLoading, loaded: txLoaded, error: txError,
    refresh: refreshTx,
  } = useTransactions(wallet?.address ?? null)

  const [showFull, setShowFull]        = useState(true)
  const [search, setSearch]            = useState('')
  const [refreshCooldown, setCooldown] = useState(false)
  const [showHelp, setShowHelp]        = useState(false)
  const [copied, setCopied]            = useState(false)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Clear pending timers on unmount so no state update lands on a dead component.
  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  // Both calls go through the API layer's request queue, which spaces them out —
  // no manual stagger, and StrictMode's double invocation no longer trips the limit.
  useEffect(() => {
    refreshAccount()
    refreshTx()
  }, [refreshAccount, refreshTx])

  useEffect(() => {
    if (transactions.length > 0) seedAddressBookFromHistory(transactions)
  }, [transactions])

  if (!wallet) return null

  const handleRefresh = () => {
    if (refreshCooldown) return
    setCooldown(true)
    refreshAccount()
    refreshTx()
    timers.current.push(setTimeout(() => setCooldown(false), REFRESH_COOLDOWN_MS))
  }

  const handleCopy = async () => {
    if (await copyToClipboard(wallet.address)) {
      setCopied(true)
      timers.current.push(setTimeout(() => setCopied(false), 2000))
    }
  }

  const query = search.trim().toLowerCase()
  const filtered: TonTransaction[] = transactions.filter(tx => {
    if (!query) return true
    return (
      tx.address.toLowerCase().includes(query) ||
      formatTon(tx.amount).includes(query) ||
      (tx.comment ?? '').toLowerCase().includes(query)
    )
  })

  return (
    <>
      <div className="shell">
        {/* ── Instrument header ──────────────────────────────────────── */}
        <header className="row rise rise-1">
          <span className="wordmark">TON&thinsp;·&thinsp;Wallet</span>
          <div style={{ display: 'flex', gap: 'calc(var(--step) * 2)' }}>
            <button className="btn btn--icon" onClick={handleCopy} title="Copy address" aria-label="Copy address">
              {copied ? '✓' : '⧉'}
            </button>
            <button className="btn btn--icon" onClick={() => setShowHelp(true)} title="Help" aria-label="Help">?</button>
            <button className="btn btn--icon" onClick={clearWallet} title="Disconnect wallet" aria-label="Disconnect wallet">⏻</button>
          </div>
        </header>

        {/* ── Balance instrument ─────────────────────────────────────── */}
        <section className="panel rise rise-2">
          <div className="panel__head">
            <span className="chip chip--live">
              <span className="chip__dot" aria-hidden="true" />
              TON TESTNET
            </span>
            <button
              className="btn btn--icon"
              onClick={handleRefresh}
              disabled={refreshCooldown}
              title={refreshCooldown ? 'Please wait…' : 'Refresh'}
              aria-label="Refresh balance and history"
            >
              ↻
            </button>
          </div>

          <div className="panel__body stack">
            <div>
              <div className="label" style={{ marginBottom: 'calc(var(--step) * 2)' }}>Balance</div>
              <div className="hero-figure">
                {balLoading && !balLoaded
                  ? <Spinner size={32} />
                  : nanotons !== null
                    ? <BalanceFigure nanotons={nanotons} />
                    : <span style={{ color: 'var(--bone-mute)' }}>— TON</span>}
              </div>
            </div>

            <hr className="rule" />

            {/* The address is a first-class object here, not a truncated caption. */}
            <div>
              <div className="row" style={{ marginBottom: 'calc(var(--step) * 2)' }}>
                <span className="label">Your address</span>
                <button
                  className="btn btn--small"
                  onClick={() => setShowFull(v => !v)}
                  title="Tap to toggle full address"
                  aria-expanded={showFull}
                >
                  {showFull ? 'Compact' : 'Full'}
                </button>
              </div>
              {showFull
                ? <AddressPlate address={wallet.address} size="sm" />
                : <span style={{ fontSize: '0.92rem' }}>
                    <AddressDisplay address={wallet.address} />
                  </span>}
            </div>

            {deployed === false && balLoaded && (
              <div className="hint">
                <span aria-hidden="true">○</span>
                Not deployed on-chain yet — your first outgoing transfer will deploy it.
              </div>
            )}
          </div>
        </section>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="row rise rise-3" style={{ gap: 'calc(var(--step) * 3)' }}>
          <button className="tile" onClick={() => onNavigate('receive')}>
            <span className="tile__glyph" aria-hidden="true">↓</span>
            <span className="tile__text">Receive</span>
          </button>
          <button className="tile" onClick={() => onNavigate('send')}>
            <span className="tile__glyph" aria-hidden="true">↑</span>
            <span className="tile__text">Send</span>
          </button>
        </div>

        {/* ── API errors ─────────────────────────────────────────────── */}
        {(balError || txError) && (
          <div role="alert" className="alert alert--danger">
            <span className="alert__glyph" aria-hidden="true">▲</span>
            <span>
              {balError && <div>Balance: {balError}</div>}
              {txError && <div>Transactions: {txError}</div>}
              <div style={{ color: 'var(--bone-mute)', marginTop: '0.2rem' }}>
                Your funds are safe — this only affects what is displayed. Try refreshing in a moment.
              </div>
            </span>
          </div>
        )}

        {/* ── Ledger ─────────────────────────────────────────────────── */}
        <section className="stack-s rise rise-4">
          <div className="section-head">
            <span className="label">Transactions</span>
            {txLoading && <Spinner size={13} />}
          </div>

          <div className="field__frame">
            <span aria-hidden="true" style={{ color: 'var(--bone-mute)', fontSize: '0.8rem' }}>⌕</span>
            <input
              className="input"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by address, amount or comment…"
              aria-label="Search transactions"
            />
          </div>

          <div className="panel panel--quiet">
            {filtered.length === 0 ? (
              <div className="empty">
                {txLoading && !txLoaded
                  ? <Spinner size={18} />
                  : query
                  ? 'No transactions match your search.'
                  : txError
                  ? 'Could not load transactions. Check your connection.'
                  : 'No transactions yet.'}
              </div>
            ) : (
              filtered.map(tx => <LedgerRow key={`${tx.hash}:${tx.lt}`} tx={tx} />)
            )}
          </div>
        </section>
      </div>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  )
}

/* ── Balance figure ───────────────────────────────────────────────────── */
/** Whole TON at display size, nanoton remainder set smaller but never rounded. */
function BalanceFigure({ nanotons }: { nanotons: string }) {
  const [whole, frac] = formatTon(nanotons).split('.')
  return (
    <>
      <span className="num">
        {whole}
        {frac && <span className="hero-figure__frac">.{frac}</span>}
      </span>
      <span className="hero-unit">TON</span>
    </>
  )
}

/* ── Ledger row ───────────────────────────────────────────────────────── */
function LedgerRow({ tx }: { tx: TonTransaction }) {
  const isIn = tx.type === 'in'
  const stamp = tx.timestamp
    ? new Date(tx.timestamp * 1000).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'Pending'

  return (
    <div className="ledger__row">
      <span className={`ledger__glyph ${isIn ? 'ledger__glyph--in' : 'ledger__glyph--out'}`} aria-hidden="true">
        {isIn ? '↓' : '↑'}
      </span>

      <div style={{ minWidth: 0 }}>
        <div className="ledger__kind">{isIn ? 'Received' : 'Sent'}</div>
        {tx.address && (
          <div className="ledger__party">
            {isIn ? 'From: ' : 'To: '}
            {tx.address.slice(0, 8)}…{tx.address.slice(-6)}
          </div>
        )}
        {tx.comment && <div className="ledger__note">“{tx.comment}”</div>}
        <div className="meta" style={{ marginTop: '0.15rem' }}>
          {stamp}
          {tx.hash && (
            <>
              {' · '}
              <a
                className="link"
                href={`${EXPLORER}/transaction/${encodeURIComponent(tx.hash)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                explorer
              </a>
            </>
          )}
        </div>
      </div>

      <div>
        <div className={`ledger__amount ${isIn ? 'ledger__amount--in' : 'ledger__amount--out'}`}>
          {isIn ? '+' : '−'}{formatTon(tx.amount)} TON
        </div>
        <div className="meta" style={{ textAlign: 'right' }}>fee {formatTon(tx.fee)}</div>
      </div>
    </div>
  )
}
