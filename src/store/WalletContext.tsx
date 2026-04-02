/**
 * WalletContext — central state for the active wallet session.
 *
 * Storage decision:
 *   - sessionStorage: mnemonic + keys live here.
 *     Cleared automatically when the browser tab is closed.
 *     Rationale: mnemonic must NOT persist across sessions on a shared device.
 *     The user can always re-import from their own secure backup.
 *   - localStorage: address book (known addresses) persists intentionally —
 *     it's not sensitive and improves UX across sessions.
 *
 * The Context exposes:
 *   wallet  – current wallet info (address, keys) or null
 *   setWallet – store a newly created/imported wallet
 *   clearWallet – logout / forget session
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { WalletInfo, WalletKeys } from '../crypto/wallet'

const SESSION_KEY = 'ton_wallet_session'

type SessionData = {
  address: string
  mnemonic: string[]
  publicKey: number[]
  secretKey: number[]
}

type WalletContextValue = {
  wallet: WalletInfo | null
  setWallet: (info: WalletInfo) => void
  clearWallet: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

/** Persist wallet to sessionStorage */
function persistSession(info: WalletInfo): void {
  const data: SessionData = {
    address: info.address,
    mnemonic: info.mnemonic,
    publicKey: Array.from(info.keys.publicKey),
    secretKey: Array.from(info.keys.secretKey),
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

/** Restore wallet from sessionStorage (returns null if absent/corrupt) */
function restoreSession(): WalletInfo | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SessionData
    const keys: WalletKeys = {
      publicKey: Buffer.from(data.publicKey),
      secretKey: Buffer.from(data.secretKey),
    }
    return { address: data.address, mnemonic: data.mnemonic, keys }
  } catch {
    return null
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<WalletInfo | null>(() => restoreSession())

  // Re-read on focus (e.g. another tab opened same app)
  useEffect(() => {
    const onFocus = () => setWalletState(restoreSession())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const setWallet = (info: WalletInfo) => {
    persistSession(info)
    setWalletState(info)
  }

  const clearWallet = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setWalletState(null)
  }

  return (
    <WalletContext.Provider value={{ wallet, setWallet, clearWallet }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used inside WalletProvider')
  return ctx
}
