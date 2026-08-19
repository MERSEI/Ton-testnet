import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWalletContext } from '../store/WalletContext'
import { AddressPlate } from '../components/AddressPlate'
import { copyToClipboard } from '../utils/clipboard'

export function Receive() {
  const { wallet } = useWalletContext()
  if (!wallet) return null

  const tonLink = `ton://transfer/${wallet.address}`

  return (
    <div className="shell">
      <header className="row rise rise-1">
        <h2 className="title">Receive</h2>
        <span className="chip">Testnet</span>
      </header>

      {/* QR sits on a bone plate: scanners need light ground, and the contrast
          makes the code read as a physical label rather than a UI element. */}
      <section className="panel rise rise-2">
        <div className="panel__body stack" style={{ alignItems: 'center' }}>
          <div className="qr-plate">
            <QRCodeSVG value={tonLink} size={176} bgColor="#EDE9E1" fgColor="#09090A" level="M" />
          </div>
          <span className="meta">Scan with any TON wallet app</span>
        </div>
      </section>

      <section className="stack-s rise rise-3">
        <span className="label">Your address</span>
        <div className="panel">
          <div className="panel__body stack">
            <AddressPlate address={wallet.address} />
            <CopyButton text={wallet.address} />
          </div>
        </div>
      </section>

      <div className="alert alert--warn rise rise-4">
        <span className="alert__glyph" aria-hidden="true">◆</span>
        <span>
          <strong>Testnet only.</strong> Only send testnet TON here. For free testnet coins use{' '}
          <code className="mark">@testgiver_ton_bot</code> in Telegram.
        </span>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyToClipboard(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button onClick={copy} className="btn btn--primary btn--block">
      {copied ? '✓ Copied' : 'Copy address'}
    </button>
  )
}
