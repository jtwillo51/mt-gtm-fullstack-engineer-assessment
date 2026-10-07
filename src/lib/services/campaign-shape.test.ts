import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Campaign } from './campaigns'
import type { CampaignArtifact } from './campaign-artifacts'
import { listCampaignMembers, type CampaignMemberRow } from './campaign-members'
import { listCampaignArtifacts } from './campaign-artifacts'
import {
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
} from '@/__tests__/utils/seed-helpers'
import type { ServiceContext } from './base'
import type { Company } from './companies'
import type { Contact } from './contacts'
import type { Database, Tables } from '@/types/database.generated'

// Compile-time drift check: each hand-written row interface must have exactly
// the columns of the generated view type (`npm run db:types`). A column added
// to SQL but not to the interface (or vice versa) fails `tsc`, before any test
// runs. The runtime checks below then pin the actual column lists.
type SameKeys<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [never, never]
  ? true
  : { onlyInInterface: Exclude<keyof A, keyof B>; onlyInDb: Exclude<keyof B, keyof A> }
const campaignMatchesView: SameKeys<Campaign, Tables<'v_campaigns'>> = true
const companyMatchesView: SameKeys<Company, Tables<'v_companies'>> = true
const contactMatchesView: SameKeys<Contact, Tables<'v_contacts'>> = true
void [campaignMatchesView, companyMatchesView, contactMatchesView]

type Relation = keyof Database['public']['Tables'] | keyof Database['public']['Views']

/**
 * Locks the DATA SHAPE of the campaigns feature:
 *  1. the exact columns each view/table returns (typed against the TS
 *     interfaces, so a column added to SQL but not to the type — or vice
 *     versa — fails here), and
 *  2. the DB constraints that back every input, independent of Zod.
 */

let editor: TestUser
let editorCtx: ServiceContext
const admin = () => getAdminClientForTests()

beforeAll(async () => {
  editor = await createTestUser('Editor')
  editorCtx = await createTestUserContext(editor)
})

afterEach(async () => {
  await cleanupTestDataByOwner(editor.id)
})

afterAll(async () => {
  await deleteTestUser(editor.authId, editor.id)
})

const AUDIT = [
  'owner_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
] as const

const sorted = (keys: readonly string[]) => [...keys].sort()

async function columnsOf(table: Relation, id: string) {
  // .from() is overloaded per relation kind and won't take a union; the
  // parameter type above is what keeps `table` honest.
  const { data, error } = await admin()
    .from(table as 'campaigns')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return sorted(Object.keys(data))
}

describe('column shape', () => {
  it('v_campaigns = campaign columns + audit names + funnel counts', async () => {
    const c = await createTestCampaign(editor.id)
    const expected = [
      'id',
      'name',
      'type',
      'status',
      'audience',
      'occasion',
      'purpose',
      'target_industries',
      'start_date',
      'end_date',
      ...AUDIT,
      'owner_name',
      'created_by_name',
      'updated_by_name',
      'member_count',
      'sent_count',
      'bounced_count',
      'opened_count',
      'responded_count',
      'converted_count',
    ] satisfies (keyof Campaign)[]
    expect(await columnsOf('v_campaigns', c.id)).toEqual(sorted(expected))
  })

  it('v_campaigns counts are numbers and target_industries is an array', async () => {
    const c = await createTestCampaign(editor.id, { target_industries: ['Spa'] })
    const { data } = await admin().from('v_campaigns').select('*').eq('id', c.id).single()
    for (const k of ['member_count', 'sent_count', 'converted_count'] as const) {
      expect(typeof data![k], k).toBe('number')
    }
    expect(data!.target_industries).toEqual(['Spa'])
    expect(data!.status).toBe('Draft')
  })

  it('campaign_members columns', async () => {
    const c = await createTestCampaign(editor.id)
    const co = await createTestCompany(editor.id)
    const { data } = await admin()
      .from('campaign_members')
      .insert({ campaign_id: c.id, company_id: co.id, owner_id: editor.id })
      .select('id')
      .single()
    expect(await columnsOf('campaign_members', data!.id)).toEqual(
      sorted(['id', 'campaign_id', 'company_id', 'contact_id', 'status', ...AUDIT])
    )
  })

  it('v_campaign_members adds company + contact display columns', async () => {
    const c = await createTestCampaign(editor.id)
    const co = await createTestCompany(editor.id)
    const { data } = await admin()
      .from('campaign_members')
      .insert({ campaign_id: c.id, company_id: co.id, owner_id: editor.id })
      .select('id')
      .single()
    expect(await columnsOf('v_campaign_members', data!.id)).toEqual(
      sorted([
        'id',
        'campaign_id',
        'company_id',
        'contact_id',
        'status',
        ...AUDIT,
        'company_name',
        'company_industry',
        'contact_first_name',
        'contact_last_name',
        'contact_email',
        'contact_title',
      ])
    )
  })

  it('campaign_artifacts columns', async () => {
    const c = await createTestCampaign(editor.id)
    const { data } = await admin()
      .from('campaign_artifacts')
      .insert({
        campaign_id: c.id,
        kind: 'link',
        title: 'x',
        url: 'https://x.example',
        owner_id: editor.id,
      })
      .select('id')
      .single()
    expect(await columnsOf('campaign_artifacts', data!.id)).toEqual(
      sorted([
        'id',
        'campaign_id',
        'kind',
        'title',
        'url',
        'storage_path',
        'mime_type',
        'size_bytes',
        ...AUDIT,
      ])
    )
  })
})

describe('service row shape', () => {
  it('listCampaignMembers returns exactly the CampaignMemberRow fields', async () => {
    const c = await createTestCampaign(editor.id)
    const contact = await createTestContact(editor.id, { first_name: 'Ana', last_name: 'Ruiz' })
    await admin()
      .from('campaign_members')
      .insert({ campaign_id: c.id, contact_id: contact.id, owner_id: editor.id })

    const [row] = (await listCampaignMembers(c.id, editorCtx)).data
    const expected = [
      'id',
      'kind',
      'company_id',
      'contact_id',
      'name',
      'company_name',
      'company_industry',
      'email',
      'title',
      'status',
    ] satisfies (keyof CampaignMemberRow)[]
    expect(sorted(Object.keys(row))).toEqual(sorted(expected))
    expect(row).toMatchObject({ kind: 'contact', name: 'Ana Ruiz', status: 'Targeted' })
  })

  it('listCampaignArtifacts returns exactly the CampaignArtifact fields', async () => {
    const c = await createTestCampaign(editor.id)
    await admin().from('campaign_artifacts').insert({
      campaign_id: c.id,
      kind: 'link',
      title: 'Flyer',
      url: 'https://x.example/flyer.jpg',
      owner_id: editor.id,
    })
    const [artifact] = await listCampaignArtifacts(c.id, editorCtx)
    const expected = [
      'id',
      'campaign_id',
      'kind',
      'title',
      'url',
      'storage_path',
      'mime_type',
      'size_bytes',
      'created_at',
      'href',
      'isImage',
    ] satisfies (keyof CampaignArtifact)[]
    expect(sorted(Object.keys(artifact))).toEqual(sorted(expected))
  })
})

describe('DB constraints back every input', () => {
  async function insertCampaign(overrides: Record<string, unknown>) {
    return admin()
      .from('campaigns')
      .insert({
        name: 'Constraint test',
        type: 'Email',
        audience: 'External',
        owner_id: editor.id,
        ...overrides,
      })
      .select('id')
  }

  it.each([
    ['an unknown type', { type: 'Pigeon' }],
    ['an unknown status', { status: 'Paused' }],
    ['an unknown audience', { audience: 'Both' }],
    ['a missing name', { name: null }],
    ['an end date before the start', { start_date: '2026-07-10', end_date: '2026-07-01' }],
  ])('campaigns rejects %s', async (_label, overrides) => {
    const { error } = await insertCampaign(overrides)
    expect(error).not.toBeNull()
  })

  it('campaigns accepts a valid row and defaults status + industries', async () => {
    const { data, error } = await admin()
      .from('campaigns')
      .insert({ name: 'OK', type: 'SMS', audience: 'Internal', owner_id: editor.id })
      .select('status, target_industries')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({ status: 'Draft', target_industries: [] })
  })

  it('campaign_members rejects an unknown outcome and a member with no target', async () => {
    const c = await createTestCampaign(editor.id)
    const co = await createTestCompany(editor.id)
    const badStatus = await admin()
      .from('campaign_members')
      .insert({ campaign_id: c.id, company_id: co.id, status: 'Clicked', owner_id: editor.id })
    expect(badStatus.error).not.toBeNull()

    const noTarget = await admin()
      .from('campaign_members')
      .insert({ campaign_id: c.id, owner_id: editor.id })
    expect(noTarget.error).not.toBeNull()
  })

  it('campaign_members allows one live membership per company/person', async () => {
    const c = await createTestCampaign(editor.id)
    const co = await createTestCompany(editor.id)
    const row = { campaign_id: c.id, company_id: co.id, owner_id: editor.id }
    expect((await admin().from('campaign_members').insert(row)).error).toBeNull()
    expect((await admin().from('campaign_members').insert(row)).error).not.toBeNull()
  })

  it.each([
    ['a file with no storage path', { kind: 'file' }],
    ['a link with no url', { kind: 'link' }],
    ['a link that also has a storage path', { kind: 'link', url: 'https://x', storage_path: 'p' }],
    ['an unknown kind', { kind: 'video', url: 'https://x' }],
  ])('campaign_artifacts rejects %s', async (_label, overrides) => {
    const c = await createTestCampaign(editor.id)
    const { error } = await admin()
      .from('campaign_artifacts')
      .insert({ campaign_id: c.id, title: 'x', owner_id: editor.id, ...overrides })
    expect(error).not.toBeNull()
  })
})
