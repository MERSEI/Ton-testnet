import React, { useState } from 'react'
import { useWalletContext } from './store/WalletContext'
import { Setup } from './pages/Setup'
import { Wallet } from './pages/Wallet'
import { Send } from './pages/Send'
import { Receive } from './pages/Receive'

type Tab = 'wallet' | 'send' | 'receive'

function AppInner() {
  const { wallet } = useWalletContext()
  const [tab, setTab] = useState<Tab>('wallet')

  if (!wallet) return <Setup />

  return (
    <>
      <main style={{ minHeight: '100svh' }}>
        {tab === 'wallet'  && <Wallet  onNavigate={setTab} />}
        {tab === 'send'    && <Send    />}
        {tab === 'receive' && <Receive />}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={tab === 'wallet'  ? 'active' : ''} onClick={() => setTab('wallet')}>
          <span className="nav-icon">◈</span>
          Wallet
        </button>
        <button className={tab === 'receive' ? 'active' : ''} onClick={() => setTab('receive')}>
          <span className="nav-icon">↓</span>
          Receive
        </button>
        <button className={tab === 'send'    ? 'active' : ''} onClick={() => setTab('send')}>
          <span className="nav-icon">↑</span>
          Send
        </button>
      </nav>
    </>
  )
}

export default function App() {
  return <AppInner />
}
