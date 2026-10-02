import { listContacts } from '@/lib/services/contacts'
import { contactListConfig } from '@/lib/config/models/contact-config'
import { parseSearchParams, type RawSearchParams } from '@/lib/utils/search-params'
import { DataTable } from '@/components/table/data-table'
import { PageHeader } from '@/components/page/page-header'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  const data = await listContacts(parseSearchParams(sp))

  return (
    <div>
      <PageHeader title="Contacts" subtitle="Add contacts from a company's detail page." />
      <DataTable data={data} config={contactListConfig} linkPath="/contacts" />
    </div>
  )
}
