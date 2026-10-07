import { listCampaigns, computeOutcomeBreakdown } from '@/lib/services/campaigns'
import { campaignListConfig } from '@/lib/config/models/campaign-config'
import { parseSearchParams, type RawSearchParams } from '@/lib/utils/search-params'
import { DataTable } from '@/components/table/data-table'
import { NewButton } from '@/components/actions/new-button'
import { PageHeader } from '@/components/page/page-header'
import { RecentCampaignsChart } from '@/components/campaigns/recent-campaigns-chart'

const RECENT_CAMPAIGN_COUNT = 5

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  // The chart ignores the table's search/sort/page so it always shows the
  // latest campaigns (the service's default order: newest start date first).
  const [data, recent] = await Promise.all([
    listCampaigns(parseSearchParams(sp, campaignListConfig)),
    listCampaigns({ limit: RECENT_CAMPAIGN_COUNT }),
  ])

  // Plain serializable rows for the client chart.
  const recentRows = recent.data.map((c) => ({
    id: c.id,
    name: c.name,
    breakdown: computeOutcomeBreakdown(c),
  }))

  return (
    <div>
      <PageHeader
        title="Campaigns"
        actions={<NewButton formType="campaign" label="New Campaign" />}
      />
      <RecentCampaignsChart rows={recentRows} />
      <DataTable data={data} config={campaignListConfig} linkPath="/campaigns" />
    </div>
  )
}
