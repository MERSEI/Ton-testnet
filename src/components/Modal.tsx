import React, { useEffect } from 'react'

type Props = {
  open: boolean
  onClose?: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1000, padding: '0 0 env(safe-area-inset-bottom, 0)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: '16px 16px 0 0',
          padding: '1.25rem 1.25rem 1.5rem',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92svh',
          overflowY: 'auto',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
          animation: 'scaleIn 0.2s ease',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, background: 'var(--divider)', borderRadius: 4, margin: '0 auto 1rem' }} />
        <h2 id="modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
