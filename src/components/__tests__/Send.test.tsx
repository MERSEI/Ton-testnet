/**
 * Component tests for the Send page.
 * The crypto and API layers are mocked so the suite stays fast and deterministic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { Send } from '../../pages/Send'
import { WalletProvider } from '../../store/WalletContext'
import * as addressBook from '../../utils/addressBook'
import type { SimilarMatch } from '../../utils/addressBook'
import { WALLET, PEER_A, PEER_B, CHECKSUM_BROKEN } from '../../tests/fixtures'

// ── Mocks ────────────────────────────────────────────────────────────────────

/**
 * Look-alike detection needs two addresses that collide on their first 6 / last 4
 * characters, which a real attacker has to brute-force and a test cannot fabricate
 * (every valid TON address carries a CRC over its payload). The algorithm itself is
 * covered in utils/__tests__/addressBook.test.ts with synthetic strings; here we
 * override the detector to assert the Send page *wires it up* correctly.
 */
const similarOverride = vi.hoisted(() => ({ value: undefined as SimilarMatch | null | undefined }))

vi.mock('../../utils/addressBook', async importOriginal => {
  const actual = await importOriginal<typeof import('../../utils/addressBook')>()
  return {
    ...actual,
    findSimilarKnownAddress: (addr: string) =>
      similarOverride.value !== undefined ? similarOverride.value : actual.findSimilarKnownAddress(addr),
  }
})

const sendSpy = vi.fn().mockResolvedValue('abc123hash')

const account = {
  nanotons: '5000000000', // 5 TON
  seqno: 3,
  deployed: true,
  loading: false,
  loaded: true,
  error: null as string | null,
  refresh: vi.fn(),
}

vi.mock('../../hooks/useAccount', () => ({
  useAccount: () => account,
}))

vi.mock('../../hooks/useSend', () => ({
  useSend: () => ({
    loading: false,
    txHash: null,
    error: null,
    send: sendSpy,
    reset: vi.fn(),
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADDR_PLACEHOLDER = 'UQ…, EQ…, kQ… or 0Q…'

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

function renderSend() {
  seedSession()
  return render(
    <WalletProvider>
      <Send />
    </WalletProvider>,
  )
}

const addrInput = () => screen.getByPlaceholderText(ADDR_PLACEHOLDER)
const amountInput = () => screen.getByPlaceholderText('0.0')
const submit = () => fireEvent.click(screen.getByText('Review & Send'))

function fill(address: string, amount = '1') {
  fireEvent.change(addrInput(), { target: { value: address } })
  fireEvent.change(amountInput(), { target: { value: amount } })
}

beforeEach(() => {
  sessionStorage.clear()
  addressBook.clearAddressBook()
  sendSpy.mockClear()
  similarOverride.value = undefined
  Object.assign(account, {
    nanotons: '5000000000',
    seqno: 3,
    deployed: true,
    loading: false,
    loaded: true,
    error: null,
  })
})

afterEach(() => {
  sessionStorage.clear()
  addressBook.clearAddressBook()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Send page — basic rendering', () => {
  it('renders the recipient, amount and comment inputs', () => {
    renderSend()
    expect(addrInput()).toBeInTheDocument()
    expect(amountInput()).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Payment for…')).toBeInTheDocument()
  })

  it('renders the submit button and the current balance', () => {
    renderSend()
    expect(screen.getByText('Review & Send')).toBeInTheDocument()
    expect(screen.getByText(/Balance: 5 TON/)).toBeInTheDocument()
  })

  it('advertises every accepted address form in the placeholder', () => {
    renderSend()
    // The old placeholder promised only UQ…/EQ… while validation also rejected 0Q…
    expect(addrInput()).toHaveAttribute('placeholder', expect.stringContaining('0Q'))
  })
})

describe('Send page — validation', () => {
  it('rejects an empty form', async () => {
    renderSend()
    submit()
    expect(await screen.findByText(/recipient address is required/i)).toBeInTheDocument()
  })

  it('rejects an unparseable address', async () => {
    renderSend()
    fill('invalid-addr')
    submit()
    expect(await screen.findByText(/invalid ton address/i)).toBeInTheDocument()
  })

  it('rejects an address whose checksum fails', async () => {
    // Regression: the old regex accepted any 48-char base64 string, so a single
    // mistyped character was broadcast to whatever account it decoded to.
    renderSend()
    fill(CHECKSUM_BROKEN)
    submit()
    expect(await screen.findByText(/checksum does not match/i)).toBeInTheDocument()
  })

  it('accepts the 0Q… form the wallet generates for itself', async () => {
    renderSend()
    fill(PEER_A.canonical)
    submit()
    expect(await screen.findByText('Confirm Transaction')).toBeInTheDocument()
  })

  it('accepts a raw workchain:hex address', async () => {
    renderSend()
    fill(WALLET.raw.replace('f0cc', 'f0cd'))
    submit()
    expect(await screen.findByText('Confirm Transaction')).toBeInTheDocument()
  })

  it('rejects sending to your own address', async () => {
    renderSend()
    fill(WALLET.nonBounceableTest)
    submit()
    // Flagged twice on purpose: inline next to the field and as the form error.
    expect(await screen.findAllByText(/your own address/i)).toHaveLength(2)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('detects a self-send given in a different address format', async () => {
    renderSend()
    fireEvent.change(addrInput(), { target: { value: WALLET.bounceableMain } })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/this is your own address/i)
  })

  it('rejects a zero amount', async () => {
    renderSend()
    fill(PEER_A.bounceable, '0')
    submit()
    expect(await screen.findByText(/amount must be greater than 0/i)).toBeInTheDocument()
  })

  it('rejects an amount above the balance', async () => {
    renderSend()
    fill(PEER_A.bounceable, '999999')
    submit()
    expect(await screen.findByText(/insufficient balance/i)).toBeInTheDocument()
  })

  it('requires a fee reserve rather than letting the whole balance go', async () => {
    // Sending the exact balance leaves nothing for gas and the network rejects it.
    renderSend()
    fill(PEER_A.bounceable, '5')
    submit()
    expect(await screen.findByText(/network fees/i)).toBeInTheDocument()
  })

  it('rejects a malformed amount instead of coercing it', async () => {
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_A.bounceable } })
    fireEvent.change(amountInput(), { target: { value: '1e9' } })
    submit()
    expect(await screen.findByText(/plain decimal number/i)).toBeInTheDocument()
  })

  it('says the balance is unknown instead of claiming it is insufficient', async () => {
    // Regression: a failed balance load was treated as a zero balance, so a
    // network problem surfaced as "Insufficient balance".
    Object.assign(account, { nanotons: null, loaded: false, error: 'Rate limited' })
    renderSend()
    fill(PEER_A.bounceable, '1')
    submit()
    expect(await screen.findByText(/balance could not be loaded/i)).toBeInTheDocument()
    expect(screen.queryByText(/insufficient balance/i)).not.toBeInTheDocument()
  })

  it('offers a retry when the balance failed to load', () => {
    Object.assign(account, { nanotons: null, loaded: false, error: 'Rate limited' })
    renderSend()
    expect(screen.getByText(/balance unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('Send page — Max button and fee reserve', () => {
  it('fills the balance minus the fee reserve', () => {
    renderSend()
    fireEvent.click(screen.getByText('Max'))
    expect((amountInput() as HTMLInputElement).value).toBe('4.99')
  })

  it('produces an amount that passes validation', async () => {
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_A.bounceable } })
    fireEvent.click(screen.getByText('Max'))
    submit()
    expect(await screen.findByText('Confirm Transaction')).toBeInTheDocument()
  })

  it('is disabled when the balance is below the reserve', () => {
    Object.assign(account, { nanotons: '1000000' }) // 0.001 TON
    renderSend()
    expect(screen.getByText('Max')).toBeDisabled()
  })
})

describe('Send page — comment', () => {
  it('shows a byte counter', () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('Payment for…'), { target: { value: 'hello' } })
    expect(screen.getByText('5/120')).toBeInTheDocument()
  })

  it('counts multi-byte characters as bytes', () => {
    renderSend()
    fireEvent.change(screen.getByPlaceholderText('Payment for…'), { target: { value: '🚀' } })
    expect(screen.getByText('4/120')).toBeInTheDocument()
  })

  it('blocks submission of an over-long comment', async () => {
    renderSend()
    fill(PEER_A.bounceable, '1')
    fireEvent.change(screen.getByPlaceholderText('Payment for…'), {
      target: { value: 'x'.repeat(121) },
    })
    submit()
    expect(await screen.findByText(/comment is too long/i)).toBeInTheDocument()
  })
})

describe('Send page — SECURITY MECHANISM B (clipboard warning)', () => {
  it('warns after a paste event', async () => {
    renderSend()
    fireEvent.paste(addrInput())
    expect(await screen.findByText(/pasted from clipboard/i)).toBeInTheDocument()
  })

  it('offers no way to dismiss the warning', async () => {
    renderSend()
    fireEvent.paste(addrInput())
    await screen.findByText(/pasted from clipboard/i)
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  it('clears the warning only after a manual edit', async () => {
    renderSend()
    const input = addrInput()
    fireEvent.paste(input)
    await screen.findByText(/pasted from clipboard/i)

    // A change without a preceding keystroke (e.g. another paste) keeps the warning.
    fireEvent.change(input, { target: { value: PEER_A.bounceable } })
    expect(screen.getByText(/pasted from clipboard/i)).toBeInTheDocument()

    // A keystroke followed by a change clears it.
    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.change(input, { target: { value: `${PEER_A.bounceable}a` } })
    await waitFor(() => {
      expect(screen.queryByText(/pasted from clipboard/i)).not.toBeInTheDocument()
    })
  })
})

describe('Send page — SECURITY MECHANISM C (address familiarity)', () => {
  it('warns for an address never sent to', async () => {
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_A.bounceable } })
    expect(await screen.findByText(/never sent to this address before/i)).toBeInTheDocument()
  })

  it('confirms an address already sent to from this device', async () => {
    addressBook.addKnownAddress(PEER_A.bounceable)
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_A.bounceable } })
    expect(await screen.findByText(/sent to this address from this device/i)).toBeInTheDocument()
    expect(screen.queryByText(/never sent to this address before/i)).not.toBeInTheDocument()
  })

  it('recognises an address given in a different format', async () => {
    addressBook.addKnownAddress(PEER_A.bounceable)
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_A.canonical } })
    expect(await screen.findByText(/from this device/i)).toBeInTheDocument()
  })

  it('does not fully trust an address only seen in on-chain history', async () => {
    // A fabricated history entry must not silently switch the warning off.
    addressBook.seedAddressBookFromHistory([
      {
        hash: 'h', lt: '1', timestamp: 1_700_000_000, type: 'out',
        amount: '1', address: PEER_B.bounceable, fee: '1',
      },
    ])
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_B.bounceable } })
    expect(await screen.findByText(/on-chain history, not from a send made on this/i)).toBeInTheDocument()
  })

  it('flags a look-alike address inline', async () => {
    similarOverride.value = {
      entry: { address: PEER_A.canonical, addedAt: 1, source: 'sent' },
      reason: 'prefix',
    }
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_B.bounceable } })
    expect(await screen.findByText(/suspicious address match/i)).toBeInTheDocument()
  })

  it('escalates a corner collision, which defeats the visual check', async () => {
    similarOverride.value = {
      entry: { address: PEER_A.canonical, addedAt: 1, source: 'sent' },
      reason: 'corners',
    }
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_B.bounceable } })
    expect(await screen.findByText(/first 6 and last 4 characters match/i)).toBeInTheDocument()
  })

  it('suppresses the first-send hint in favour of the stronger look-alike warning', async () => {
    similarOverride.value = {
      entry: { address: PEER_A.canonical, addedAt: 1, source: 'sent' },
      reason: 'corners',
    }
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_B.bounceable } })
    await screen.findByText(/suspicious address match/i)
    expect(screen.queryByText(/never sent to this address before/i)).not.toBeInTheDocument()
  })

  it('does not run look-alike detection against a confirmed recipient', async () => {
    similarOverride.value = null
    addressBook.addKnownAddress(PEER_A.bounceable)
    renderSend()
    fireEvent.change(addrInput(), { target: { value: PEER_A.bounceable } })
    expect(await screen.findByText(/from this device/i)).toBeInTheDocument()
    expect(screen.queryByText(/suspicious address match/i)).not.toBeInTheDocument()
  })

  it('shows no warnings for your own address beyond the self-send block', async () => {
    renderSend()
    fireEvent.change(addrInput(), { target: { value: WALLET.nonBounceableTest } })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/this is your own address/i)
    expect(screen.queryByText(/never sent to this address before/i)).not.toBeInTheDocument()
  })
})

describe('Send page — confirmation modal', () => {
  async function openModal(address: string = PEER_A.bounceable, amount = '1') {
    renderSend()
    fill(address, amount)
    submit()
    await screen.findByText('Confirm Transaction')
  }

  it('opens with valid input', async () => {
    await openModal()
    expect(screen.getByText('Confirm Transaction')).toBeInTheDocument()
  })

  it('shows the canonical recipient, the amount and the bounce behaviour', async () => {
    await openModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(PEER_A.canonical)
    expect(dialog.textContent).toContain('1 TON')
    expect(dialog.textContent).toMatch(/funds return if the account does not exist/i)
  })

  it('reports bounce off for a non-bounceable recipient', async () => {
    await openModal(PEER_A.canonical)
    expect(screen.getByRole('dialog').textContent).toMatch(/standard for wallet addresses/i)
  })

  it('repeats the first-send warning inside the modal', async () => {
    await openModal()
    expect(screen.getByText(/first time sending to this address/i)).toBeInTheDocument()
  })

  it('repeats a look-alike warning inside the modal', async () => {
    similarOverride.value = {
      entry: { address: PEER_A.canonical, addedAt: 1, source: 'sent' },
      reason: 'prefix',
    }
    renderSend()
    fill(PEER_B.bounceable, '1')
    submit()
    await screen.findByText('Confirm Transaction')
    // Once inline, once inside the dialog — it must not be missable.
    expect(screen.getAllByText(/suspicious address match/i)).toHaveLength(2)
  })

  it('is a real dialog for assistive tech', async () => {
    await openModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })

  it('cancel closes it without sending', async () => {
    await openModal()
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText('Confirm Transaction')).not.toBeInTheDocument()
    })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('Escape closes it without sending', async () => {
    await openModal()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Confirm Transaction')).not.toBeInTheDocument()
    })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('sends the normalised address, not the raw input', async () => {
    await openModal(PEER_A.bounceable, '1')
    fireEvent.click(screen.getByText('Confirm Send'))
    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1))
    expect(sendSpy.mock.calls[0][0]).toMatchObject({
      toAddress: PEER_A.canonical,
      amountTon: '1',
      walletAddress: WALLET.nonBounceableTest,
    })
  })

  it('omits an empty comment rather than sending whitespace', async () => {
    renderSend()
    fill(PEER_A.bounceable, '1')
    fireEvent.change(screen.getByPlaceholderText('Payment for…'), { target: { value: '   ' } })
    submit()
    await screen.findByText('Confirm Transaction')
    fireEvent.click(screen.getByText('Confirm Send'))
    await waitFor(() => expect(sendSpy).toHaveBeenCalled())
    expect(sendSpy.mock.calls[0][0].comment).toBeUndefined()
  })
})

describe('Send page — deployment notice', () => {
  it('explains that the first transfer deploys the wallet', () => {
    Object.assign(account, { deployed: false })
    renderSend()
    expect(screen.getByText(/first outgoing transfer also deploys/i)).toBeInTheDocument()
  })

  it('stays quiet for a deployed wallet', () => {
    renderSend()
    expect(screen.queryByText(/also deploys/i)).not.toBeInTheDocument()
  })
})
