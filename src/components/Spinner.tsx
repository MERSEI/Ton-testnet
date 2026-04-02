import React from 'react'

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `3px solid var(--color-border, #ddd)`,
        borderTopColor: 'var(--color-primary, #0088cc)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}
