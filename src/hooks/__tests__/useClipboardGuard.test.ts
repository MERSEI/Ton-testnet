import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboardGuard } from '../useClipboardGuard'

/**
 * Tests for SECURITY MECHANISM B — clipboard paste detection.
 */
describe('useClipboardGuard', () => {
  it('starts with isPasted=false', () => {
    const { result } = renderHook(() => useClipboardGuard())
    expect(result.current.isPasted).toBe(false)
  })

  it('sets isPasted=true after onPaste', () => {
    const { result } = renderHook(() => useClipboardGuard())
    act(() => {
      result.current.onPaste()
    })
    expect(result.current.isPasted).toBe(true)
  })

  it('clears isPasted after onManualEdit', () => {
    const { result } = renderHook(() => useClipboardGuard())
    act(() => {
      result.current.onPaste()
    })
    act(() => {
      result.current.onManualEdit()
    })
    expect(result.current.isPasted).toBe(false)
  })

  it('reset() clears isPasted', () => {
    const { result } = renderHook(() => useClipboardGuard())
    act(() => {
      result.current.onPaste()
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.isPasted).toBe(false)
  })

  it('multiple pastes keep isPasted=true', () => {
    const { result } = renderHook(() => useClipboardGuard())
    act(() => {
      result.current.onPaste()
      result.current.onPaste()
    })
    expect(result.current.isPasted).toBe(true)
  })

  it('manual edit after paste clears flag, regardless of subsequent pastes', () => {
    const { result } = renderHook(() => useClipboardGuard())
    act(() => {
      result.current.onPaste()
    })
    act(() => {
      result.current.onManualEdit()
    })
    expect(result.current.isPasted).toBe(false)
    // Paste again
    act(() => {
      result.current.onPaste()
    })
    expect(result.current.isPasted).toBe(true)
  })
})
