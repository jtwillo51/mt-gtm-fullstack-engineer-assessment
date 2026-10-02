'use server'

import { createCRUDActions } from '@/lib/actions/factory'
import {
  contactSchema,
  contactUpdateSchema,
  type ContactFormInput,
  type ContactUpdateInput,
} from '@/lib/schemas'
import {
  createContact,
  updateContact,
  deleteContact,
  getContact,
  type Contact,
} from '@/lib/services/contacts'
import {
  createContactForCompany,
  listContactCompanies,
  attachContactToCompany,
  setPrimaryContactCompany,
  removeContactCompany,
  type ContactCompany,
} from '@/lib/services/contact-companies'
import { listCompanies, type Company } from '@/lib/services/companies'
import type { ActionResult } from '@/lib/services/base'

const contactActions = createCRUDActions<Contact, ContactFormInput, ContactUpdateInput>({
  serviceName: 'contact',
  schemas: { create: contactSchema, update: contactUpdateSchema },
  service: { create: createContact, update: updateContact, delete: deleteContact },
})

export const createContactAction = contactActions.create
export const updateContactAction = contactActions.update
export const deleteContactAction = contactActions.delete

export async function getContactAction(id: string): Promise<Contact | null> {
  return getContact(id)
}

/** Create a contact and attach it to a company (the "Add Contact" flow). */
export async function createContactForCompanyAction(
  companyId: string,
  input: ContactFormInput
): Promise<ActionResult<Contact>> {
  const parsed = contactSchema.parse(input)
  return createContactForCompany(companyId, parsed)
}

// --- Company membership management (contact detail → Companies) ---

export async function getContactCompaniesAction(contactId: string): Promise<ContactCompany[]> {
  return listContactCompanies(contactId)
}

export async function attachContactCompanyAction(
  contactId: string,
  companyId: string
): Promise<ActionResult<ContactCompany>> {
  return attachContactToCompany(contactId, companyId)
}

export async function setPrimaryContactCompanyAction(
  membershipId: string
): Promise<ActionResult<void>> {
  return setPrimaryContactCompany(membershipId)
}

export async function removeContactCompanyAction(
  membershipId: string
): Promise<ActionResult<void>> {
  return removeContactCompany(membershipId)
}

/** All companies, for the "add to company" picker. */
export async function listCompanyOptionsAction(): Promise<Pick<Company, 'id' | 'name'>[]> {
  const result = await listCompanies({ limit: 100, orderBy: 'name', orderAsc: true })
  return result.data.map((c) => ({ id: c.id, name: c.name }))
}
