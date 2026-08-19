import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { AddressPlate } from '../AddressPlate'
import { WALLET } from '../../tests/fixtures'

const ADDR = WALLET.nonBounceableTest

describe('AddressPlate — grouping', () => {
  it('splits 48 characters into 12 groups of four', () => {
    const { container } = render(<AddressPlate address={ADDR} />)
    const groups = container.querySelectorAll('.plate__group')
    expect(groups).toHaveLength(12)
    groups.forEach(g => expect(g.textContent).toHaveLength(4))
  })

  it('preserves the address exactly, in order', () => {
    // Grouping must never alter the string a user is verifying.
    const { container } = render(<AddressPlate address={ADDR} />)
    expect(container.querySelector('.plate')!.textContent).toBe(ADDR)
  })

  it('honours a custom group size', () => {
    const { container } = render(<AddressPlate address={ADDR} group={6} />)
    expect(container.querySelectorAll('.plate__group')).toHaveLength(8)
  })

  it('leaves a short final group rather than padding it', () => {
    const { container } = render(<AddressPlate address={'A'.repeat(10)} group={4} />)
    const groups = container.querySelectorAll('.plate__group')
    expect(groups).toHaveLength(3)
    expect(groups[2].textContent).toBe('AA')
  })

  it('handles an empty address without crashing', () => {
    const { container } = render(<AddressPlate address="" />)
    expect(container.querySelectorAll('.plate__group')).toHaveLength(0)
  })
})

describe('AddressPlate — SECURITY MECHANISM A', () => {
  it('marks the first 6 and last 4 characters', () => {
    const { container } = render(<AddressPlate address={ADDR} />)
    const marked = Array.from(container.querySelectorAll('.plate__mark'))
      .map(el => el.textContent)
      .join('')
    expect(marked).toBe(ADDR.slice(0, 6) + ADDR.slice(-4))
  })

  it('marks across a group boundary when the prefix does not align', () => {
    // A 6-character prefix spans one full group plus half of the next; the marking
    // must follow the characters, not the groups.
    const { container } = render(<AddressPlate address={ADDR} />)
    const groups = container.querySelectorAll('.plate__group')
    expect(groups[0].querySelector('.plate__mark')!.textContent).toBe(ADDR.slice(0, 4))
    expect(groups[1].querySelector('.plate__mark')!.textContent).toBe(ADDR.slice(4, 6))
  })

  it('does not mark the middle', () => {
    const { container } = render(<AddressPlate address={ADDR} />)
    const marked = Array.from(container.querySelectorAll('.plate__mark'))
      .map(el => el.textContent)
      .join('')
    expect(marked).not.toContain(ADDR.slice(10, 20))
  })

  it('respects custom corner lengths', () => {
    const { container } = render(<AddressPlate address={ADDR} prefixLen={8} suffixLen={8} />)
    const marked = Array.from(container.querySelectorAll('.plate__mark'))
      .map(el => el.textContent)
      .join('')
    expect(marked).toBe(ADDR.slice(0, 8) + ADDR.slice(-8))
  })
})

describe('AddressPlate — accessibility and tone', () => {
  it('exposes the unbroken address to assistive tech', () => {
    // The visual grouping is decoration; the accessible name must stay copyable.
    const { container } = render(<AddressPlate address={ADDR} />)
    const plate = container.querySelector('.plate')!
    expect(plate).toHaveAttribute('aria-label', ADDR)
    expect(plate.querySelectorAll('[aria-hidden="true"]')).toHaveLength(12)
  })

  it('switches to dark type for a light plate', () => {
    const { container } = render(<AddressPlate address={ADDR} tone="ink" />)
    expect(container.querySelector('.plate')!.className).toContain('plate--ink')
  })

  it('supports a compact size', () => {
    const { container } = render(<AddressPlate address={ADDR} size="sm" />)
    expect(container.querySelector('.plate')!.className).toContain('plate--sm')
  })
})
