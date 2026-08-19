import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { Modal } from '../Modal'

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <Modal open title="Confirm" onClose={onClose} {...props}>
      <button>first</button>
      <button>second</button>
    </Modal>,
  )
  return { ...utils, onClose }
}

describe('Modal — rendering', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Confirm">
        <button>first</button>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes itself as a labelled modal dialog', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)!.textContent).toBe('Confirm')
  })
})

describe('Modal — dismissal', () => {
  it('closes on Escape', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on a backdrop click', () => {
    const { onClose, container } = renderModal()
    fireEvent.click(container.firstChild as Element)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when the panel itself is clicked', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('tolerates being open without an onClose handler', () => {
    render(
      <Modal open title="Confirm">
        <button>first</button>
      </Modal>,
    )
    expect(() => fireEvent.keyDown(window, { key: 'Escape' })).not.toThrow()
  })
})

describe('Modal — focus management', () => {
  it('moves focus into the dialog on open', () => {
    renderModal()
    expect(document.activeElement).toBe(screen.getByText('first'))
  })

  it('wraps focus forward from the last element', () => {
    // This dialog confirms an irreversible transfer: tabbing out to the form
    // behind it would let a keyboard user approve something they cannot see.
    renderModal()
    screen.getByText('second').focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByText('first'))
  })

  it('wraps focus backward from the first element', () => {
    renderModal()
    screen.getByText('first').focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByText('second'))
  })

  it('restores focus to the trigger on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = renderModal()
    expect(document.activeElement).not.toBe(trigger)

    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})

describe('Modal — scroll lock', () => {
  it('locks background scrolling while open and restores it after', () => {
    const { unmount } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
