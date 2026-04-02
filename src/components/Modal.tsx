import React, { useEffect } from 'react'

type Props = {
  open: boolean
  onClose?: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <div
        className="modal-box"
        style={{
          background: 'var(--color-surface, #fff)',
          borderRadius: '12px',
          padding: '1.5rem',
          minWidth: '320px',
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
