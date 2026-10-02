import { notFound } from 'next/navigation'
import { getContact } from '@/lib/services/contacts'
import { listContactCompanies } from '@/lib/services/contact-companies'
import { listCompanies } from '@/lib/services/companies'
import { contactFields, contactSections } from '@/lib/config/models/contact-config'
import { DetailView } from '@/components/page/detail-view'
import { PageHeader } from '@/components/page/page-header'
import { EditButton } from '@/components/actions/edit-button'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { ContactCompaniesManager } from '@/components/contacts/contact-companies-manager'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await getContact(id)
  if (!contact) notFound()

  const [memberships, companies] = await Promise.all([
    listContactCompanies(id),
    listCompanies({ limit: 100, orderBy: 'name', orderAsc: true }),
  ])
  const companyOptions = companies.data.map((c) => ({ id: c.id, name: c.name }))

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

  return (
    <div>
      <PageHeader
        title={fullName}
        glyph={<InitialsAvatar name={fullName} size="xl" />}
        subtitle={contact.title}
        actions={<EditButton formType="contact" recordId={contact.id} />}
        backHref="/contacts"
        backLabel="Contacts"
      />

      <div className="space-y-4">
        <DetailView fields={contactFields} sections={contactSections} record={contact} />
        <ContactCompaniesManager
          contactId={contact.id}
          memberships={memberships}
          companyOptions={companyOptions}
        />
      </div>
    </div>
  )
}
