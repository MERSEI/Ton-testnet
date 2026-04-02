/**
 * Clipboard detection utilities.
 *
 * SECURITY MECHANISM B – Clipboard warning:
 * Clipboard hijacking malware silently replaces a copied crypto address with
 * the attacker's address.  We detect paste events on the recipient field and
 * show a persistent yellow banner asking the user to verify the full address.
 * The banner disappears only when the user manually edits the field (meaning
 * they deliberately typed/corrected the address).
 *
 * Limitation: we can't detect programmatic clipboard reads, only the paste
 * DOM event.  This covers the most common user flow (Ctrl+V / right-click paste).
 */

export type ClipboardSource = 'typed' | 'pasted'

/**
 * A simple hook helper – given a ref to an input element, this returns
 * whether the current value was arrived at via paste.
 * Actual React hook is in hooks/useClipboardGuard.ts.
 */
export function pasteEventOccurred(e: React.ClipboardEvent): boolean {
  return e.type === 'paste'
}

/** Copy text to clipboard, returns true on success */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }
}
