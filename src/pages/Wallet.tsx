import React, { useEffect, useState } from 'react'
import { useWalletContext } from '../store/WalletContext'
import { useBalance } from '../hooks/useBalance'
import { useTransactions } from '../hooks/useTransactions'
import { AddressDisplay } from '../components/AddressDisplay'
import { Spinner } from '../components/Spinner'
import { HelpModal } from '../components/HelpModal'
import { formatTon } from '../utils/address'
import { seedAddressBookFromHistory } from '../utils/addressBook'
import type { TonTransaction } from '../api/tonCenter'

type Tab = 'wallet' | 'send' | 'receive'
type Props = { onNavigate: (tab: Tab) => void }

export function Wallet({ onNavigate }: Props) {
  const { wallet, clearWallet } = useWalletContext()
  const { nanotons, loading: balLoading, error: balError, refresh: refreshBalance } = useBalance(wallet?.address ?? null)
  const { transactions, loading: txLoading, error: txError, refresh: refreshTx } = useTransactions(wallet?.address ?? null)

  const [showFull, setShowFull]         = useState(false)
  const [search, setSearch]             = useState('')
  const [refreshCooldown, setCooldown]  = useState(false)
  const [showHelp, setShowHelp]         = useState(false)

  useEffect(() => {
    refreshBalance()
    const t = setTimeout(refreshTx, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (transactions.length > 0) seedAddressBookFromHistory(transactions)
  }, [transactions])

  if (!wallet) return null

  const handleRefresh = () => {
    if (refreshCooldown) return
    setCooldown(true)
    refreshBalance()
    setTimeout(refreshTx, 1200)
    setTimeout(() => setCooldown(false), 5000)
  }

  const filtered: TonTransaction[] = transactions.filter(tx => {
    if (!search) return true
    const q = search.toLowerCase()
    return tx.address.toLowerCase().includes(q) || formatTon(tx.amount).includes(q)
  })

  return (
    <>
      <div className="page-content">
        {/* ── Balance card ───────────────────────────────────── */}
        <div
          className="tg-section"
          style={{
            background: 'linear-gradient(145deg, var(--tg-blue) 0%, #1a8bc8 100%)',
            color: '#fff',
            padding: '1.5rem',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 600, letterSpacing: '0.05em' }}>
              TON TESTNET
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowHelp(true)}
                title="Help"
                style={iconBtnStyle}
              >?</button>
              <button
                onClick={clearWallet}
                title="Disconnect wallet"
                style={iconBtnStyle}
              >⏏</button>
            </div>
          </div>

          {/* Address */}
          <div
            onClick={() => setShowFull(v => !v)}
            style={{ cursor: 'pointer', marginBottom: '1.25rem' }}
            title="Tap to toggle full address"
          >
            <div style={{ fontSize: '0.72rem', opacity: 0.75, marginBottom: '0.25rem' }}>Your address</div>
            <span style={{
              fontFamily: 'monospace',
              fontSize: showFull ? '0.68rem' : '0.88rem',
              lineHeight: 1.4,
              opacity: 0.95,
            }}>
              {/* Address highlight CSS variables won't work on blue bg — override inline */}
              <AddressDisplay address={wallet.address} full={showFull} />
            </span>
          </div>

          {/* Balance row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.72rem', opacity: 0.75, marginBottom: '0.2rem' }}>Balance</div>
              <div className="balance-amount" style={{ color: '#fff' }}>
                {balLoading
                  ? <Spinner size={24} />
                  : nanotons
                    ? <>{formatTon(nanotons)} <span style={{ fontSize: '1.3rem', opacity: 0.85 }}>TON</span></>
                    : <span style={{ opacity: 0.6 }}>— TON</span>
                }
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshCooldown}
              title={refreshCooldown ? 'Please wait…' : 'Refresh'}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: 'none',
                borderRadius: '50%',
                width: 38, height: 38,
                cursor: refreshCooldown ? 'default' : 'pointer',
                fontSize: '1.1rem',
                color: '#fff',
                opacity: refreshCooldown ? 0.45 : 1,
                transition: 'opacity 0.2s',
              }}
            >↻</button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
            <button className="action-btn" onClick={() => onNavigate('receive')}>
              <div className="action-btn__icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <span style={{ color: '#fff' }}>↓</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.9)' }}>Receive</span>
            </button>
            <button className="action-btn" onClick={() => onNavigate('send')}>
              <div className="action-btn__icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <span style={{ color: '#fff' }}>↑</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.9)' }}>Send</span>
            </button>
          </div>
        </div>

        {/* ── API errors ─────────────────────────────────────── */}
        {(balError || txError) && (
          <div role="alert" className="tg-section" style={{
            padding: '0.75rem 1rem',
            borderLeft: '4px solid var(--red)',
            fontSize: '0.82rem',
            color: 'var(--red)',
          }}>
            {balError && <div>Balance: {balError}</div>}
            {txError  && <div>Transactions: {txError}</div>}
            <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.78rem' }}>
              Your funds are safe. Try refreshing in a moment.
            </div>
          </div>
        )}

        {/* ── Transaction history ─────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem 0.4rem' }}>
            <span className="label-text">Transactions</span>
            {txLoading && <Spinner size={14} />}
          </div>

          {/* Search */}
          <div style={{ marginBottom: '0.6rem' }}>
            <input
              className="tg-input"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by address or amount…"
            />
          </div>

          <div className="tg-section">
            {filtered.length === 0 && !txLoading ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {search
                  ? 'No transactions match your search.'
                  : txError
                  ? 'Could not load transactions. Check your connection.'
                  : 'No transactions yet.'}
              </div>
            ) : (
              filtered.map(tx => <TxRow key={tx.hash + tx.lt} tx={tx} />)
            )}
          </div>
        </div>
      </div>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  )
}

/* ── Transaction row ──────────────────────────────────────────────────── */
function TxRow({ tx }: { tx: TonTransaction }) {
  const isIn  = tx.type === 'in'
  const date  = new Date(tx.timestamp * 1000)
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
             + ' · '
             + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="tg-cell">
      <div className={`tx-icon ${isIn ? 'in' : 'out'}`}>
        {isIn ? '↓' : '↑'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
          {isIn ? 'Received' : 'Sent'}
        </div>
        {tx.address && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isIn ? 'From: ' : 'To: '}
            <span style={{ fontFamily: 'monospace' }}>
              {tx.address.slice(0, 8)}…{tx.address.slice(-6)}
            </span>
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{label}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, color: isIn ? 'var(--green)' : 'var(--red)', fontSize: '0.92rem' }}>
          {isIn ? '+' : '−'}{formatTon(tx.amount)} TON
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          fee {formatTon(tx.fee)}
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  border: 'none',
  borderRadius: '50%',
  width: 30, height: 30,
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: '#fff',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
