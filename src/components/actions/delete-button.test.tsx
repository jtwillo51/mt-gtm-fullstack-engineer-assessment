import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeleteButton } from './delete-button'
import { PermissionProvider } from '@/components/permission-provider'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const actions = vi.hoisted(() => ({ deleteCampaignAction: vi.fn() }))
vi.mock('@/actions/campaigns', () => actions)

function renderAs(canEdit: boolean) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PermissionProvider value={{ role: canEdit ? 'Editor' : 'Viewer', canEdit }}>
        <DeleteButton formType="campaign" recordId="rec-1" redirectTo="/campaigns" />
      </PermissionProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of Object.values(actions)) fn.mockResolvedValue({ success: true, data: undefined })
})

describe('DeleteButton', () => {
  it('is hidden from viewers', () => {
    renderAs(false)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('needs a confirming second click, then deletes and returns to the list', async () => {
    renderAs(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete campaign' }))
    expect(actions.deleteCampaignAction).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Delete campaign\?/ }))
    await waitFor(() => expect(actions.deleteCampaignAction).toHaveBeenCalledWith('rec-1'))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/campaigns'))
    expect(toast.success).toHaveBeenCalledWith('Deleted campaign')
  })

  it('stays on the page and shows the error when RLS refuses', async () => {
    actions.deleteCampaignAction.mockResolvedValue({
      success: false,
      error: 'Permission denied or campaign not found',
    })
    renderAs(true)
    const button = screen.getByRole('button', { name: 'Delete campaign' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Permission denied or campaign not found')
    )
    expect(router.push).not.toHaveBeenCalled()
  })
})
