import { z } from 'zod'
import { emptyStringToNull } from './helpers'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: emptyStringToNull,
  industry: emptyStringToNull,
})

// Update = create with every field optional.
export const companyUpdateSchema = companySchema.partial()

// z.input<> (not z.infer<>) — zodResolver needs the pre-transform shape.
export type CompanyFormInput = z.input<typeof companySchema>
export type CompanyUpdateInput = z.input<typeof companyUpdateSchema>
