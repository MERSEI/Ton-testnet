/**
 * SECURITY MECHANISM B – Clipboard warning banner.
 *
 * Rendered when the recipient address was pasted from the clipboard.
 * The banner is intentionally non-dismissable via a close button —
 * it disappears only when the user manually edits the address field.
 * This forces the user's attention onto address verification.
 */

import React from 'react'

type Props = {
  visible: boolean
}

export function ClipboardWarning({ visible }: Props) {
  if (!visible) return null

  return (
    <div
      role="alert"
      className="clipboard-warning"
      style={{
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        padding: '0.6rem 0.9rem',
        fontSize: '0.85rem',
        color: '#92400e',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        marginTop: '0.5rem',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
      <span>
        <strong>Address pasted from clipboard.</strong> Carefully verify the <em>full</em> address
        before sending — clipboard hijacking malware can silently replace it.
        This warning disappears only after you manually edit the field.
      </span>
    </div>
  )
}
