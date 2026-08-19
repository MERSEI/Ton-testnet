import React from 'react'

type Props = { visible: boolean }

/** SECURITY MECHANISM C — First-send warning. */
export function NewAddressWarning({ visible }: Props) {
  if (!visible) return null
  return (
    <div role="alert" className="alert alert--danger new-address-warning" style={{ marginBottom: '0.75rem' }}>
      <span className="alert__glyph" aria-hidden="true">●</span>
      <span>
        <strong>First time sending to this address.</strong> You have no history with this
        recipient. Make absolutely sure the address is correct.
      </span>
    </div>
  )
}
