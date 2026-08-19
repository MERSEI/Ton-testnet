import React, { useState, useRef } from 'react'
import {
  generateWallet,
  deriveWallet,
  normalizeMnemonicInput,
  type WalletInfo,
} from '../crypto/wallet'
import { useWalletContext } from '../store/WalletContext'
import { Spinner } from '../components/Spinner'
import { copyToClipboard } from '../utils/clipboard'

type View = 'choose' | 'create' | 'import'

export function Setup() {
  const { setWallet } = useWalletContext()
  const [view, setView]               = useState<View>('choose')
  const [mnemonic, setMnemonic]       = useState<string[]>([])
  const [importInput, setImportInput] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [confirmed, setConfirmed]     = useState(false)
  const [revealed, setRevealed]       = useState(false)
  const [copied, setCopied]           = useState(false)
  const pendingWallet                 = useRef<WalletInfo | null>(null)

  const handleCreate = async () => {
    setLoading(true); setError('')
    try {
      const wallet = await generateWallet()
      pendingWallet.current = wallet
      setMnemonic(wallet.mnemonic)
      setRevealed(false)
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

  /**
   * Import an existing phrase.
   *
   * The checksum check lives in deriveWallet: without it, one mistyped word
   * derived a perfectly valid but *different* wallet with a zero balance, and the
   * user had no way to tell a typo from lost funds.
   */
  const handleImport = async () => {
    setError('')
    const words = normalizeMnemonicInput(importInput)
    if (words.length !== 24) {
      setError(`Expected 24 words, found ${words.length}.`)
      return
    }
    setLoading(true)
    try {
      setWallet(await deriveWallet(words))
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  const handleCopyPhrase = async () => {
    if (await copyToClipboard(mnemonic.join(' '))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  /* ── Choose ───────────────────────────────────────────────────────── */
  if (view === 'choose') return (
    <div className="center-page">
      <div style={{ width: '100%', maxWidth: 380 }} className="stack">
        <div className="stack-s rise rise-1" style={{ marginBottom: 'calc(var(--step) * 4)' }}>
          <div className="glyph-badge" aria-hidden="true">◈</div>
          <h1 className="display" style={{ fontSize: '2.6rem', marginTop: 'calc(var(--step) * 4)' }}>
            TON Wallet
          </h1>
          <p className="meta">
            Self-custodial. No backend. Keys never leave this browser.
          </p>
          <span className="chip chip--live" style={{ alignSelf: 'flex-start', marginTop: 'calc(var(--step) * 2)' }}>
            <span className="chip__dot" aria-hidden="true" />
            Testnet
          </span>
        </div>

        <div className="stack-s rise rise-2">
          <button className="btn btn--primary btn--block btn--tall" onClick={handleCreate} disabled={loading}>
            {loading ? <Spinner size={16} /> : '+ Create new wallet'}
          </button>
          <button className="btn btn--block btn--tall" onClick={() => setView('import')}>
            Import existing wallet
          </button>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
    </div>
  )

  /* ── Create ───────────────────────────────────────────────────────── */
  if (view === 'create') return (
    <div className="center-page" style={{ alignItems: 'flex-start', paddingTop: 'calc(var(--step) * 10)' }}>
      <div style={{ width: '100%', maxWidth: 460 }} className="stack">
        <header className="stack-s rise rise-1">
          <span className="label">Step 1 of 1</span>
          <h2 className="title">Save your Secret Phrase</h2>
        </header>

        <div className="alert alert--danger rise rise-1">
          <span className="alert__glyph" aria-hidden="true">▲</span>
          <span>
            <strong>Write these 24 words down, in order.</strong> Anyone holding this phrase
            owns your funds. It is never sent anywhere and never stored — reload this page and
            it is gone for good.
          </span>
        </div>

        {/* Blurred until explicitly revealed: the phrase should not be sitting in
            plain sight on a screen that may be shared or recorded. */}
        <div style={{ position: 'relative' }} className="rise rise-2">
          <div className={`seed ${revealed ? '' : 'seed--hidden'}`}>
            {mnemonic.map((word, i) => (
              <div className="seed__cell" key={i}>
                <span className="seed__ord">{i + 1}</span>
                <span className="seed__word">{word}</span>
              </div>
            ))}
          </div>
          {!revealed && (
            <div className="seed-veil">
              <button className="btn btn--primary" onClick={() => setRevealed(true)}>
                Tap to reveal
              </button>
            </div>
          )}
        </div>

        <div className="stack-s rise rise-3">
          <button className="btn btn--block" onClick={handleCopyPhrase} disabled={!revealed}>
            {copied ? '✓ Copied to clipboard' : 'Copy phrase'}
          </button>

          <label
            style={{
              display: 'flex', gap: 'calc(var(--step) * 3)', alignItems: 'flex-start',
              cursor: 'pointer', padding: 'calc(var(--step) * 3) 0', fontSize: '0.8rem',
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: '0.2rem', width: 15, height: 15, accentColor: 'var(--acid)', flexShrink: 0 }}
            />
            <span>I&rsquo;ve written down my secret phrase and stored it safely.</span>
          </label>

          <button
            className="btn btn--primary btn--block btn--tall"
            onClick={handleConfirmCreate}
            disabled={!confirmed}
          >
            Open wallet
          </button>
        </div>
      </div>
    </div>
  )

  /* ── Import ───────────────────────────────────────────────────────── */
  const wordCount = normalizeMnemonicInput(importInput).length

  return (
    <div className="center-page">
      <div style={{ width: '100%', maxWidth: 420 }} className="stack">
        <header className="stack-s rise rise-1">
          <span className="label">Restore</span>
          <h2 className="title">Import Wallet</h2>
          <p className="meta">
            Enter your 24 seed words separated by spaces. Case and numbering are ignored.
          </p>
        </header>

        <div className="field rise rise-2">
          <div className="field__frame" style={{ alignItems: 'stretch' }}>
            <textarea
              className="input input--area"
              value={importInput}
              onChange={e => setImportInput(e.target.value)}
              placeholder="word1 word2 word3 … word24"
              rows={5}
              aria-label="Seed phrase"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className={`counter ${wordCount === 24 ? 'counter--ready' : ''}`}>
            {wordCount} / 24 words
          </div>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="row rise rise-3" style={{ gap: 'calc(var(--step) * 3)' }}>
          <button className="btn" onClick={() => { setView('choose'); setError('') }} style={{ flex: 1 }}>
            Back
          </button>
          <button
            className="btn btn--primary btn--tall"
            onClick={handleImport}
            disabled={loading}
            style={{ flex: 2 }}
          >
            {loading ? <Spinner size={16} /> : 'Import wallet'}
          </button>
        </div>
      </div>
    </div>
  )
}
