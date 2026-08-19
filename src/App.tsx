import React, { useState } from 'react'
import { useWalletContext } from './store/WalletContext'
import { Setup } from './pages/Setup'
import { Wallet } from './pages/Wallet'
import { Send } from './pages/Send'
import { Receive } from './pages/Receive'

type Tab = 'wallet' | 'send' | 'receive'

const TABS: Array<{ id: Tab; glyph: string; label: string }> = [
  { id: 'wallet', glyph: '◈', label: 'Wallet' },
  { id: 'receive', glyph: '↓', label: 'Receive' },
  { id: 'send', glyph: '↑', label: 'Send' },
]

function AppInner() {
  const { wallet } = useWalletContext()
  const [tab, setTab] = useState<Tab>('wallet')

  if (!wallet) return <Setup />

  return (
    <>
      <main style={{ minHeight: '100svh' }}>
        {tab === 'wallet'  && <Wallet onNavigate={setTab} />}
        {tab === 'send'    && <Send />}
        {tab === 'receive' && <Receive />}
      </main>

      <nav className="nav" aria-label="Main navigation">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav__btn ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="nav__glyph" aria-hidden="true">{t.glyph}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}

export default function App() {
  return <AppInner />
}
