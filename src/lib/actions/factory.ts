import type { ActionResult, ServiceContext } from '@/lib/services/base'
import { getErrorMessage } from '@/lib/services/base'
import { validate, type SafeParser } from './validate'

/**
 * Reduces CRUD action boilerplate: Zod validation → service call → error wrap.
 * Invalid input returns the first issue's message (see validate.ts), never a
 * raw ZodError.
 * Cache invalidation is deliberately client-side (useMutationSuccess +
 * router.refresh()), so actions do not call revalidatePath.
 *
 * Anything non-standard (bulk ops, join tables, custom validation) is a plain
 * hand-written 'use server' function that parses and calls the service.
 */
export function createCRUDActions<T, CreateInput, UpdateInput>(config: {
  serviceName: string
  schemas: {
    create: SafeParser<CreateInput>
    update: SafeParser<UpdateInput>
  }
  service: {
    create: (input: CreateInput, ctx?: ServiceContext) => Promise<ActionResult<T>>
    update: (id: string, input: UpdateInput, ctx?: ServiceContext) => Promise<ActionResult<T>>
    delete: (id: string, ctx?: ServiceContext) => Promise<ActionResult<void>>
  }
}) {
  return {
    async create(input: CreateInput): Promise<ActionResult<T>> {
      try {
        const v = validate(config.schemas.create, input)
        if (!v.ok) return v.error
        return await config.service.create(v.data)
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error, `Failed to create ${config.serviceName}`),
        }
      }
    },
    async update(id: string, input: UpdateInput): Promise<ActionResult<T>> {
      try {
        const v = validate(config.schemas.update, input)
        if (!v.ok) return v.error
        return await config.service.update(id, v.data)
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error, `Failed to update ${config.serviceName}`),
        }
      }
    },
    async delete(id: string): Promise<ActionResult<void>> {
      try {
        return await config.service.delete(id)
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error, `Failed to delete ${config.serviceName}`),
        }
      }
    },
  }
}
