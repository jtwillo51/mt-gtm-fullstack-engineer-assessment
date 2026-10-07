import { ErrorState } from '@/components/page/error-state'

/** Rendered (inside the app shell) when a campaign page calls notFound(). */
export default function CampaignNotFound() {
  return (
    <ErrorState
      title="Campaign not found"
      message="It may have been deleted, or the link is wrong."
      homeHref="/campaigns"
      homeLabel="Back to Campaigns"
    />
  )
}
