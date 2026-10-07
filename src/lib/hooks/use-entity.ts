'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getCompanyAction } from '@/actions/companies'
import { getContactAction } from '@/actions/contacts'
import { getCampaignAction } from '@/actions/campaigns'

/** Load a single company for the edit form. */
export function useCompany(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.companies.detail(id) : ['companies', 'none'],
    queryFn: () => getCompanyAction(id!),
    enabled: !!id,
  })
}

/** Load a single contact for the edit form. */
export function useContact(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.contacts.detail(id) : ['contacts', 'none'],
    queryFn: () => getContactAction(id!),
    enabled: !!id,
  })
}

/** Load a single campaign for the edit form. */
export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.campaigns.detail(id) : ['campaigns', 'none'],
    queryFn: () => getCampaignAction(id!),
    enabled: !!id,
  })
}
