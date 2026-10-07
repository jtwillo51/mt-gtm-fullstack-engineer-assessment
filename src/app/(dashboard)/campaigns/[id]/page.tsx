import { notFound } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { requireAuth, canEdit } from '@/lib/auth'
import { getCampaign, computeCampaignStats, canManageCampaign } from '@/lib/services/campaigns'
import { listCampaignMembers } from '@/lib/services/campaign-members'
import { listCampaignArtifacts } from '@/lib/services/campaign-artifacts'
import { campaignFields, campaignSections } from '@/lib/config/models/campaign-config'
import { badgeVariantForStatus } from '@/lib/config/render-helpers'
import { formatDateOnly } from '@/lib/utils'
import { DetailView } from '@/components/page/detail-view'
import { PageHeader } from '@/components/page/page-header'
import { EditButton } from '@/components/actions/edit-button'
import { DeleteButton } from '@/components/actions/delete-button'
import { Badge } from '@/components/ui/badge'
import { PermissionProvider } from '@/components/permission-provider'
import { CampaignStats } from '@/components/campaigns/campaign-stats'
import { CampaignArtifactsManager } from '@/components/campaigns/campaign-artifacts-manager'
import { CampaignMembersManager } from '@/components/campaigns/campaign-members-manager'

/** Sections rendered from config, in page order (custom panels sit between). */
const section = (id: string) => campaignSections.filter((s) => s.id === id)

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, campaign] = await Promise.all([requireAuth(), getCampaign(id)])
  if (!campaign) notFound()
  // Narrow the layout's role-level canEdit to this campaign (owner or admin), so
  // an editor isn't shown controls that RLS would refuse.
  const canManage = canManageCampaign(user, campaign)

  const [members, artifacts] = await Promise.all([
    listCampaignMembers(id),
    listCampaignArtifacts(id),
  ])

  const dates = [campaign.start_date, campaign.end_date]
    .map((d) => (d ? formatDateOnly(d) : null))
    .filter(Boolean)
    .join(' – ')

  return (
    <PermissionProvider value={{ role: user.role, canEdit: canManage }}>
      <div>
        <PageHeader
          title={campaign.name}
          glyph={
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
              <Megaphone className="h-6 w-6" />
            </span>
          }
          subtitle={
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={badgeVariantForStatus(campaign.status)}>{campaign.status}</Badge>
              <Badge>{campaign.type}</Badge>
              <Badge variant={badgeVariantForStatus(campaign.audience)}>{campaign.audience}</Badge>
              {campaign.occasion ? <span className="ml-1">{campaign.occasion}</span> : null}
              {campaign.occasion && dates ? <span className="text-slate-300">·</span> : null}
              {dates ? <span className={campaign.occasion ? '' : 'ml-1'}>{dates}</span> : null}
            </span>
          }
          actions={
            <>
              <EditButton formType="campaign" recordId={campaign.id} />
              <DeleteButton formType="campaign" recordId={campaign.id} redirectTo="/campaigns" />
            </>
          }
          backHref="/campaigns"
          backLabel="Campaigns"
        />

        {canEdit(user.role) && !canManage ? (
          <p className="-mt-3 mb-4 text-sm text-slate-500">
            Owned by {campaign.owner_name ?? 'another user'}. Only the owner or an admin can change
            this campaign.
          </p>
        ) : null}

        <div className="space-y-4">
          <DetailView fields={campaignFields} sections={section('Purpose')} record={campaign} />
          <CampaignArtifactsManager campaignId={campaign.id} artifacts={artifacts} />
          <DetailView
            fields={campaignFields}
            sections={section('Target Industries')}
            record={campaign}
          />
          <CampaignStats stats={computeCampaignStats(campaign)} type={campaign.type} />
        </div>

        <CampaignMembersManager
          campaignId={campaign.id}
          members={members.data}
          hasTargetIndustries={campaign.target_industries.length > 0}
        />

        <div className="mt-8">
          <DetailView fields={campaignFields} sections={section('Record Info')} record={campaign} />
        </div>
      </div>
    </PermissionProvider>
  )
}
