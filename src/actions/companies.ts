'use server'

import { createCRUDActions } from '@/lib/actions/factory'
import {
  companySchema,
  companyUpdateSchema,
  type CompanyFormInput,
  type CompanyUpdateInput,
} from '@/lib/schemas'
import {
  createCompany,
  updateCompany,
  deleteCompany,
  getCompany,
  type Company,
} from '@/lib/services/companies'

const companyActions = createCRUDActions<Company, CompanyFormInput, CompanyUpdateInput>({
  serviceName: 'company',
  schemas: { create: companySchema, update: companyUpdateSchema },
  service: { create: createCompany, update: updateCompany, delete: deleteCompany },
})

export const createCompanyAction = companyActions.create
export const updateCompanyAction = companyActions.update
export const deleteCompanyAction = companyActions.delete

/** For the edit form's data load. */
export async function getCompanyAction(id: string): Promise<Company | null> {
  return getCompany(id)
}
