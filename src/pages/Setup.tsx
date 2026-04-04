import React, { useState, useRef } from 'react'
import { generateWallet, deriveWallet, type WalletInfo } from '../crypto/wallet'
import { useWalletContext } from '../store/WalletContext'
import { Spinner } from '../components/Spinner'

type View = 'choose' | 'create' | 'import'

export function Setup() {
  const { setWallet } = useWalletContext()
  const [view, setView]               = useState<View>('choose')
  const [mnemonic, setMnemonic]       = useState<string[]>([])
  const [importInput, setImportInput] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [confirmed, setConfirmed]     = useState(false)
  const pendingWallet                 = useRef<WalletInfo | null>(null)

  const handleCreate = async () => {
    setLoading(true); setError('')
    try {
      const wallet = await generateWallet()
      pendingWallet.current = wallet
      setMnemonic(wallet.mnemonic)
      setView('create')
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  const handleConfirmCreate = () => {
    if (pendingWallet.current) {
      setWallet(pendingWallet.current)
      pendingWallet.current = null
    }
  }

  const handleImport = async () => {
    setError('')
    const words = importInput.trim().split(/\s+/)
    if (words.length !== 24) { setError('Please enter exactly 24 words.'); return }
    setLoading(true)
    try {
      setWallet(await deriveWallet(words))
    } catch (e) { setError(`Invalid phrase: ${(e as Error).message}`) }
    finally { setLoading(false) }
  }

  /* ── Choose view ──────────────────────────────────────────────────── */
  if (view === 'choose') return (
    <div style={centeredPage}>
      <div style={card}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(145deg, #2AABEE, #1a6ea8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.9rem', fontSize: '2rem', boxShadow: '0 4px 16px rgba(42,171,238,0.35)',
          }}>💎</div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem' }}>TON Testnet Wallet</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Self-custodial · No backend · Testnet</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}
            style={{ width: '100%', padding: '0.85rem' }}>
            {loading ? <Spinner size={16} /> : '+ Create new wallet'}
          </button>
          <button className="btn btn-secondary" onClick={() => setView('import')}
            style={{ width: '100%', padding: '0.85rem' }}>
            Import existing wallet
          </button>
        </div>
        {error && <p className="error-text" style={{ marginTop: '0.75rem', textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  )

  /* ── Create view ──────────────────────────────────────────────────── */
  if (view === 'create') return (
    <div style={{ ...centeredPage, alignItems: 'flex-start', padding: '1.5rem 1rem' }}>
      <div style={{ ...card, maxWidth: 500, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Save your Secret Phrase</h2>

        <div className="tg-section" style={{ padding: '0.75rem', marginBottom: '1rem', borderLeft: '4px solid var(--red)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--red)', fontWeight: 600 }}>⚠️ Write these 24 words in order and store them safely.</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Anyone with this phrase has full access to your funds. Never share it online.</p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.4rem', marginBottom: '1.25rem',
        }}>
          {mnemonic.map((word, i) => (
            <div key={i} style={{
              background: 'var(--surface-2)', borderRadius: '8px',
              padding: '0.4rem 0.6rem', fontSize: '0.82rem',
              display: 'flex', gap: '0.35rem', alignItems: 'baseline',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', minWidth: 16 }}>{i + 1}.</span>
              <span style={{ fontWeight: 600 }}>{word}</span>
            </div>
          ))}
        </div>

        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
            style={{ marginTop: '0.2rem', width: 16, height: 16, accentColor: 'var(--tg-blue)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem' }}>I've written down my secret phrase and stored it safely.</span>
        </label>

        <button className="btn btn-primary" onClick={handleConfirmCreate} disabled={!confirmed}
          style={{ width: '100%', padding: '0.85rem' }}>
          Open wallet
        </button>
      </div>
    </div>
  )

  /* ── Import view ──────────────────────────────────────────────────── */
  return (
    <div style={centeredPage}>
      <div style={card}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Import Wallet</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Enter your 24 seed words separated by spaces.
        </p>

        <textarea
          value={importInput}
          onChange={e => setImportInput(e.target.value)}
          placeholder="word1 word2 word3 … word24"
          rows={5}
          style={{
            width: '100%', padding: '0.75rem', borderRadius: '8px',
            border: '1px solid var(--divider)', background: 'var(--surface-2)',
            fontFamily: 'monospace', fontSize: '0.88rem', resize: 'vertical',
            color: 'var(--text)', outline: 'none',
          }}
        />
        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => { setView('choose'); setError('') }} style={{ flex: 1 }}>
            Back
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading} style={{ flex: 2, padding: '0.85rem' }}>
            {loading ? <Spinner size={16} /> : 'Import wallet'}
          </button>
        </div>
      </div>
    </div>
  )
}

const centeredPage: React.CSSProperties = {
  minHeight: '100svh', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  padding: '1.5rem 1rem', background: 'var(--bg)',
}

const card: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: '16px',
  padding: '2rem', width: '100%', maxWidth: '380px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
}
