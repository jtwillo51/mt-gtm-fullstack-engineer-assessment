import { listCompanies } from '@/lib/services/companies'
import { companyListConfig } from '@/lib/config/models/company-config'
import { parseSearchParams, type RawSearchParams } from '@/lib/utils/search-params'
import { DataTable } from '@/components/table/data-table'
import { NewButton } from '@/components/actions/new-button'
import { PageHeader } from '@/components/page/page-header'

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  const data = await listCompanies(parseSearchParams(sp))

  return (
    <div>
      <PageHeader
        title="Companies"
        actions={<NewButton formType="company" label="New Company" />}
      />
      <DataTable data={data} config={companyListConfig} linkPath="/companies" />
    </div>
  )
}
