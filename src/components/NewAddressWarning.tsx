import React from 'react'

type Props = { visible: boolean }

/**
 * SECURITY MECHANISM C — First-send warning.
 */
export function NewAddressWarning({ visible }: Props) {
  if (!visible) return null
  return (
    <div role="alert" className="new-address-warning" style={{
      background: '#fef2f2',
      border: '1px solid var(--red)',
      borderRadius: '8px',
      padding: '0.6rem 0.85rem',
      fontSize: '0.82rem',
      color: '#991b1b',
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'flex-start',
      marginBottom: '0.75rem',
    }}>
      <span style={{ flexShrink: 0, fontSize: '0.95rem' }}>🔴</span>
      <span>
        <strong>First time sending to this address.</strong> You have no transaction history with this recipient. Make absolutely sure the address is correct.
      </span>
    </div>
  )
}
