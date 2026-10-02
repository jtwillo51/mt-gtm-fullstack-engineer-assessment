import { z } from 'zod'
import { emptyStringToNull } from './helpers'

// A contact is a standalone person. Company membership is managed separately
// via contact_companies (see contact-companies service), so no company_id here.
export const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: emptyStringToNull,
  email: emptyStringToNull,
  title: emptyStringToNull,
})

export const contactUpdateSchema = contactSchema.partial()

export type ContactFormInput = z.input<typeof contactSchema>
export type ContactUpdateInput = z.input<typeof contactUpdateSchema>
