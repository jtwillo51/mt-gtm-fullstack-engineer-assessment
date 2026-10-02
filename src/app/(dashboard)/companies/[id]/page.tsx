import { notFound } from 'next/navigation'
import { getCompany } from '@/lib/services/companies'
import { listContactsForCompany } from '@/lib/services/contact-companies'
import { companyFields, companySections } from '@/lib/config/models/company-config'
import { contactChildConfig } from '@/lib/config/models/contact-config'
import { DetailView } from '@/components/page/detail-view'
import { DataTable } from '@/components/table/data-table'
import { PageHeader } from '@/components/page/page-header'
import { EditButton } from '@/components/actions/edit-button'
import { NewButton } from '@/components/actions/new-button'
import { CompanyTile } from '@/components/ui/company-tile'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await getCompany(id)
  if (!company) notFound()

  const contacts = await listContactsForCompany(id)

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={company.industry}
        glyph={<CompanyTile name={company.name} size="xl" />}
        actions={<EditButton formType="company" recordId={company.id} />}
        backHref="/companies"
        backLabel="Companies"
      />

      <DetailView fields={companyFields} sections={companySections} record={company} />

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Contacts</h2>
          <NewButton
            formType="contact"
            label="Add Contact"
            size="sm"
            defaultCompanyId={company.id}
          />
        </div>
        <DataTable
          data={contacts}
          config={contactChildConfig}
          linkPath="/contacts"
          emptyMessage="No contacts yet."
        />
      </section>
    </div>
  )
}
