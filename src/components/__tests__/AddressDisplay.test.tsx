import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { AddressDisplay } from '../AddressDisplay'

// 48-char valid address
const ADDR = 'UQBvWWFP2pnpMNaHO6YeW7VKz-D_0uj9E3k9d2QT3k9dABCd'

describe('AddressDisplay — SECURITY MECHANISM A', () => {
  it('renders shortened address by default', () => {
    render(<AddressDisplay address={ADDR} />)
    // prefix: first 6 chars, suffix: last 4 chars
    expect(screen.getByText('UQBvWW')).toBeInTheDocument()
    expect(screen.getByText('ABCd')).toBeInTheDocument()
  })

  it('renders full address when full=true', () => {
    render(<AddressDisplay address={ADDR} full />)
    expect(screen.getByText('UQBvWW')).toBeInTheDocument()
    expect(screen.getByText('ABCd')).toBeInTheDocument()
  })

  it('renders copy button when copyable=true', () => {
    render(<AddressDisplay address={ADDR} copyable />)
    expect(screen.getByRole('button', { name: /copy address/i })).toBeInTheDocument()
  })

  it('does not render copy button by default', () => {
    render(<AddressDisplay address={ADDR} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('highlighted spans have bold font weight', () => {
    const { container } = render(<AddressDisplay address={ADDR} />)
    const highlights = container.querySelectorAll('.address-highlight')
    expect(highlights.length).toBe(2)
    highlights.forEach(el => {
      expect((el as HTMLElement).style.fontWeight).toBe('700')
    })
  })
})
