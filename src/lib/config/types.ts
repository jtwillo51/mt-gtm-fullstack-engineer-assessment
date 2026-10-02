/**
 * Config-driven model definitions. One file per model declares its fields
 * (which drive the form), its sections (form layout), and its list view
 * (columns + default sort). The shared DataTable and form renderer consume
 * these — you rarely write bespoke column/field JSX.
 */

export type FieldType =
  'text' | 'textarea' | 'url' | 'email' | 'select' | 'number' | 'datetime-local'

export type RenderType =
  | 'text'
  | 'url'
  | 'badge'
  | 'datetime'
  | 'email'
  | 'company-name' // CompanyTile + name
  | 'person-name' // InitialsAvatar + full name

export interface FieldConfig {
  /** DB column name. */
  name: string
  label: string
  type?: FieldType
  section: string
  required?: boolean
  placeholder?: string
  renderType?: RenderType
  /** Hide from the create/edit form (default: shown). */
  showInForm?: boolean
  /** Hide from the detail page (default: shown). */
  showInDetail?: boolean
}

export interface SectionConfig {
  id: string
  columns?: 1 | 2
}

export interface ListColumnConfig {
  field: string
  label: string
  defaultVisible?: boolean
  sortable?: boolean
  renderType?: RenderType
}

export interface ListViewConfig {
  columns: ListColumnConfig[]
  defaultSort: { field: string; asc: boolean }
  /** Columns the list search box matches against (documentation only here). */
  searchFields?: string[]
}
