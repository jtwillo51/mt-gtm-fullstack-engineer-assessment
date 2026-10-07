/**
 * Config-driven model definitions. One file per model declares its fields
 * (which drive the form), its sections (form layout), and its list view
 * (columns + default sort). The shared DataTable and form renderer consume
 * these — you rarely write bespoke column/field JSX.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'email'
  | 'select' // single choice from `options`
  | 'multiselect' // any number of `options`; value is string[]
  | 'number'
  | 'date'
  | 'datetime-local'

export type RenderType =
  | 'text'
  | 'multiline' // long text, line breaks preserved
  | 'url'
  | 'badge'
  | 'badge-list' // string[] → one badge each
  | 'date' // 'YYYY-MM-DD', shown without timezone shifting
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
  /** Choices for `select` / `multiselect` fields. */
  options?: readonly string[]
  renderType?: RenderType
  /** Hide from the create/edit form (default: shown). */
  showInForm?: boolean
  /** Hide from the detail page (default: shown). */
  showInDetail?: boolean
}

export interface SectionConfig {
  id: string
  columns?: 1 | 2
  /** Detail view: omit per-field labels when the section heading already says
   *  what the value is (e.g. a lone "Purpose" field). */
  hideFieldLabels?: boolean
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
  /** Columns the list service's search matches. Every whitespace-separated term
   *  must appear in at least one of them (see services/search.ts). */
  searchFields?: string[]
  /** Search box placeholder; defaults to "Search…". Say what it searches. */
  searchPlaceholder?: string
}
