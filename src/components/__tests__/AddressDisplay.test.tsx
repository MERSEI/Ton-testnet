import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { AddressDisplay } from '../AddressDisplay'
import { WALLET } from '../../tests/fixtures'

const ADDR = WALLET.nonBounceableTest
const HEAD = ADDR.slice(0, 6)
const TAIL = ADDR.slice(-4)

describe('AddressDisplay — SECURITY MECHANISM A', () => {
  it('renders a shortened address by default', () => {
    render(<AddressDisplay address={ADDR} />)
    expect(screen.getByText(HEAD)).toBeInTheDocument()
    expect(screen.getByText(TAIL)).toBeInTheDocument()
    expect(screen.queryByText(ADDR.slice(6, -4))).not.toBeInTheDocument()
  })

  it('renders the full address when full=true', () => {
    const { container } = render(<AddressDisplay address={ADDR} full />)
    expect(container.textContent).toBe(ADDR)
  })

  it('always marks exactly two corner spans', () => {
    // The weight itself lives in CSS (.address-highlight); what must hold here is
    // that exactly the two corners are marked and the middle is not.
    const { container } = render(<AddressDisplay address={ADDR} />)
    const highlights = container.querySelectorAll('.address-highlight')
    expect(highlights).toHaveLength(2)
    expect(highlights[0].textContent).toBe(HEAD)
    expect(highlights[1].textContent).toBe(TAIL)
  })

  it('switches the corners to dark ink on a light plate', () => {
    // The highlight is the whole point of Mechanism A, so it must never blend
    // into its background — accent-on-bone would be unreadable.
    const { container } = render(<AddressDisplay address={ADDR} tone="onAccent" />)
    const highlights = container.querySelectorAll<HTMLElement>('.address-highlight')
    expect(highlights).toHaveLength(2)
    highlights.forEach(el => {
      expect(el.style.color).toContain('--ink-900')
    })
  })

  it('uses the accent on the dark UI surface', () => {
    const { container } = render(<AddressDisplay address={ADDR} />)
    const el = container.querySelector<HTMLElement>('.address-highlight')!
    expect(el.style.color).toContain('--acid')
  })

  it('renders a short address without splitting it', () => {
    const { container } = render(<AddressDisplay address="SHORT" full />)
    expect(container.textContent).toBe('SHORT')
  })
})

describe('AddressDisplay — copy button', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('is absent by default', () => {
    render(<AddressDisplay address={ADDR} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('copies the FULL address even when displaying a shortened one', async () => {
    render(<AddressDisplay address={ADDR} copyable />)
    fireEvent.click(screen.getByRole('button', { name: /copy address/i }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ADDR)
    })
  })

  it('confirms the copy in the UI', async () => {
    render(<AddressDisplay address={ADDR} copyable />)
    fireEvent.click(screen.getByRole('button', { name: /copy address/i }))
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })
})
