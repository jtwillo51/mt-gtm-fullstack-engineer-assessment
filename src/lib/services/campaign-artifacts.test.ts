import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  addCampaignFileArtifact,
  addCampaignLinkArtifact,
  listCampaignArtifacts,
  removeCampaignArtifact,
} from './campaign-artifacts'
import {
  createIsolatedTestUsers,
  createTestUserContext,
  deleteTestUser,
  getAdminClientForTests,
  type TestUser,
} from '@/__tests__/utils/rls-helpers'
import { cleanupTestDataByOwner, createTestCampaign } from '@/__tests__/utils/seed-helpers'
import type { ServiceContext } from './base'
import { CAMPAIGN_ARTIFACTS_BUCKET } from '@/lib/config/constants'

let admin: TestUser, editor: TestUser, viewer: TestUser
let editorCtx: ServiceContext, viewerCtx: ServiceContext

beforeAll(async () => {
  const users = await createIsolatedTestUsers()
  admin = users.admin
  editor = users.editor
  viewer = users.viewer
  editorCtx = await createTestUserContext(editor)
  viewerCtx = await createTestUserContext(viewer)
})

afterEach(async () => {
  await Promise.all([
    cleanupTestDataByOwner(admin.id),
    cleanupTestDataByOwner(editor.id),
    cleanupTestDataByOwner(viewer.id),
  ])
})

afterAll(async () => {
  await Promise.all([
    deleteTestUser(admin.authId, admin.id),
    deleteTestUser(editor.authId, editor.id),
    deleteTestUser(viewer.authId, viewer.id),
  ])
})

describe('campaign artifacts', () => {
  it('records a link and lists it with an href', async () => {
    const campaign = await createTestCampaign(editor.id)
    const added = await addCampaignLinkArtifact(
      campaign.id,
      { title: 'Flyer', url: 'https://cdn.example.com/flyer.png' },
      editorCtx
    )
    expect(added.success).toBe(true)

    const [artifact] = await listCampaignArtifacts(campaign.id, editorCtx)
    expect(artifact).toMatchObject({
      kind: 'link',
      title: 'Flyer',
      href: 'https://cdn.example.com/flyer.png',
      isImage: true,
    })

    if (!added.success) return
    expect((await removeCampaignArtifact(added.data.id, editorCtx)).success).toBe(true)
    expect(await listCampaignArtifacts(campaign.id, editorCtx)).toHaveLength(0)
  })

  it("rejects a file path outside the campaign's folder", async () => {
    const campaign = await createTestCampaign(editor.id)
    const result = await addCampaignFileArtifact(
      campaign.id,
      { title: 'Sneaky', storage_path: 'some-other-campaign/file.png' },
      editorCtx
    )
    expect(result.success).toBe(false)
  })

  it('a viewer cannot add artifacts', async () => {
    const campaign = await createTestCampaign(editor.id)
    const result = await addCampaignLinkArtifact(
      campaign.id,
      { title: 'Nope', url: 'https://example.com' },
      viewerCtx
    )
    expect(result.success).toBe(false)
  })
})

describe('campaign artifact file paths', () => {
  it('accepts a file stored under the campaign folder (no Storage object needed for the row)', async () => {
    const campaign = await createTestCampaign(editor.id)
    const result = await addCampaignFileArtifact(
      campaign.id,
      { title: 'Flyer', storage_path: `${campaign.id}/abc-flyer.png`, mime_type: 'image/png' },
      editorCtx
    )
    expect(result.success).toBe(true)
  })

  it('a viewer cannot remove an artifact', async () => {
    const campaign = await createTestCampaign(editor.id)
    const added = await addCampaignLinkArtifact(
      campaign.id,
      { title: 'Keep me', url: 'https://example.com' },
      editorCtx
    )
    if (!added.success) throw new Error(added.error)
    expect((await removeCampaignArtifact(added.data.id, viewerCtx)).success).toBe(false)
    expect(await listCampaignArtifacts(campaign.id, editorCtx)).toHaveLength(1)
  })
})

// 0006: an upload whose artifact row never got saved can be rolled back, but
// an object behind a real artifact row stays put (forward-only).
describe('campaign artifact storage cleanup', () => {
  const uploaded: string[] = []
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })

  async function upload(campaignId: string) {
    const path = `${campaignId}/${crypto.randomUUID()}-test.png`
    const { error } = await editorCtx.client.storage
      .from(CAMPAIGN_ARTIFACTS_BUCKET)
      .upload(path, png, { contentType: 'image/png' })
    if (error) throw error
    uploaded.push(path)
    return path
  }

  async function exists(path: string) {
    const [folder, name] = path.split('/')
    const { data } = await getAdminClientForTests()
      .storage.from(CAMPAIGN_ARTIFACTS_BUCKET)
      .list(folder, { search: name })
    return (data ?? []).some((o) => o.name === name)
  }

  afterAll(async () => {
    if (uploaded.length > 0) {
      await getAdminClientForTests().storage.from(CAMPAIGN_ARTIFACTS_BUCKET).remove(uploaded)
    }
  })

  it('the uploader can delete an orphaned upload (no artifact row)', async () => {
    const campaign = await createTestCampaign(editor.id)
    const path = await upload(campaign.id)
    const { data, error } = await editorCtx.client.storage
      .from(CAMPAIGN_ARTIFACTS_BUCKET)
      .remove([path])
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(await exists(path)).toBe(false)
  })

  it('an object behind an artifact row cannot be deleted', async () => {
    const campaign = await createTestCampaign(editor.id)
    const path = await upload(campaign.id)
    const added = await addCampaignFileArtifact(
      campaign.id,
      { title: 'Keep', storage_path: path, mime_type: 'image/png' },
      editorCtx
    )
    expect(added.success).toBe(true)

    const { data } = await editorCtx.client.storage.from(CAMPAIGN_ARTIFACTS_BUCKET).remove([path])
    expect(data ?? []).toHaveLength(0)
    expect(await exists(path)).toBe(true)
  })

  it('a viewer cannot delete an orphaned upload', async () => {
    const campaign = await createTestCampaign(editor.id)
    const path = await upload(campaign.id)
    const { data } = await viewerCtx.client.storage.from(CAMPAIGN_ARTIFACTS_BUCKET).remove([path])
    expect(data ?? []).toHaveLength(0)
    expect(await exists(path)).toBe(true)
  })
})

describe('campaign owner access to artifacts', () => {
  it("the campaign's owner can remove an artifact an admin added", async () => {
    const campaign = await createTestCampaign(editor.id)
    const { data, error } = await getAdminClientForTests()
      .from('campaign_artifacts')
      .insert({
        campaign_id: campaign.id,
        kind: 'link',
        title: 'Added by admin',
        url: 'https://example.com',
        owner_id: admin.id,
      })
      .select('id')
      .single()
    if (error) throw error

    expect((await removeCampaignArtifact(data.id, editorCtx)).success).toBe(true)
    await getAdminClientForTests().from('campaign_artifacts').delete().eq('id', data.id)
  })
})
