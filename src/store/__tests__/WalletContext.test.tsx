import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { WalletProvider, useWalletContext } from '../WalletContext'
import type { WalletInfo } from '../../crypto/wallet'
import { WALLET, MNEMONIC_24 } from '../../tests/fixtures'

const SESSION_KEY = 'ton_wallet_session'

function makeWallet(address = WALLET.nonBounceableTest): WalletInfo {
  return {
    address,
    mnemonic: MNEMONIC_24,
    keys: {
      publicKey: new Uint8Array(32).fill(1),
      secretKey: new Uint8Array(64).fill(2),
    },
  } as unknown as WalletInfo
}

function Probe() {
  const { wallet, setWallet, clearWallet } = useWalletContext()
  return (
    <div>
      <span data-testid="address">{wallet?.address ?? 'none'}</span>
      <span data-testid="words">{String(wallet?.mnemonic.length ?? -1)}</span>
      <button onClick={() => setWallet(makeWallet())}>set</button>
      <button onClick={clearWallet}>clear</button>
    </div>
  )
}

function renderProbe() {
  return render(
    <WalletProvider>
      <Probe />
    </WalletProvider>,
  )
}

const address = () => screen.getByTestId('address').textContent

beforeEach(() => {
  sessionStorage.clear()
})

describe('WalletContext — lifecycle', () => {
  it('starts with no wallet', () => {
    renderProbe()
    expect(address()).toBe('none')
  })

  it('stores and exposes a wallet', () => {
    renderProbe()
    fireEvent.click(screen.getByText('set'))
    expect(address()).toBe(WALLET.nonBounceableTest)
  })

  it('clears the wallet and the stored session', () => {
    renderProbe()
    fireEvent.click(screen.getByText('set'))
    fireEvent.click(screen.getByText('clear'))
    expect(address()).toBe('none')
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/inside WalletProvider/)
  })
})

describe('WalletContext — what gets persisted', () => {
  it('does NOT write the mnemonic to storage', () => {
    // The mnemonic recovers the wallet forever; the keypair only controls this
    // one wallet. Nothing after setup reads it, so persisting it was pure risk.
    renderProbe()
    fireEvent.click(screen.getByText('set'))
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY)!)
    expect(stored).not.toHaveProperty('mnemonic')
    expect(JSON.stringify(stored)).not.toContain(MNEMONIC_24[0])
  })

  it('persists the address and both keys', () => {
    renderProbe()
    fireEvent.click(screen.getByText('set'))
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY)!)
    expect(stored.address).toBe(WALLET.nonBounceableTest)
    expect(stored.publicKey).toHaveLength(32)
    expect(stored.secretKey).toHaveLength(64)
  })

  it('keeps the mnemonic in memory for the current tab', () => {
    renderProbe()
    fireEvent.click(screen.getByText('set'))
    expect(screen.getByTestId('words').textContent).toBe('24')
  })
})

describe('WalletContext — restoring a session', () => {
  function store(data: unknown) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  }

  const valid = {
    address: WALLET.nonBounceableTest,
    publicKey: Array(32).fill(1),
    secretKey: Array(64).fill(2),
  }

  it('restores a valid session on mount', () => {
    store(valid)
    renderProbe()
    expect(address()).toBe(WALLET.nonBounceableTest)
  })

  it('restores keys as byte arrays of the right length', () => {
    store(valid)
    renderProbe()
    // A restored session has no mnemonic — an empty list marks that state.
    expect(screen.getByTestId('words').textContent).toBe('0')
  })

  it.each([
    ['a corrupt JSON payload', 'not json'],
    ['a JSON primitive', '42'],
  ])('ignores %s', (_label, raw) => {
    sessionStorage.setItem(SESSION_KEY, raw)
    renderProbe()
    expect(address()).toBe('none')
  })

  it.each([
    ['a missing address', { ...valid, address: undefined }],
    ['an invalid address', { ...valid, address: 'not-an-address' }],
    ['an address with a broken checksum', { ...valid, address: '0QDwzJzZsHarII9Sv4krAGIhIn12pEhCj4LYcKa8jdXTd7Pa' }],
    ['a null public key', { ...valid, publicKey: null }],
    ['a short public key', { ...valid, publicKey: Array(31).fill(1) }],
    ['a short secret key', { ...valid, secretKey: Array(63).fill(2) }],
    ['a non-numeric key', { ...valid, secretKey: Array(64).fill('x') }],
    ['an out-of-range byte', { ...valid, secretKey: Array(64).fill(999) }],
    ['a string instead of a key array', { ...valid, publicKey: 'AAAA' }],
  ])('rejects a tampered session with %s', (_label, data) => {
    // A tampered payload used to be fed straight into new Uint8Array(), yielding a
    // wallet with an empty key and an attacker-chosen address shown as the user's.
    store(data)
    renderProbe()
    expect(address()).toBe('none')
  })
})

describe('WalletContext — focus revalidation', () => {
  it('drops the wallet when another tab logged out', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        address: WALLET.nonBounceableTest,
        publicKey: Array(32).fill(1),
        secretKey: Array(64).fill(2),
      }),
    )
    renderProbe()
    expect(address()).toBe(WALLET.nonBounceableTest)

    sessionStorage.removeItem(SESSION_KEY)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(address()).toBe('none')
  })

  it('keeps the in-memory mnemonic across a focus event for the same wallet', () => {
    // Regression: refocusing right after creation replaced the live object with a
    // restored one, silently discarding the phrase the user had not yet written down.
    renderProbe()
    fireEvent.click(screen.getByText('set'))
    expect(screen.getByTestId('words').textContent).toBe('24')

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.getByTestId('words').textContent).toBe('24')
  })
})
