import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWalletContext } from '../store/WalletContext'
import { AddressDisplay } from '../components/AddressDisplay'

export function Receive() {
  const { wallet } = useWalletContext()
  if (!wallet) return null

  const tonLink = `ton://transfer/${wallet.address}`

  return (
    <div className="page-content">
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, padding: '0.25rem 0.25rem 0' }}>Receive TON</h2>

      {/* QR */}
      <div className="tg-section" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <QRCodeSVG value={tonLink} size={180} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Scan with any TON wallet app
        </p>
      </div>

      {/* Address */}
      <div>
        <div className="label-text">Your address</div>
        <div className="tg-section" style={{ padding: '1rem' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', wordBreak: 'break-all', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            <AddressDisplay address={wallet.address} full />
          </div>
          <CopyButton text={wallet.address} />
        </div>
      </div>

      {/* Warning */}
      <div className="tg-section" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid var(--orange)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        ⚠️ <strong style={{ color: 'var(--text)' }}>Testnet only.</strong> Only send testnet TON here. For free testnet coins use <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>@testgiver_ton_bot</code> in Telegram.
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="btn btn-primary"
      style={{ width: '100%' }}
    >
      {copied ? '✓ Copied!' : 'Copy address'}
    </button>
  )
}
