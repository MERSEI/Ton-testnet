/**
 * Setup page — first-run experience.
 * User can either generate a new wallet or import one via mnemonic.
 */

import React, { useState } from 'react'
import { generateWallet, deriveWallet } from '../crypto/wallet'
import { useWalletContext } from '../store/WalletContext'
import { Spinner } from '../components/Spinner'

type View = 'choose' | 'create' | 'import'

export function Setup() {
  const { setWallet } = useWalletContext()
  const [view, setView] = useState<View>('choose')
  const [mnemonic, setMnemonic] = useState<string[]>([])
  const [importInput, setImportInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const wallet = await generateWallet()
      setMnemonic(wallet.mnemonic)
      setView('create')
      // Don't store yet — user must confirm they saved the mnemonic
      // Temporarily hold wallet in component state
      ;(window as Record<string, unknown>)['__pendingWallet'] = wallet
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCreate = () => {
    const wallet = (window as Record<string, unknown>)['__pendingWallet']
    if (wallet) {
      setWallet(wallet as Parameters<typeof setWallet>[0])
      delete (window as Record<string, unknown>)['__pendingWallet']
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setError('')
    const words = importInput.trim().split(/\s+/)
    if (words.length !== 24) {
      setError('Please enter exactly 24 words separated by spaces.')
      return
    }
    setLoading(true)
    try {
      const wallet = await deriveWallet(words)
      setWallet(wallet)
    } catch (e) {
      setError(`Invalid mnemonic: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (view === 'choose') {
    return (
      <div className="page" style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>TON Testnet Wallet</h1>
          <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Self-custodial · No backend · Testnet only
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? <Spinner size={16} /> : 'Create new wallet'}
            </button>
            <button className="btn btn-secondary" onClick={() => setView('import')}>
              Import existing wallet
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    )
  }

  if (view === 'create') {
    return (
      <div className="page" style={pageStyle}>
        <div style={{ ...cardStyle, maxWidth: '540px' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Save your Secret Phrase</h2>
          <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            ⚠️ Write down these 24 words in order and store them safely. They are
            the <strong>only way</strong> to recover your wallet. Anyone with these words
            has full access to your funds.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.4rem',
              marginBottom: '1.5rem',
            }}
          >
            {mnemonic.map((word, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--color-surface-alt, #f5f5f5)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: 'var(--color-muted)', marginRight: '0.3rem', fontSize: '0.7rem' }}>
                  {i + 1}.
                </span>
                {word}
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            <span style={{ fontSize: '0.85rem' }}>
              I have written down my secret phrase and stored it safely.
            </span>
          </label>
          <button
            className="btn btn-primary"
            onClick={handleConfirmCreate}
            disabled={!confirmed}
          >
            Continue to wallet
          </button>
        </div>
      </div>
    )
  }

  // Import view
  return (
    <div className="page" style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: '1rem' }}>Import Wallet</h2>
        <textarea
          value={importInput}
          onChange={e => setImportInput(e.target.value)}
          placeholder="Enter your 24 seed words separated by spaces..."
          rows={4}
          style={{
            width: '100%',
            padding: '0.6rem',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setView('choose')}>
            Back
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading} style={{ flex: 1 }}>
            {loading ? <Spinner size={16} /> : 'Import wallet'}
          </button>
        </div>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface, #fff)',
  borderRadius: '12px',
  padding: '2rem',
  width: '100%',
  maxWidth: '380px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
}
