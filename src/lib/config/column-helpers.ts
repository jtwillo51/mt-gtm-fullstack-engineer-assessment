import type { FieldConfig, ListColumnConfig } from './types'

export function columnOverride(partial: Partial<ListColumnConfig> & { field: string }) {
  return partial
}

export function computedColumn(col: ListColumnConfig): ListColumnConfig {
  return col
}

/**
 * Derive list columns from a model's fields. Each field becomes a column
 * (hidden by default); `overrides` flip visibility / sortability / renderType,
 * `additionalColumns` add view-only columns (e.g. owner_name), and `exclude`
 * drops columns entirely.
 */
export function generateListColumns(
  fields: FieldConfig[],
  opts: {
    overrides?: (Partial<ListColumnConfig> & { field: string })[]
    additionalColumns?: ListColumnConfig[]
    exclude?: string[]
  } = {}
): ListColumnConfig[] {
  const exclude = new Set(opts.exclude ?? [])
  const overrideByField = new Map((opts.overrides ?? []).map((o) => [o.field, o]))

  const base: ListColumnConfig[] = fields
    .filter((f) => !exclude.has(f.name))
    .map((f) => {
      const override = overrideByField.get(f.name)
      return {
        field: f.name,
        label: f.label,
        defaultVisible: false,
        sortable: false,
        renderType: f.renderType,
        ...override,
      }
    })

  return [...base, ...(opts.additionalColumns ?? [])]
}
