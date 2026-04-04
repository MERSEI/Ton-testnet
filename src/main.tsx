// ⚠️ Polyfills MUST be first — @ton/ton reads Buffer at module init time
import './polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { WalletProvider } from './store/WalletContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
)
