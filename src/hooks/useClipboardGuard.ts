/**
 * SECURITY MECHANISM B – Clipboard guard hook.
 *
 * Tracks whether the current value of an address input was arrived at
 * via a paste event.  If so, `isPasted` is true and the UI should show
 * a prominent warning banner.
 *
 * The flag clears as soon as the user manually edits the field (keydown
 * with a character key), indicating deliberate intent.
 */

import { useState, useCallback } from 'react'

export function useClipboardGuard() {
  const [isPasted, setIsPasted] = useState(false)

  /** Call this on the input's onPaste event */
  const onPaste = useCallback(() => {
    setIsPasted(true)
  }, [])

  /**
   * Call this on the input's onChange event.
   * Pass `isUserTyping=true` when the change comes from a keyboard event
   * (detected via onKeyDown in the component).
   */
  const onManualEdit = useCallback(() => {
    setIsPasted(false)
  }, [])

  const reset = useCallback(() => setIsPasted(false), [])

  return { isPasted, onPaste, onManualEdit, reset }
}
