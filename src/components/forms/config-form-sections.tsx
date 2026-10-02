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
                  <FieldInput key={field.name} field={field} form={form} />
                ))}
              </div>
            </fieldset>
          )
        })}
    </div>
  )
}

function FieldInput({ field, form }: { field: FieldConfig; form: UseFormReturn<FieldValues> }) {
  const error = form.formState.errors[field.name]?.message as string | undefined
  const register = form.register(field.name)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {field.type === 'textarea' ? (
        <Textarea id={field.name} placeholder={field.placeholder} {...register} />
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
    case 'datetime-local':
      return 'datetime-local'
    default:
      return 'text'
  }
}
