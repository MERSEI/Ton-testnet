/**
 * Clipboard helpers.
 *
 * SECURITY MECHANISM B – Clipboard warning:
 * Clipboard hijacking malware silently replaces a copied crypto address with the
 * attacker's. We detect paste events on the recipient field and show a persistent
 * banner asking the user to verify the full address. The banner disappears only
 * when the user manually edits the field.
 *
 * Limitation: only the paste DOM event is observable, not programmatic clipboard
 * reads. That still covers the common Ctrl+V / right-click paste flow.
 */

/** Copy text to the clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for insecure origins and older browsers.
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}
