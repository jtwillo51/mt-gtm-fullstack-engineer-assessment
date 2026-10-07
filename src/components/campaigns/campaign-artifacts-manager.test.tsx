import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CampaignArtifactsManager } from './campaign-artifacts-manager'
import { PermissionProvider } from '@/components/permission-provider'
import type { CampaignArtifact } from '@/lib/services/campaign-artifacts'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const upload = vi.hoisted(() => vi.fn())
const remove = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ storage: { from: () => ({ upload, remove }) } }),
}))

const actions = vi.hoisted(() => ({
  addCampaignFileArtifactAction: vi.fn(),
  addCampaignLinkArtifactAction: vi.fn(),
  removeCampaignArtifactAction: vi.fn(),
}))
vi.mock('@/actions/campaigns', () => actions)

const artifacts: CampaignArtifact[] = [
  {
    id: 'a-img',
    campaign_id: 'camp-1',
    kind: 'file',
    title: 'july-email',
    url: null,
    storage_path: 'camp-1/x-july.png',
    mime_type: 'image/png',
    size_bytes: 100,
    created_at: '2026-07-01T00:00:00Z',
    href: 'https://signed.example/july.png',
    isImage: true,
  },
  {
    id: 'a-link',
    campaign_id: 'camp-1',
    kind: 'link',
    title: 'Canva design',
    url: 'https://canva.example/design',
    storage_path: null,
    mime_type: null,
    size_bytes: null,
    created_at: '2026-07-02T00:00:00Z',
    href: 'https://canva.example/design',
    isImage: false,
  },
]

function renderAs(canEdit: boolean, list = artifacts) {
  return render(
    <PermissionProvider value={{ role: canEdit ? 'Editor' : 'Viewer', canEdit }}>
      <CampaignArtifactsManager campaignId="camp-1" artifacts={list} />
    </PermissionProvider>
  )
}

function chooseFile(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of Object.values(actions))
    fn.mockResolvedValue({ success: true, data: { id: 'new' } })
  upload.mockResolvedValue({ error: null })
  remove.mockResolvedValue({ data: [], error: null })
})

describe('artifact gallery', () => {
  it('shows image artifacts as thumbnails and everything as an outbound link', () => {
    renderAs(false)
    const img = screen.getByAltText('july-email') as HTMLImageElement
    expect(img.src).toBe('https://signed.example/july.png')
    const link = screen.getByTitle('Canva design')
    expect(link.getAttribute('href')).toBe('https://canva.example/design')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('hides upload, link and remove controls from viewers', () => {
    renderAs(false)
    expect(screen.queryByRole('button', { name: /Upload/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add link/ })).toBeNull()
    expect(screen.queryByLabelText(/^Remove/)).toBeNull()
  })

  it('shows an empty state', () => {
    renderAs(false, [])
    expect(screen.getByText(/No artifacts yet/)).toBeTruthy()
  })
})

describe('link input', () => {
  it('submits title and url, then refreshes', async () => {
    renderAs(true)
    fireEvent.click(screen.getByRole('button', { name: /Add link/ }))
    fireEvent.change(screen.getByPlaceholderText('Title, e.g. Flyer front'), {
      target: { value: 'Flyer back' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'https://cdn.example.com/back.png' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(actions.addCampaignLinkArtifactAction).toHaveBeenCalledWith('camp-1', {
        title: 'Flyer back',
        url: 'https://cdn.example.com/back.png',
      })
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('surfaces a server validation error', async () => {
    actions.addCampaignLinkArtifactAction.mockResolvedValue({
      success: false,
      error: 'Enter a valid http(s) URL',
    })
    renderAs(true)
    fireEvent.click(screen.getByRole('button', { name: /Add link/ }))
    fireEvent.change(screen.getByPlaceholderText('Title, e.g. Flyer front'), {
      target: { value: 'Bad' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'https://x.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Enter a valid http(s) URL'))
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('file input', () => {
  it('only accepts the bucket’s file types', () => {
    const { container } = renderAs(true)
    expect(container.querySelector('input[type="file"]')!.getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/gif,image/webp,application/pdf'
    )
  })

  it('uploads into the campaign folder and records the artifact', async () => {
    const { container } = renderAs(true)
    chooseFile(container, new File(['png'], 'July 4th email!.png', { type: 'image/png' }))
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    const [path, , opts] = upload.mock.calls[0]
    expect(path).toMatch(/^camp-1\/[0-9a-f-]{36}-July-4th-email-.png$/)
    expect(opts).toEqual({ contentType: 'image/png' })
    await waitFor(() =>
      expect(actions.addCampaignFileArtifactAction).toHaveBeenCalledWith('camp-1', {
        title: 'July 4th email!',
        storage_path: path,
        mime_type: 'image/png',
        size_bytes: 3,
      })
    )
  })

  it('rejects an unsupported file type before uploading', async () => {
    const { container } = renderAs(true)
    chooseFile(container, new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Upload a PNG, JPG, GIF, WebP or PDF')
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a file over 10 MB before uploading', async () => {
    const { container } = renderAs(true)
    const big = new File(['x'], 'huge.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    chooseFile(container, big)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Files must be 10 MB or smaller'))
    expect(upload).not.toHaveBeenCalled()
  })

  it('does not record an artifact when the upload fails', async () => {
    upload.mockResolvedValue({ error: { message: 'Bucket not found' } })
    const { container } = renderAs(true)
    chooseFile(container, new File(['png'], 'a.png', { type: 'image/png' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bucket not found'))
    expect(actions.addCampaignFileArtifactAction).not.toHaveBeenCalled()
  })

  it('rolls back the upload when the artifact row cannot be saved', async () => {
    actions.addCampaignFileArtifactAction.mockResolvedValue({
      success: false,
      error: 'Permission denied',
    })
    const { container } = renderAs(true)
    chooseFile(container, new File(['png'], 'a.png', { type: 'image/png' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Permission denied'))
    const [path] = upload.mock.calls[0]
    expect(remove).toHaveBeenCalledWith([path])
    expect(refresh).not.toHaveBeenCalled()
  })

  it('rolls back the upload when the save action throws', async () => {
    actions.addCampaignFileArtifactAction.mockRejectedValue(new Error('network'))
    const { container } = renderAs(true)
    chooseFile(container, new File(['png'], 'a.png', { type: 'image/png' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save file'))
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('keeps the upload when the artifact row is saved', async () => {
    const { container } = renderAs(true)
    chooseFile(container, new File(['png'], 'a.png', { type: 'image/png' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(remove).not.toHaveBeenCalled()
  })
})

describe('remove', () => {
  it('removes an artifact only after a second, confirming click', async () => {
    renderAs(true)
    fireEvent.click(screen.getByLabelText('Remove Canva design'))
    expect(actions.removeCampaignArtifactAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Remove? Remove Canva design'))
    await waitFor(() => expect(actions.removeCampaignArtifactAction).toHaveBeenCalledWith('a-link'))
  })

  it('keeps the remove control visible on touch screens (no hover)', () => {
    renderAs(true)
    expect(screen.getByLabelText('Remove Canva design').className).toContain(
      'pointer-coarse:opacity-100'
    )
  })
})
