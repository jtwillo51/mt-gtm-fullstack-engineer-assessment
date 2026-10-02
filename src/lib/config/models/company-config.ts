import type { FieldConfig, SectionConfig, ListViewConfig } from '../types'
import { METADATA_FIELDS, RECORD_INFO_SECTION } from '../constants'
import { generateListColumns, columnOverride, computedColumn } from '../column-helpers'

export const companyFields: FieldConfig[] = [
  {
    name: 'name',
    label: 'Company Name',
    section: 'Company Information',
    required: true,
    placeholder: 'Acme Inc.',
    // List column shows a CompanyTile + name; the detail page shows the name in
    // its header, so it's hidden from the detail body.
    renderType: 'company-name',
    showInDetail: false,
  },
  {
    name: 'website',
    label: 'Website',
    type: 'url',
    section: 'Company Information',
    placeholder: 'https://acme.com',
    renderType: 'url',
  },
  {
    name: 'industry',
    label: 'Industry',
    section: 'Company Information',
    placeholder: 'e.g. Beauty, Fitness',
    renderType: 'text',
  },
  ...METADATA_FIELDS,
]

export const companySections: SectionConfig[] = [
  { id: 'Company Information', columns: 2 },
  RECORD_INFO_SECTION,
]

export const companyListConfig: ListViewConfig = {
  columns: generateListColumns(companyFields, {
    overrides: [
      columnOverride({ field: 'name', defaultVisible: true, sortable: true }),
      columnOverride({ field: 'website', defaultVisible: true, renderType: 'url' }),
      columnOverride({ field: 'industry', defaultVisible: true, sortable: true }),
    ],
    additionalColumns: [
      computedColumn({ field: 'owner_name', label: 'Owner', defaultVisible: true }),
    ],
    exclude: ['owner_name', 'created_at', 'updated_at'],
  }),
  defaultSort: { field: 'name', asc: true },
  searchFields: ['name'],
}
