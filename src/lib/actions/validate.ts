/** Minimal structural shape of a Zod schema's safeParse (avoids Zod generics). */
export interface SafeParser<T> {
  safeParse: (
    input: unknown
  ) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }
}

/**
 * Validate action input. On failure, return the FIRST issue's message as an
 * ActionResult — a thrown ZodError's `.message` is the raw JSON issue list,
 * which would otherwise end up verbatim in the user's toast.
 */
export function validate<T>(
  schema: SafeParser<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; error: { success: false; error: string } } {
  const parsed = schema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    error: { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
  }
}
