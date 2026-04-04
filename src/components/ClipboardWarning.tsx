import React from 'react'

type Props = { visible: boolean }

/**
 * SECURITY MECHANISM B — Clipboard paste warning.
 * Non-dismissable: disappears only on manual edit of the address field.
 */
export function ClipboardWarning({ visible }: Props) {
  if (!visible) return null
  return (
    <div role="alert" className="clipboard-warning" style={{
      background: '#fffbeb',
      border: '1px solid var(--orange)',
      borderRadius: '8px',
      padding: '0.6rem 0.85rem',
      fontSize: '0.82rem',
      color: '#92400e',
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'flex-start',
      marginTop: '0.5rem',
    }}>
      <span style={{ flexShrink: 0, fontSize: '0.95rem' }}>⚠️</span>
      <span>
        <strong>Address pasted from clipboard.</strong> Verify every character — clipboard malware can silently replace addresses. This warning disappears only after you edit the field manually.
      </span>
    </div>
  )
}
