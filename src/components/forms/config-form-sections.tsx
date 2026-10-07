'use client'

import type { FieldValues, UseFormReturn } from 'react-hook-form'
import type { FieldConfig, SectionConfig } from '@/lib/config/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Renders a form's editable fields from its model config — grouped by section,
 * laid out in 1 or 2 columns. Fields with `showInForm: false` (and all
 * `Record Info` audit fields) are skipped. Do not hand-list field inputs;
 * add a field to the config and it appears here.
 */
export function ConfigFormSections({
  fields,
  sections,
  form,
}: {
  fields: FieldConfig[]
  sections: SectionConfig[]
  form: UseFormReturn<FieldValues>
}) {
  const editable = fields.filter((f) => f.showInForm !== false && f.section !== 'Record Info')

  return (
    <div className="space-y-6">
      {sections
        .filter((s) => s.id !== 'Record Info')
        .map((section) => {
          const sectionFields = editable.filter((f) => f.section === section.id)
          if (sectionFields.length === 0) return null
          return (
            <fieldset key={section.id} className="space-y-4">
              <legend className="text-sm font-semibold text-slate-900">{section.id}</legend>
              <div
                className={cn(
                  'grid gap-4',
                  section.columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1'
                )}
              >
                {sectionFields.map((field) => (
                  <FieldInput
                    key={field.name}
                    field={field}
                    form={form}
                    hideLabel={section.hideFieldLabels}
                  />
                ))}
              </div>
            </fieldset>
          )
        })}
    </div>
  )
}

function FieldInput({
  field,
  form,
  hideLabel,
}: {
  field: FieldConfig
  form: UseFormReturn<FieldValues>
  /** The section legend already names the field — keep the label for screen readers only. */
  hideLabel?: boolean
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined
  const register = form.register(field.name)

  return (
    <div className={cn('space-y-1.5', field.type === 'multiselect' && 'sm:col-span-2')}>
      <Label htmlFor={field.name} className={hideLabel ? 'sr-only' : undefined}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {field.type === 'textarea' ? (
        <Textarea id={field.name} placeholder={field.placeholder} {...register} />
      ) : field.type === 'select' ? (
        <select
          id={field.name}
          className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          {...register}
        >
          <option value="">{field.placeholder ?? 'Select…'}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'multiselect' ? (
        // Checkbox chips sharing one name → react-hook-form collects a string[]
        // (the form's defaultValues must start this field as an array).
        <div id={field.name} className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700"
            >
              <input type="checkbox" value={opt} className="sr-only" {...register} />
              {opt}
            </label>
          ))}
        </div>
      ) : (
        <Input
          id={field.name}
          type={inputType(field)}
          placeholder={field.placeholder}
          {...register}
        />
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function inputType(field: FieldConfig): string {
  switch (field.type) {
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime-local':
      return 'datetime-local'
    default:
      return 'text'
  }
}
