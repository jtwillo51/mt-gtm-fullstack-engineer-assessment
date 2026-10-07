import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorState } from './error-state'
import CampaignsError from '@/app/(dashboard)/campaigns/error'
import CampaignNotFound from '@/app/(dashboard)/campaigns/not-found'

describe('ErrorState', () => {
  it('renders the title, message and a way home', () => {
    render(<ErrorState title="Record not found" message="Gone." />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Record not found' })).toBeTruthy()
    expect(screen.getByText('Gone.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Companies' }).getAttribute('href')).toBe(
      '/companies'
    )
  })

  it('renders an optional primary action', () => {
    render(<ErrorState title="t" message="m" action={<button>Retry</button>} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})

describe('campaigns error boundary', () => {
  it('shows a friendly message (not the raw error) and retries on click', () => {
    const reset = vi.fn()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new Error('relation "secret_table" does not exist'), {
      digest: 'abc123',
    })
    render(<CampaignsError error={error} reset={reset} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.queryByText(/secret_table/)).toBeNull()
    expect(screen.getByText(/abc123/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledOnce()
    spy.mockRestore()
  })
})

describe('campaign not-found page', () => {
  it('explains the campaign is missing and links back to the list', () => {
    render(<CampaignNotFound />)
    expect(screen.getByRole('heading', { name: 'Campaign not found' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Campaigns' }).getAttribute('href')).toBe(
      '/campaigns'
    )
  })
})
