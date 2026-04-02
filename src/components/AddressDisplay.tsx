/**
 * AddressDisplay — renders a TON address with security highlighting.
 *
 * SECURITY MECHANISM A – Visual prefix/suffix highlighting:
 * The first 6 and last 4 characters are rendered bold+coloured (blue).
 * This is done everywhere we show an address so users learn to always
 * check those "corner" characters when verifying a destination.
 */

import React, { useState } from 'react'
import { splitAddressForHighlight, shortenAddress } from '../utils/address'
import { copyToClipboard } from '../utils/clipboard'

type Props = {
  address: string
  /** Show full address or truncated (default: truncated) */
  full?: boolean
  /** Show copy button */
  copyable?: boolean
  className?: string
}

export function AddressDisplay({ address, full = false, copyable = false, className }: Props) {
  const [copied, setCopied] = useState(false)

  const display = full ? address : shortenAddress(address)
  const [prefix, middle, suffix] = splitAddressForHighlight(display, full ? 6 : 6, full ? 4 : 4)

  const handleCopy = async () => {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <span className={`address-display ${className ?? ''}`} style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
      <span className="address-highlight" style={{ fontWeight: 700, color: 'var(--color-primary, #0088cc)' }}>
        {prefix}
      </span>
      <span>{middle}</span>
      <span className="address-highlight" style={{ fontWeight: 700, color: 'var(--color-primary, #0088cc)' }}>
        {suffix}
      </span>
      {copyable && (
        <button
          onClick={handleCopy}
          style={{
            marginLeft: '0.5rem',
            padding: '0.1rem 0.4rem',
            fontSize: '0.75rem',
            cursor: 'pointer',
            border: '1px solid currentColor',
            borderRadius: '4px',
            background: 'transparent',
          }}
          aria-label="Copy address"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      )}
    </span>
  )
}
