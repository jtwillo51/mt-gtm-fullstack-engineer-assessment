import type { FieldConfig, SectionConfig, ListViewConfig } from '../types'
import { METADATA_FIELDS, RECORD_INFO_SECTION } from '../constants'
import { generateListColumns, columnOverride, computedColumn } from '../column-helpers'

export const contactFields: FieldConfig[] = [
  {
    name: 'first_name',
    label: 'First Name',
    section: 'Contact Information',
    required: true,
    renderType: 'person-name',
  },
  {
    name: 'last_name',
    label: 'Last Name',
    section: 'Contact Information',
    renderType: 'text',
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    section: 'Contact Information',
    placeholder: 'name@company.com',
    renderType: 'email',
  },
  {
    name: 'title',
    label: 'Title',
    section: 'Contact Information',
    placeholder: 'e.g. Owner, Manager',
    renderType: 'text',
  },
  // Derived (view). Not a form field; shown in the list. The detail page shows
  // the primary company in its header, so it's hidden from the detail body.
  {
    name: 'primary_company_name',
    label: 'Primary Company',
    section: 'Contact Information',
    showInForm: false,
    showInDetail: false,
    renderType: 'text',
  },
  ...METADATA_FIELDS,
]

export const contactSections: SectionConfig[] = [
  { id: 'Contact Information', columns: 2 },
  RECORD_INFO_SECTION,
]

// Top-level /contacts list — shows each contact's primary company.
export const contactListConfig: ListViewConfig = {
  columns: generateListColumns(contactFields, {
    overrides: [
      columnOverride({ field: 'first_name', defaultVisible: true, sortable: true }),
      columnOverride({ field: 'last_name', defaultVisible: true, sortable: true }),
      columnOverride({ field: 'primary_company_name', defaultVisible: true }),
      columnOverride({ field: 'email', defaultVisible: true, renderType: 'email' }),
      columnOverride({ field: 'title', defaultVisible: true }),
    ],
    exclude: ['owner_name', 'created_at', 'updated_at'],
  }),
  defaultSort: { field: 'first_name', asc: true },
  searchFields: ['first_name', 'last_name'],
}

// Contacts of one company (company detail child table) — includes a Primary flag.
export const contactChildConfig: ListViewConfig = {
  columns: [
    { field: 'first_name', label: 'Name', defaultVisible: true, renderType: 'person-name' },
    { field: 'email', label: 'Email', defaultVisible: true, renderType: 'email' },
    { field: 'title', label: 'Title', defaultVisible: true, renderType: 'text' },
    computedColumn({
      field: 'primary',
      label: 'Primary',
      defaultVisible: true,
      renderType: 'badge',
    }),
  ],
  defaultSort: { field: 'first_name', asc: true },
}
