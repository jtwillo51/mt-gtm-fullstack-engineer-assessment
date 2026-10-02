'use client'

import React from 'react'
import { Building2, Users, type LucideIcon } from 'lucide-react'

/**
 * Lazy-loaded form registry. NewButton / EditButton consult this to render the
 * right form and gate by role. To add a model: add a FormType member + an entry
 * here — the buttons pick it up automatically.
 */
export type FormType = 'company' | 'contact'

export type FormRole = 'editor' | 'admin'

export interface NewFormDefaults {
  defaultCompanyId?: string
}

export interface FormRegistryEntry {
  Component: React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>
  icon: LucideIcon
  label: string
  role: FormRole
  buildCreateProps?: (defaults: NewFormDefaults) => Record<string, unknown>
  buildEditProps: (recordId: string) => Record<string, unknown>
}

const CompanyFormLazy = React.lazy(() =>
  import('@/components/forms/company-form').then((m) => ({
    default: m.CompanyForm as unknown as React.ComponentType<Record<string, unknown>>,
  }))
)

const ContactFormLazy = React.lazy(() =>
  import('@/components/forms/contact-form').then((m) => ({
    default: m.ContactForm as unknown as React.ComponentType<Record<string, unknown>>,
  }))
)

export const formRegistry: Record<FormType, FormRegistryEntry> = {
  company: {
    Component: CompanyFormLazy,
    icon: Building2,
    label: 'company',
    role: 'editor',
    buildEditProps: (recordId) => ({ companyId: recordId }),
  },
  contact: {
    Component: ContactFormLazy,
    icon: Users,
    label: 'contact',
    role: 'editor',
    buildCreateProps: (defaults) => ({ defaultCompanyId: defaults.defaultCompanyId }),
    buildEditProps: (recordId) => ({ contactId: recordId }),
  },
}
