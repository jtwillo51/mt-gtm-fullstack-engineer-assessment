import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ConfirmButton } from './confirm-button'

afterEach(() => vi.useRealTimers())

function setup(props: Partial<React.ComponentProps<typeof ConfirmButton>> = {}) {
  const onConfirm = vi.fn()
  render(
    <ConfirmButton onConfirm={onConfirm} label="Remove Lena Patel" {...props}>
      ×
    </ConfirmButton>
  )
  return { onConfirm, button: () => screen.getByRole('button') }
}

describe('ConfirmButton', () => {
  it('does nothing on the first click — it arms instead', () => {
    const { onConfirm, button } = setup()
    expect(button().getAttribute('aria-label')).toBe('Remove Lena Patel')
    fireEvent.click(button())
    expect(onConfirm).not.toHaveBeenCalled()
    expect(button().textContent).toBe('Remove?')
    expect(button().getAttribute('aria-label')).toBe('Remove? Remove Lena Patel')
  })

  it('confirms on the second click and disarms', () => {
    const { onConfirm, button } = setup()
    fireEvent.click(button())
    fireEvent.click(button())
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(button().textContent).toBe('×')
  })

  it.each([
    ['Escape', (b: HTMLElement) => fireEvent.keyDown(b, { key: 'Escape' })],
    ['blur', (b: HTMLElement) => fireEvent.blur(b)],
  ])('disarms on %s', (_name, disarm) => {
    const { onConfirm, button } = setup()
    fireEvent.click(button())
    disarm(button())
    fireEvent.click(button())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disarms after the timeout', () => {
    vi.useFakeTimers()
    const { onConfirm, button } = setup({ timeoutMs: 1000 })
    fireEvent.click(button())
    act(() => vi.advanceTimersByTime(1001))
    expect(button().textContent).toBe('×')
    fireEvent.click(button())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not let the click bubble (e.g. to a clickable row)', () => {
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <ConfirmButton onConfirm={() => {}} label="Remove">
          ×
        </ConfirmButton>
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onRow).not.toHaveBeenCalled()
  })

  it('uses a custom confirm label', () => {
    const { button } = setup({ confirmLabel: 'Delete campaign?' })
    fireEvent.click(button())
    expect(button().textContent).toBe('Delete campaign?')
  })
})
