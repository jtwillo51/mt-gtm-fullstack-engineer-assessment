import type { FieldConfig, SectionConfig } from './types'

/** Read-only audit fields shared by every model's detail view. */
export const METADATA_FIELDS: FieldConfig[] = [
  {
    name: 'owner_name',
    label: 'Owner',
    section: 'Record Info',
    showInForm: false,
    renderType: 'text',
  },
  {
    name: 'created_at',
    label: 'Created',
    section: 'Record Info',
    showInForm: false,
    renderType: 'datetime',
  },
  {
    name: 'updated_at',
    label: 'Updated',
    section: 'Record Info',
    showInForm: false,
    renderType: 'datetime',
  },
]

export const RECORD_INFO_SECTION: SectionConfig = { id: 'Record Info', columns: 2 }
