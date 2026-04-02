import React, { useEffect, useState } from 'react'
import { useWalletContext } from '../store/WalletContext'
import { useBalance } from '../hooks/useBalance'
import { useTransactions } from '../hooks/useTransactions'
import { AddressDisplay } from '../components/AddressDisplay'
import { TransactionItem } from '../components/TransactionItem'
import { Spinner } from '../components/Spinner'
import { formatTon } from '../utils/address'
import type { TonTransaction } from '../api/tonCenter'

type Tab = 'wallet' | 'send' | 'receive'

type Props = {
  onNavigate: (tab: Tab) => void
}

export function Wallet({ onNavigate }: Props) {
  const { wallet, clearWallet } = useWalletContext()
  const { nanotons, loading: balLoading, refresh: refreshBalance } = useBalance(wallet?.address ?? null)
  const { transactions, loading: txLoading, refresh: refreshTx } = useTransactions(wallet?.address ?? null)

  const [showFull, setShowFull] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    refreshBalance()
    refreshTx()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!wallet) return null

  const handleRefresh = () => {
    refreshBalance()
    refreshTx()
  }

  const filteredTx: TonTransaction[] = transactions.filter(tx => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      tx.address.toLowerCase().includes(q) ||
      formatTon(tx.amount).includes(q)
    )
  })

  return (
    <div className="page" style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Header */}
      <div
        style={{
          background: 'var(--color-primary, #0088cc)',
          color: '#fff',
          padding: '1.5rem 1.5rem 2rem',
          borderRadius: '0 0 20px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>TON Testnet</span>
          <button
            onClick={clearWallet}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.8 }}
          >
            Disconnect
          </button>
        </div>

        {/* Address */}
        <div
          onClick={() => setShowFull(v => !v)}
          style={{ cursor: 'pointer', marginBottom: '1rem' }}
          title="Click to toggle full address"
        >
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem' }}>Your address</div>
          {/* SECURITY MECHANISM A — highlighted address in header */}
          <span style={{ fontFamily: 'monospace', fontSize: showFull ? '0.7rem' : '0.9rem' }}>
            <AddressDisplay address={wallet.address} full={showFull} />
          </span>
        </div>

        {/* Balance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Balance</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>
              {balLoading ? <Spinner size={20} /> : nanotons ? `${formatTon(nanotons)} TON` : '— TON'}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh"
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#fff',
            }}
          >
            ↻
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            className="btn"
            onClick={() => onNavigate('receive')}
            style={actionBtnStyle}
          >
            ↓ Receive
          </button>
          <button
            className="btn"
            onClick={() => onNavigate('send')}
            style={actionBtnStyle}
          >
            ↑ Send
          </button>
        </div>
      </div>

      {/* Transaction history */}
      <div style={{ padding: '1.25rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>History</h3>
          {txLoading && <Spinner size={16} />}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by address or amount…"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border, #ddd)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
            boxSizing: 'border-box',
          }}
        />

        {filteredTx.length === 0 && !txLoading && (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
            {search ? 'No transactions match your search.' : 'No transactions yet.'}
          </p>
        )}

        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border, #eee)' }}>
          {filteredTx.map(tx => (
            <TransactionItem key={tx.hash + tx.lt} tx={tx} />
          ))}
        </div>
      </div>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: '8px',
  padding: '0.5rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 600,
}
