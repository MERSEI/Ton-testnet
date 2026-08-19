import React from 'react'

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      className="spinner"
      aria-label="Loading"
      role="status"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 12)) }}
    />
  )
}
