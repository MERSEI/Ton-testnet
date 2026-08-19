/**
 * WalletContext — central state for the active wallet session.
 *
 * Storage decisions:
 *   - sessionStorage holds the keypair. It is cleared when the tab closes, so the
 *     mnemonic does not linger on a shared device across sessions.
 *   - The mnemonic itself is deliberately NOT persisted. Nothing after the setup
 *     screen reads it, so writing it to storage was pure attack surface: any XSS
 *     on this origin could lift a phrase that recovers the wallet forever,
 *     whereas the stored keypair only controls this one wallet. It stays in
 *     memory for the lifetime of the tab and is gone after a reload.
 *   - localStorage holds the address book — not sensitive, and persisting it makes
 *     the first-send warning meaningful across sessions.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { WalletInfo, WalletKeys } from '../crypto/wallet'
import { parseTonAddress } from '../utils/address'

const SESSION_KEY = 'ton_wallet_session'

const PUBLIC_KEY_BYTES = 32
const SECRET_KEY_BYTES = 64

type SessionData = {
  address: string
  publicKey: number[]
  secretKey: number[]
}

type WalletContextValue = {
  wallet: WalletInfo | null
  setWallet: (info: WalletInfo) => void
  clearWallet: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

/** Persist the session (keypair + address; never the mnemonic) */
function persistSession(info: WalletInfo): void {
  const data: SessionData = {
    address: info.address,
    publicKey: Array.from(info.keys.publicKey),
    secretKey: Array.from(info.keys.secretKey),
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable — the wallet still works for this page view */
  }
}

function isByteArray(v: unknown, length: number): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === length &&
    v.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255)
  )
}

/**
 * Restore the wallet from sessionStorage.
 *
 * The payload is validated rather than trusted: a tampered or truncated entry
 * used to be fed straight into `new Uint8Array(...)`, producing a wallet with an
 * empty key and an attacker-chosen address displayed as the user's own.
 */
function restoreSession(): WalletInfo | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const data = JSON.parse(raw) as Partial<SessionData>
    if (typeof data.address !== 'string' || !parseTonAddress(data.address)) return null
    if (!isByteArray(data.publicKey, PUBLIC_KEY_BYTES)) return null
    if (!isByteArray(data.secretKey, SECRET_KEY_BYTES)) return null

    // Buffer extends Uint8Array — the cast is safe for every @ton/crypto call,
    // all of which treat these as plain byte arrays.
    const keys = {
      publicKey: new Uint8Array(data.publicKey),
      secretKey: new Uint8Array(data.secretKey),
    } as unknown as WalletKeys

    // The mnemonic is not persisted; an empty list marks "restored session".
    return { address: data.address, mnemonic: [], keys }
  } catch {
    return null
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<WalletInfo | null>(() => restoreSession())

  // Re-read when the tab regains focus (another tab may have logged out).
  useEffect(() => {
    const onFocus = () => {
      setWalletState(prev => {
        const restored = restoreSession()
        // Keep the in-memory object — and its mnemonic — when it is the same
        // wallet, so a focus event right after creation does not drop the phrase.
        if (prev && restored && prev.address === restored.address) return prev
        return restored
      })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const setWallet = (info: WalletInfo) => {
    persistSession(info)
    setWalletState(info)
  }

  const clearWallet = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
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
