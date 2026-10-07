import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  addCompanyToCampaign,
  addContactToCampaign,
  addTargetIndustryCompanies,
  listCampaignMembers,
  removeCampaignMember,
  setCampaignMemberStatus,
} from './campaign-members'
import { computeCampaignStats, computeOutcomeBreakdown, getCampaign } from './campaigns'
import {
  createIsolatedTestUsers,
  createTestUser,
  createTestUserContext,
  deleteTestUser,
  getAdminClientForTests,
  type TestUser,
} from '@/__tests__/utils/rls-helpers'
import {
  cleanupTestDataByOwner,
  createTestCampaign,
  createTestCompany,
  createTestContact,
  createTestContactCompany,
} from '@/__tests__/utils/seed-helpers'
import type { ServiceContext } from './base'

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

describe('campaign members', () => {
  it('adds a company once — re-adding is idempotent', async () => {
    const campaign = await createTestCampaign(editor.id)
    const company = await createTestCompany(editor.id)

    const first = await addCompanyToCampaign(campaign.id, company.id, editorCtx)
    const second = await addCompanyToCampaign(campaign.id, company.id, editorCtx)
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(second.data.id).toBe(first.data.id)

    const members = await listCampaignMembers(campaign.id, editorCtx)
    expect(members.data).toHaveLength(1)
    expect(members.data[0]).toMatchObject({ kind: 'company', status: 'Targeted' })
  })

  it('a person defaults to being reached through their primary company', async () => {
    const campaign = await createTestCampaign(editor.id)
    const company = await createTestCompany(editor.id, { name: 'Primary Home Co' })
    const contact = await createTestContact(editor.id, { first_name: 'Pat', last_name: 'Lee' })
    await createTestContactCompany(contact.id, company.id, editor.id)

    const added = await addContactToCampaign(campaign.id, contact.id, editorCtx)
    expect(added.success).toBe(true)

    const [member] = (await listCampaignMembers(campaign.id, editorCtx)).data
    expect(member).toMatchObject({
      kind: 'contact',
      name: 'Pat Lee',
      company_id: company.id,
      company_name: 'Primary Home Co',
    })
  })

  it('a removed member can be re-added and starts over as Targeted', async () => {
    const campaign = await createTestCampaign(editor.id)
    const company = await createTestCompany(editor.id)

    const added = await addCompanyToCampaign(campaign.id, company.id, editorCtx)
    if (!added.success) throw new Error(added.error)
    await setCampaignMemberStatus(added.data.id, 'Converted', editorCtx)
    expect((await removeCampaignMember(added.data.id, editorCtx)).success).toBe(true)
    expect((await listCampaignMembers(campaign.id, editorCtx)).data).toHaveLength(0)

    const readded = await addCompanyToCampaign(campaign.id, company.id, editorCtx)
    expect(readded.success).toBe(true)
    const members = (await listCampaignMembers(campaign.id, editorCtx)).data
    expect(members).toHaveLength(1)
    expect(members[0].status).toBe('Targeted')
  })

  it('stats are cumulative over the funnel', async () => {
    const campaign = await createTestCampaign(editor.id)
    const statuses = ['Targeted', 'Sent', 'Bounced', 'Opened', 'Responded', 'Converted'] as const
    for (const status of statuses) {
      const company = await createTestCompany(editor.id)
      const added = await addCompanyToCampaign(campaign.id, company.id, editorCtx)
      if (!added.success) throw new Error(added.error)
      await setCampaignMemberStatus(added.data.id, status, editorCtx)
    }

    const view = (await getCampaign(campaign.id, editorCtx))!
    const stats = computeCampaignStats(view)
    expect(stats).toMatchObject({
      members: 6,
      sent: 5, // everyone but Targeted
      delivered: 4, // minus the bounce
      opened: 3, // Opened + Responded + Converted
      responded: 2,
      converted: 1,
    })
    expect(stats.openRate).toBeCloseTo(3 / 4)
    expect(stats.successRate).toBeCloseTo(1 / 5)

    // The chart's breakdown counts each member once, at their furthest stage.
    expect(computeOutcomeBreakdown(view)).toEqual({
      converted: 1,
      responded: 1,
      opened: 1,
      sent: 1,
      bounced: 1,
      notSent: 1,
    })
  })

  it('adds every company in the target industries, skipping existing members', async () => {
    // Industries are a fixed list (CHECK in 0006), so seeded companies may
    // share this one — count the live matches instead of assuming none.
    const industry = 'Tattoo Studio'
    const campaign = await createTestCampaign(editor.id, { target_industries: [industry] })

    const a = await createTestCompany(editor.id, { industry })
    await createTestCompany(editor.id, { industry })
    // Company industry is free text: a lower-cased entry is still a match.
    await createTestCompany(editor.id, { industry: 'tattoo studio' })
    await createTestCompany(editor.id, { industry: 'Salon' })
    await addCompanyToCampaign(campaign.id, a.id, editorCtx)

    const { count: matching } = await getAdminClientForTests()
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .ilike('industry', industry)
      .is('deleted_at', null)

    const result = await addTargetIndustryCompanies(campaign.id, editorCtx)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.added).toBe((matching ?? 0) - 1)
    const members = (await listCampaignMembers(campaign.id, editorCtx)).data
    expect(members).toHaveLength(matching ?? 0)
    expect(members.every((m) => m.company_industry?.toLowerCase() === 'tattoo studio')).toBe(true)
  })

  it('a viewer cannot add members', async () => {
    const campaign = await createTestCampaign(editor.id)
    const company = await createTestCompany(editor.id)
    const result = await addCompanyToCampaign(campaign.id, company.id, viewerCtx)
    expect(result.success).toBe(false)
  })
})

// 0006: the campaign owner manages members other people added to their campaign
// (the reference shape alone only allows the member row's owner or an admin).
describe('campaign owner access to members', () => {
  async function memberAddedByAdmin(campaignId: string) {
    const company = await createTestCompany(admin.id)
    const { data, error } = await getAdminClientForTests()
      .from('campaign_members')
      .insert({ campaign_id: campaignId, company_id: company.id, owner_id: admin.id })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  it("the campaign's owner can record outcomes on a member an admin added", async () => {
    const campaign = await createTestCampaign(editor.id)
    const memberId = await memberAddedByAdmin(campaign.id)

    const result = await setCampaignMemberStatus(memberId, 'Converted', editorCtx)
    expect(result.success).toBe(true)
    expect((await removeCampaignMember(memberId, editorCtx)).success).toBe(true)
    await getAdminClientForTests().from('campaign_members').delete().eq('id', memberId)
  })

  it("another editor still cannot change members of a campaign they don't own", async () => {
    const other = await createTestUser('Editor')
    try {
      const otherCtx = await createTestUserContext(other)
      const campaign = await createTestCampaign(editor.id)
      const memberId = await memberAddedByAdmin(campaign.id)

      expect((await setCampaignMemberStatus(memberId, 'Converted', otherCtx)).success).toBe(false)
      expect((await removeCampaignMember(memberId, otherCtx)).success).toBe(false)
      await getAdminClientForTests().from('campaign_members').delete().eq('id', memberId)
    } finally {
      await deleteTestUser(other.authId, other.id)
    }
  })
})
