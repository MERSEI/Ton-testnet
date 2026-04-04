/**
 * Component tests for the Send page.
 * We mock the heavy dependencies (crypto, API) to keep tests fast.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { Send } from '../../pages/Send'
import { WalletProvider } from '../../store/WalletContext'
import * as addressBook from '../../utils/addressBook'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../hooks/useBalance', () => ({
  useBalance: () => ({ nanotons: '5000000000', loading: false, error: null, refresh: vi.fn() }),
}))

vi.mock('../../hooks/useSend', () => ({
  useSend: () => ({
    loading: false,
    txHash: null,
    error: null,
    send: vi.fn().mockResolvedValue('abc123hash'),
    reset: vi.fn(),
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

// 48-char addresses (not valid TON CRC, but pass regex validation in isValidTonAddress)
const VALID_ADDR = 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'
// Shares positions 2-9 ('BvWWFP2p') with VALID_ADDR — simulates prefix-swap attack
const SIMILAR_ADDR = 'UQBvWWFP2pZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'

// Minimal session so WalletContext has a wallet
function seedSession() {
  const data = {
    address: VALID_ADDR,
    mnemonic: Array(24).fill('word'),
    publicKey: Array(32).fill(0),
    secretKey: Array(64).fill(0),
  }
  sessionStorage.setItem('ton_wallet_session', JSON.stringify(data))
}

function renderSend() {
  seedSession()
  return render(
    <WalletProvider>
      <Send />
    </WalletProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear()
  addressBook.clearAddressBook()
})

describe('Send page — basic rendering', () => {
  it('renders recipient address input', () => {
    renderSend()
    expect(screen.getByPlaceholderText('UQ…')).toBeInTheDocument()
  })

  it('renders amount input', () => {
    renderSend()
    expect(screen.getByPlaceholderText('0.5')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderSend()
    expect(screen.getByText('Review & Send')).toBeInTheDocument()
  })
})

describe('Send page — validation errors', () => {
  it('shows error when submitting empty form', async () => {
    renderSend()
    fireEvent.click(screen.getByText('Review & Send'))
    expect(await screen.findByText(/recipient address is required/i)).toBeInTheDocument()
  })

  it('shows error for invalid address', async () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: 'invalid-addr' } })
    fireEvent.change(screen.getByPlaceholderText('0.5'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Review & Send'))
    expect(await screen.findByText(/invalid ton address/i)).toBeInTheDocument()
  })

  it('shows error for zero amount', async () => {
    renderSend()
    const addrInput = screen.getByPlaceholderText('UQ…')
    const amountInput = screen.getByPlaceholderText('0.5')
    // Use fireEvent to set values directly to avoid userEvent interaction issues with number inputs
    fireEvent.change(addrInput, { target: { value: VALID_ADDR } })
    fireEvent.change(amountInput, { target: { value: '0' } })
    fireEvent.click(screen.getByText('Review & Send'))
    expect(await screen.findByText(/amount must be greater than 0/i)).toBeInTheDocument()
  })

  it('shows error when amount exceeds balance', async () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: VALID_ADDR } })
    fireEvent.change(screen.getByPlaceholderText('0.5'), { target: { value: '999999' } })
    fireEvent.click(screen.getByText('Review & Send'))
    expect(await screen.findByText(/insufficient balance/i)).toBeInTheDocument()
  })
})

describe('Send page — SECURITY MECHANISM B (clipboard warning)', () => {
  it('shows clipboard warning after paste event', async () => {
    renderSend()
    const input = screen.getByPlaceholderText('UQ…')
    fireEvent.paste(input)
    expect(await screen.findByText(/pasted from clipboard/i)).toBeInTheDocument()
  })

  it('shows warning banner with non-dismissable text', async () => {
    renderSend()
    const input = screen.getByPlaceholderText('UQ…')
    fireEvent.paste(input)
    // No close button
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
    // Warning visible
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('Send page — SECURITY MECHANISM C (new address warning)', () => {
  it('shows new-address hint for unknown address', async () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: VALID_ADDR } })
    expect(await screen.findByText(/never sent to this address before/i)).toBeInTheDocument()
  })

  it('shows similar-address warning inline when prefix-swap detected', async () => {
    addressBook.addKnownAddress(VALID_ADDR)
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: SIMILAR_ADDR } })
    const warnings = await screen.findAllByText(/suspicious address match/i)
    expect(warnings.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT show hint for known address', async () => {
    addressBook.addKnownAddress(VALID_ADDR)
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: VALID_ADDR } })
    await waitFor(() => {
      expect(screen.queryByText(/never sent to this address before/i)).not.toBeInTheDocument()
    })
  })
})

describe('Send page — confirmation modal', () => {
  it('opens confirmation modal with valid input', async () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: VALID_ADDR } })
    fireEvent.change(screen.getByPlaceholderText('0.5'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Review & Send'))
    expect(await screen.findByText('Confirm Transaction')).toBeInTheDocument()
  })

  it('shows new-address warning in confirmation modal for unknown address', async () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: VALID_ADDR } })
    fireEvent.change(screen.getByPlaceholderText('0.5'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Review & Send'))
    await screen.findByText('Confirm Transaction')
    expect(screen.getByText(/first time sending to this address/i)).toBeInTheDocument()
  })

  it('shows similar-address warning in modal when prefix-swap detected', async () => {
    // VALID_ADDR is known; SIMILAR_ADDR shares prefix → should trigger orange warning.
    // The warning appears BOTH inline (form) and in the modal — use getAllByText.
    addressBook.addKnownAddress(VALID_ADDR)
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: SIMILAR_ADDR } })
    fireEvent.change(screen.getByPlaceholderText('0.5'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Review & Send'))
    await screen.findByText('Confirm Transaction')
    const warnings = screen.getAllByText(/suspicious address match/i)
    expect(warnings.length).toBeGreaterThanOrEqual(1)
  })

  it('cancel closes the modal', async () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('UQ…'), { target: { value: VALID_ADDR } })
    fireEvent.change(screen.getByPlaceholderText('0.5'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Review & Send'))
    await screen.findByText('Confirm Transaction')
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText('Confirm Transaction')).not.toBeInTheDocument()
    })
  })
})
