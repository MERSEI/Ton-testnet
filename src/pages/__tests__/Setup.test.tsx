/**
 * Tests for the onboarding screen.
 *
 * The crypto module is mocked: the real derivation and checksum behaviour is
 * covered in src/crypto/__tests__/wallet.test.ts (node environment), and
 * @ton/crypto cannot run under jsdom because tweetnacl's `instanceof Uint8Array`
 * check fails across realms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { Setup } from '../Setup'
import { WalletProvider } from '../../store/WalletContext'
import { MNEMONIC_24, WALLET } from '../../tests/fixtures'

const generateWallet = vi.fn()
const deriveWallet = vi.fn()

vi.mock('../../crypto/wallet', async importOriginal => {
  const actual = await importOriginal<typeof import('../../crypto/wallet')>()
  return {
    ...actual,
    generateWallet: () => generateWallet(),
    deriveWallet: (words: string[]) => deriveWallet(words),
  }
})

const fakeWallet = {
  address: WALLET.nonBounceableTest,
  mnemonic: MNEMONIC_24,
  keys: { publicKey: new Uint8Array(32), secretKey: new Uint8Array(64) },
}

function renderSetup() {
  return render(
    <WalletProvider>
      <Setup />
    </WalletProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  generateWallet.mockReset().mockResolvedValue(fakeWallet)
  deriveWallet.mockReset().mockResolvedValue(fakeWallet)
})

describe('Setup — choose view', () => {
  it('offers both create and import', () => {
    renderSetup()
    expect(screen.getByText('+ Create new wallet')).toBeInTheDocument()
    expect(screen.getByText('Import existing wallet')).toBeInTheDocument()
  })

  it('surfaces a generation failure', async () => {
    generateWallet.mockRejectedValue(new Error('entropy unavailable'))
    renderSetup()
    fireEvent.click(screen.getByText('+ Create new wallet'))
    expect(await screen.findByText('entropy unavailable')).toBeInTheDocument()
  })
})

describe('Setup — create view', () => {
  async function create() {
    renderSetup()
    fireEvent.click(screen.getByText('+ Create new wallet'))
    await screen.findByText('Save your Secret Phrase')
  }

  it('shows all 24 words after revealing them', async () => {
    await create()
    fireEvent.click(screen.getByText('Tap to reveal'))
    for (const word of new Set(MNEMONIC_24)) {
      expect(screen.getAllByText(word).length).toBeGreaterThan(0)
    }
  })

  it('hides the phrase behind an explicit reveal', async () => {
    // The phrase should not be visible by default on a screen that may be shared.
    await create()
    expect(screen.getByText('Tap to reveal')).toBeInTheDocument()
  })

  it('warns that the phrase is not stored anywhere', async () => {
    await create()
    expect(screen.getByText(/reload this page and it is gone/i)).toBeInTheDocument()
  })

  it('keeps "Open wallet" disabled until the backup is acknowledged', async () => {
    await create()
    const open = screen.getByText('Open wallet')
    expect(open).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(open).toBeEnabled()
  })

  it('only allows copying after the phrase was revealed', async () => {
    await create()
    expect(screen.getByText('Copy phrase')).toBeDisabled()
    fireEvent.click(screen.getByText('Tap to reveal'))
    expect(screen.getByText('Copy phrase')).toBeEnabled()
  })

  it('persists the session when the wallet is opened', async () => {
    await create()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Open wallet'))
    await waitFor(() => {
      expect(sessionStorage.getItem('ton_wallet_session')).toContain(WALLET.nonBounceableTest)
    })
  })

  it('never writes the mnemonic to storage', async () => {
    await create()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Open wallet'))
    await waitFor(() => expect(sessionStorage.getItem('ton_wallet_session')).toBeTruthy())
    const stored = sessionStorage.getItem('ton_wallet_session')!
    expect(stored).not.toContain(MNEMONIC_24[0])
    expect(JSON.parse(stored)).not.toHaveProperty('mnemonic')
  })
})

describe('Setup — import view', () => {
  function openImport() {
    renderSetup()
    fireEvent.click(screen.getByText('Import existing wallet'))
    return screen.getByLabelText('Seed phrase')
  }

  it('counts the words as they are typed', () => {
    const box = openImport()
    fireEvent.change(box, { target: { value: 'dose ice enrich' } })
    expect(screen.getByText('3 / 24 words')).toBeInTheDocument()
  })

  it('counts a full phrase as 24 even with numbering and mixed case', () => {
    const box = openImport()
    const messy = MNEMONIC_24.map((w, i) => `${i + 1}. ${w.toUpperCase()}`).join(' ')
    fireEvent.change(box, { target: { value: messy } })
    expect(screen.getByText('24 / 24 words')).toBeInTheDocument()
  })

  it('rejects the wrong number of words without calling derivation', async () => {
    const box = openImport()
    fireEvent.change(box, { target: { value: 'dose ice enrich' } })
    fireEvent.click(screen.getByText('Import wallet'))
    expect(await screen.findByText(/Expected 24 words, found 3/)).toBeInTheDocument()
    expect(deriveWallet).not.toHaveBeenCalled()
  })

  it('passes a normalised phrase to derivation', () => {
    const box = openImport()
    fireEvent.change(box, { target: { value: `  ${MNEMONIC_24.join('  ').toUpperCase()}  ` } })
    fireEvent.click(screen.getByText('Import wallet'))
    expect(deriveWallet).toHaveBeenCalledWith(MNEMONIC_24)
  })

  it('surfaces a checksum failure as a typo, not as lost funds', async () => {
    // Regression: an unvalidated phrase silently opened a different empty wallet.
    deriveWallet.mockRejectedValue(
      new Error('This seed phrase failed its checksum. One or more words are misspelled or out of order.'),
    )
    const box = openImport()
    fireEvent.change(box, { target: { value: MNEMONIC_24.join(' ') } })
    fireEvent.click(screen.getByText('Import wallet'))
    expect(await screen.findByText(/failed its checksum/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('ton_wallet_session')).toBeNull()
  })

  it('opens the wallet on a valid phrase', async () => {
    const box = openImport()
    fireEvent.change(box, { target: { value: MNEMONIC_24.join(' ') } })
    fireEvent.click(screen.getByText('Import wallet'))
    await waitFor(() => {
      expect(sessionStorage.getItem('ton_wallet_session')).toContain(WALLET.nonBounceableTest)
    })
  })

  it('goes back to the choose view and clears the error', async () => {
    const box = openImport()
    fireEvent.change(box, { target: { value: 'too few' } })
    fireEvent.click(screen.getByText('Import wallet'))
    await screen.findByText(/Expected 24 words/)
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('+ Create new wallet')).toBeInTheDocument()
    expect(screen.queryByText(/Expected 24 words/)).not.toBeInTheDocument()
  })
})
