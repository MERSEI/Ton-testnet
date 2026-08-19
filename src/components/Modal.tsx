import React, { useEffect, useId, useRef } from 'react'

type Props = {
  open: boolean
  onClose?: () => void
  title: string
  children: React.ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'

/**
 * Centred dialog.
 *
 * Focus is trapped and restored, and background scrolling is locked: this is the
 * confirmation step for an irreversible transfer, so a keyboard user must not be
 * able to tab out to the form behind it and lose track of what they are approving.
 */
export function Modal({ open, onClose, title, children }: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreFocusTo.current = document.activeElement as HTMLElement | null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      // The selector already excludes disabled controls and tabindex="-1"; no
      // layout-based visibility filter, since this panel never hides its own
      // controls and offsetParent is meaningless outside a real layout engine.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      } else if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
      restoreFocusTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="scrim"
      onClick={e => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog__head">
          <h2 id={titleId} className="dialog__title">{title}</h2>
          <span className="chip" aria-hidden="true">Testnet</span>
        </div>
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  )
}
