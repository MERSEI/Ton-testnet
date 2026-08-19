import React from 'react'

type Props = { visible: boolean }

/**
 * SECURITY MECHANISM B — Clipboard paste warning.
 * Non-dismissable: it disappears only when the address field is edited by hand.
 */
export function ClipboardWarning({ visible }: Props) {
  if (!visible) return null
  return (
    <div role="alert" className="alert alert--warn clipboard-warning">
      <span className="alert__glyph" aria-hidden="true">◆</span>
      <span>
        <strong>Address pasted from clipboard.</strong> Verify every character — clipboard
        malware silently swaps addresses. This warning clears only after you edit the field
        by hand.
      </span>
    </div>
  )
}
