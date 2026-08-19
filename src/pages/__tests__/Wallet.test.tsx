/**
 * Tests for the wallet dashboard — balance card, address, actions and history.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { Wallet } from '../Wallet'
import { WalletProvider } from '../../store/WalletContext'
import * as addressBook from '../../utils/addressBook'
import type { TonTransaction } from '../../api/tonCenter'
import { WALLET, PEER_A, PEER_B } from '../../tests/fixtures'

// ── Mocks ────────────────────────────────────────────────────────────────────

const account = {
  nanotons: '1500000000' as string | null,
  seqno: 3 as number | null,
  deployed: true as boolean | null,
  loading: false,
  loaded: true,
  error: null as string | null,
  refresh: vi.fn(),
}

const txState = {
  transactions: [] as TonTransaction[],
  loading: false,
  loaded: true,
  error: null as string | null,
  refresh: vi.fn(),
}

vi.mock('../../hooks/useAccount', () => ({ useAccount: () => account }))
vi.mock('../../hooks/useTransactions', () => ({ useTransactions: () => txState }))

// ── Helpers ───────────────────────────────────────────────────────────────────

function tx(over: Partial<TonTransaction> = {}): TonTransaction {
  return {
    hash: 'HASH1',
    lt: '100',
    timestamp: 1_700_000_000,
    type: 'in',
    amount: '2000000000',
    address: PEER_A.bounceable,
    fee: '5000000',
    ...over,
  }
}

function seedSession() {
  sessionStorage.setItem(
    'ton_wallet_session',
    JSON.stringify({
      address: WALLET.nonBounceableTest,
      publicKey: Array(32).fill(0),
      secretKey: Array(64).fill(0),
    }),
  )
}

const onNavigate = vi.fn()

function renderWallet() {
  seedSession()
  return render(
    <WalletProvider>
      <Wallet onNavigate={onNavigate} />
    </WalletProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  addressBook.clearAddressBook()
  onNavigate.mockClear()
  account.refresh.mockClear()
  txState.refresh.mockClear()
  Object.assign(account, {
    nanotons: '1500000000', seqno: 3, deployed: true,
    loading: false, loaded: true, error: null,
  })
  Object.assign(txState, { transactions: [], loading: false, loaded: true, error: null })
})

afterEach(() => {
  sessionStorage.clear()
  addressBook.clearAddressBook()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Wallet dashboard — balance card', () => {
  it('shows the network label and the formatted balance', () => {
    const { container } = renderWallet()
    expect(screen.getByText('TON TESTNET')).toBeInTheDocument()
    // The whole and fractional parts are set at different sizes, so assert the
    // rendered figure as a whole — and that the exact value is never rounded.
    expect(container.querySelector('.hero-figure')!.textContent).toContain('1.5')
    expect(container.querySelector('.hero-figure')!.textContent).toContain('TON')
  })

  it('shows nanoton precision in full rather than rounding it away', () => {
    Object.assign(account, { nanotons: '995994535' })
    const { container } = renderWallet()
    expect(container.querySelector('.hero-figure')!.textContent).toContain('0.995994535')
  })

  it('shows a placeholder when the balance is unknown', () => {
    Object.assign(account, { nanotons: null, loaded: false })
    renderWallet()
    expect(screen.getByText('— TON')).toBeInTheDocument()
  })

  it('shows a spinner during the very first load', () => {
    Object.assign(account, { nanotons: null, loading: true, loaded: false })
    renderWallet()
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0)
  })

  it('renders a zero balance as 0 rather than a placeholder', () => {
    Object.assign(account, { nanotons: '0' })
    const { container } = renderWallet()
    expect(container.querySelector('.hero-figure')!.textContent).toContain('0')
    expect(screen.queryByText('— TON')).not.toBeInTheDocument()
  })

  it('fetches balance and history on mount', () => {
    renderWallet()
    expect(account.refresh).toHaveBeenCalled()
    expect(txState.refresh).toHaveBeenCalled()
  })
})

describe('Wallet dashboard — address', () => {
  it('shows the grouped full address by default', () => {
    // The address is what the user must verify, so it is not truncated away on the
    // screen they look at most.
    const { container } = renderWallet()
    const plate = container.querySelector('.plate')!
    expect(plate).toBeInTheDocument()
    // Grouping is presentational: the plate still exposes one unbroken string.
    expect(plate).toHaveAttribute('aria-label', WALLET.nonBounceableTest)
    expect(container.querySelectorAll('.plate__group')).toHaveLength(12)
  })

  it('toggles between the grouped plate and a compact form', async () => {
    const { container } = renderWallet()
    const toggle = screen.getByTitle('Tap to toggle full address')

    fireEvent.click(toggle)
    await waitFor(() => expect(container.querySelector('.plate')).not.toBeInTheDocument())
    expect(container.querySelectorAll('.address-highlight')).toHaveLength(2)

    fireEvent.click(toggle)
    await waitFor(() => expect(container.querySelector('.plate')).toBeInTheDocument())
  })

  it('marks the corners in the accent, which is legible on the panel', async () => {
    const { container } = renderWallet()
    // Compact form uses AddressDisplay, whose corners carry the accent inline.
    fireEvent.click(screen.getByTitle('Tap to toggle full address'))
    await waitFor(() => expect(container.querySelectorAll('.address-highlight')).toHaveLength(2))
    container.querySelectorAll<HTMLElement>('.address-highlight').forEach(el => {
      expect(el.style.color).toContain('--acid')
    })
  })

  it('marks the corners on the grouped plate too', () => {
    const { container } = renderWallet()
    const marked = Array.from(container.querySelectorAll('.plate__mark'))
      .map(el => el.textContent)
      .join('')
    expect(marked).toBe(
      WALLET.nonBounceableTest.slice(0, 6) + WALLET.nonBounceableTest.slice(-4),
    )
  })

  it('copies the address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderWallet()
    fireEvent.click(screen.getByLabelText('Copy address'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(WALLET.nonBounceableTest))
  })
})

describe('Wallet dashboard — navigation and session', () => {
  it('routes to Receive and Send', () => {
    renderWallet()
    fireEvent.click(screen.getByText('Receive'))
    expect(onNavigate).toHaveBeenCalledWith('receive')
    fireEvent.click(screen.getByText('Send'))
    expect(onNavigate).toHaveBeenCalledWith('send')
  })

  it('clears the session on disconnect', async () => {
    renderWallet()
    fireEvent.click(screen.getByLabelText('Disconnect wallet'))
    await waitFor(() => {
      expect(sessionStorage.getItem('ton_wallet_session')).toBeNull()
    })
  })

  it('opens the help dialog', async () => {
    renderWallet()
    fireEvent.click(screen.getByLabelText('Help'))
    expect(await screen.findByText('How to use')).toBeInTheDocument()
  })
})

describe('Wallet dashboard — refresh cooldown', () => {
  it('refetches on demand', () => {
    renderWallet()
    account.refresh.mockClear()
    txState.refresh.mockClear()
    fireEvent.click(screen.getByLabelText('Refresh balance and history'))
    expect(account.refresh).toHaveBeenCalledTimes(1)
    expect(txState.refresh).toHaveBeenCalledTimes(1)
  })

  it('disables the button afterwards so the rate limit is not tripped', async () => {
    renderWallet()
    const button = screen.getByLabelText('Refresh balance and history')
    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())

    account.refresh.mockClear()
    fireEvent.click(button)
    expect(account.refresh).not.toHaveBeenCalled()
  })
})

describe('Wallet dashboard — transaction history', () => {
  it('shows an empty state', () => {
    renderWallet()
    expect(screen.getByText('No transactions yet.')).toBeInTheDocument()
  })

  it('renders an incoming transaction with a positive signed amount', () => {
    txState.transactions = [tx({ type: 'in', amount: '2000000000' })]
    renderWallet()
    expect(screen.getByText('Received')).toBeInTheDocument()
    expect(screen.getByText('+2 TON')).toBeInTheDocument()
    expect(screen.getByText(/^From:/)).toBeInTheDocument()
  })

  it('renders an outgoing transaction with a negative signed amount', () => {
    txState.transactions = [tx({ type: 'out', amount: '500000000' })]
    renderWallet()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('−0.5 TON')).toBeInTheDocument()
    expect(screen.getByText(/^To:/)).toBeInTheDocument()
  })

  it('shows the fee', () => {
    txState.transactions = [tx({ fee: '5000000' })]
    renderWallet()
    expect(screen.getByText('fee 0.005')).toBeInTheDocument()
  })

  it('shows a comment when present', () => {
    txState.transactions = [tx({ comment: 'invoice 42' })]
    renderWallet()
    expect(screen.getByText(/invoice 42/)).toBeInTheDocument()
  })

  it('links each transaction to the testnet explorer', () => {
    txState.transactions = [tx({ hash: 'a+b/c=' })]
    renderWallet()
    const link = screen.getByRole('link', { name: 'explorer' })
    expect(link).toHaveAttribute('href', expect.stringContaining('testnet.tonviewer.com'))
    expect(link).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('a+b/c=')))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('does not crash on a transaction with no timestamp or counterparty', () => {
    txState.transactions = [tx({ timestamp: 0, address: '', amount: '0', fee: '0' })]
    renderWallet()
    expect(screen.getByText(/^Pending/)).toBeInTheDocument()
  })

  it('renders several transactions with stable keys', () => {
    txState.transactions = [
      tx({ hash: 'H1', lt: '1' }),
      tx({ hash: 'H1', lt: '2' }),
      tx({ hash: 'H2', lt: '3', type: 'out' }),
    ]
    renderWallet()
    expect(screen.getAllByText(/Received|Sent/)).toHaveLength(3)
  })
})

describe('Wallet dashboard — search', () => {
  beforeEach(() => {
    txState.transactions = [
      tx({ hash: 'H1', address: PEER_A.bounceable, amount: '2500000000', comment: 'salary' }),
      tx({ hash: 'H2', address: PEER_B.bounceable, amount: '7250000000', comment: 'rent' }),
    ]
  })

  const searchBox = () => screen.getByLabelText('Search transactions')

  it('filters by address', () => {
    renderWallet()
    fireEvent.change(searchBox(), { target: { value: PEER_B.bounceable.slice(0, 10) } })
    expect(screen.getByText('+7.25 TON')).toBeInTheDocument()
    expect(screen.queryByText('+2.5 TON')).not.toBeInTheDocument()
  })

  it('filters by amount', () => {
    renderWallet()
    // A decimal amount cannot collide with characters inside a base64 address.
    fireEvent.change(searchBox(), { target: { value: '7.25' } })
    expect(screen.getByText('+7.25 TON')).toBeInTheDocument()
    expect(screen.queryByText('+2.5 TON')).not.toBeInTheDocument()
  })

  it('filters by comment', () => {
    renderWallet()
    fireEvent.change(searchBox(), { target: { value: 'RENT' } })
    expect(screen.getByText('+7.25 TON')).toBeInTheDocument()
    expect(screen.queryByText('+2.5 TON')).not.toBeInTheDocument()
  })

  it('reports when nothing matches', () => {
    renderWallet()
    fireEvent.change(searchBox(), { target: { value: 'zzzzz' } })
    expect(screen.getByText('No transactions match your search.')).toBeInTheDocument()
  })

  it('ignores surrounding whitespace', () => {
    renderWallet()
    fireEvent.change(searchBox(), { target: { value: '   ' } })
    expect(screen.getAllByText(/Received|Sent/)).toHaveLength(2)
  })
})

describe('Wallet dashboard — errors and deployment state', () => {
  it('surfaces a balance error and reassures about funds', () => {
    account.error = 'Rate limited by TON Center'
    renderWallet()
    expect(screen.getByRole('alert').textContent).toContain('Rate limited by TON Center')
    expect(screen.getByText(/Your funds are safe/)).toBeInTheDocument()
  })

  it('surfaces a transaction error separately', () => {
    txState.error = 'network down'
    renderWallet()
    expect(screen.getByRole('alert').textContent).toContain('network down')
  })

  it('explains an undeployed wallet', () => {
    account.deployed = false
    renderWallet()
    expect(screen.getByText(/Not deployed on-chain yet/)).toBeInTheDocument()
  })

  it('says nothing about deployment before the first successful load', () => {
    Object.assign(account, { deployed: false, loaded: false })
    renderWallet()
    expect(screen.queryByText(/Not deployed on-chain yet/)).not.toBeInTheDocument()
  })
})

describe('Wallet dashboard — address book seeding', () => {
  it('seeds outgoing destinations from history as unconfirmed entries', async () => {
    txState.transactions = [tx({ type: 'out', address: PEER_A.bounceable })]
    renderWallet()
    await waitFor(() => {
      expect(addressBook.isKnownAddress(PEER_A.bounceable)).toBe(true)
    })
    expect(addressBook.isConfirmedAddress(PEER_A.bounceable)).toBe(false)
  })

  it('does not seed incoming sources', async () => {
    txState.transactions = [tx({ type: 'in', address: PEER_A.bounceable })]
    renderWallet()
    await waitFor(() => expect(screen.getByText('Received')).toBeInTheDocument())
    expect(addressBook.isKnownAddress(PEER_A.bounceable)).toBe(false)
  })
})
