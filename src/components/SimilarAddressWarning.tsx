/**
 * SimilarAddressWarning — shown when a NEW address shares a prefix with a
 * KNOWN address.  This is a stronger signal than "first time sending here"
 * because it suggests a deliberate prefix-swap attack.
 */

import React from 'react'
import { shortenAddress } from '../utils/address'
import type { AddressEntry } from '../utils/addressBook'

type Props = {
  similar: AddressEntry | null
}

export function SimilarAddressWarning({ similar }: Props) {
  if (!similar) return null

  return (
    <div
      role="alert"
      className="similar-address-warning"
      style={{
        background: '#fff7ed',
        border: '2px solid #ea580c',
        borderRadius: '6px',
        padding: '0.7rem 0.9rem',
        fontSize: '0.85rem',
        color: '#7c2d12',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        marginTop: '0.5rem',
      }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔶</span>
      <span>
        <strong>Suspicious address match.</strong> This address looks similar to{' '}
        <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>
          {shortenAddress(similar.address, 8, 6)}
        </code>{' '}
        which you have sent to before. Verify every character — this may be a
        prefix-swap attack.
      </span>
    </div>
  )
}
