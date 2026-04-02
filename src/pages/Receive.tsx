import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWalletContext } from '../store/WalletContext'
import { AddressDisplay } from '../components/AddressDisplay'

export function Receive() {
  return (
    <div className="page" style={{ padding: '1.5rem', maxWidth: '420px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Receive TON</h2>
      <ReceiveContent />
    </div>
  )
}

function ReceiveContent() {
  const { wallet } = useWalletContext()
  if (!wallet) return null

  const tonLink = `ton://transfer/${wallet.address}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
      <div
        style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        }}
      >
        <QRCodeSVG value={tonLink} size={200} />
      </div>

      <div style={{ width: '100%' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
          Your address
        </p>
        <div
          style={{
            background: 'var(--color-surface-alt, #f5f5f5)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}
        >
          <AddressDisplay address={wallet.address} full copyable />
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textAlign: 'center' }}>
        This is your testnet address. Only send testnet TON to this address.
      </p>
    </div>
  )
}
