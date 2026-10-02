import { z } from 'zod'

/**
 * Optional string field that normalizes empty input to null.
 * Use for every optional string / url / email field so blank form inputs
 * become NULL in the DB rather than empty strings.
 */
export const emptyStringToNull = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val === '' || val === undefined ? null : val))
