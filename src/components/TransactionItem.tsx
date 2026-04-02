import React from 'react'
import type { TonTransaction } from '../api/tonCenter'
import { formatTon } from '../utils/address'
import { AddressDisplay } from './AddressDisplay'

type Props = {
  tx: TonTransaction
}

export function TransactionItem({ tx }: Props) {
  const date = new Date(tx.timestamp * 1000)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const isIn = tx.type === 'in'

  return (
    <div
      className="tx-item"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border, #eee)',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: isIn ? '#16a34a' : '#dc2626',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {isIn ? '↓ Received' : '↑ Sent'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted, #888)' }}>
          {dateStr} {timeStr}
        </span>
        {tx.address && (
          <span style={{ fontSize: '0.75rem' }}>
            {isIn ? 'From: ' : 'To: '}
            <AddressDisplay address={tx.address} />
          </span>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontWeight: 700,
            color: isIn ? '#16a34a' : '#dc2626',
            fontSize: '0.95rem',
          }}
        >
          {isIn ? '+' : '-'}{formatTon(tx.amount)} TON
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-muted, #888)' }}>
          fee: {formatTon(tx.fee)} TON
        </div>
      </div>
    </div>
  )
}
