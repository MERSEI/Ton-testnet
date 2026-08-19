/**
 * AddressDisplay — an inline address with security highlighting.
 *
 * SECURITY MECHANISM A – Visual prefix/suffix highlighting:
 * The first 6 and last 4 characters are rendered bold and tinted, everywhere an
 * address appears, so users learn to always check those "corner" characters when
 * verifying a destination.
 *
 * For the full-width, grouped presentation used where the address *is* the
 * subject of the screen, see AddressPlate.
 */

import React, { useState } from 'react'
import { splitAddressForHighlight, shortenAddress } from '../utils/address'
import { copyToClipboard } from '../utils/clipboard'

type Props = {
  address: string
  /** Show the full address rather than a truncated one */
  full?: boolean
  /** Show a copy button */
  copyable?: boolean
  /**
   * Colour of the highlighted corners.
   * 'onSurface' (default) uses the accent against the dark UI; 'onAccent' uses
   * dark ink for the light QR plate, where the accent would be unreadable.
   * The highlight is the whole point of Mechanism A, so it must never blend in.
   */
  tone?: 'onSurface' | 'onAccent'
  className?: string
}

export function AddressDisplay({
  address,
  full = false,
  copyable = false,
  tone = 'onSurface',
  className,
}: Props) {
  const [copied, setCopied] = useState(false)

  const display = full ? address : shortenAddress(address)
  const [prefix, middle, suffix] = splitAddressForHighlight(display, 6, 4)

  const highlightStyle: React.CSSProperties = {
    color: tone === 'onAccent' ? 'var(--ink-900, #09090A)' : 'var(--acid, #D4FF4F)',
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <span className={`address-display ${className ?? ''}`}>
      <span className="address-highlight" style={highlightStyle}>{prefix}</span>
      <span>{middle}</span>
      <span className="address-highlight" style={highlightStyle}>{suffix}</span>
      {copyable && (
        <button
          type="button"
          className="btn btn--small"
          onClick={handleCopy}
          style={{ marginLeft: '0.5rem' }}
          aria-label="Copy address"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      )}
    </span>
  )
}
