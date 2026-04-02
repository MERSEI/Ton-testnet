/**
 * SECURITY MECHANISM C – New address warning.
 *
 * Shown as part of the send confirmation modal when the destination address
 * has never been used for a successful outgoing transaction in this browser.
 */

import React from 'react'

type Props = {
  visible: boolean
}

export function NewAddressWarning({ visible }: Props) {
  if (!visible) return null

  return (
    <div
      role="alert"
      className="new-address-warning"
      style={{
        background: '#fef2f2',
        border: '1px solid #f87171',
        borderRadius: '6px',
        padding: '0.6rem 0.9rem',
        fontSize: '0.85rem',
        color: '#991b1b',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        marginBottom: '1rem',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔴</span>
      <span>
        <strong>First time sending to this address.</strong> You have no history with
        this recipient. Make absolutely sure the address is correct before confirming.
      </span>
    </div>
  )
}
