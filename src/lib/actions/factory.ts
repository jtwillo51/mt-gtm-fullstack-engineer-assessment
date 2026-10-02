import type { ActionResult, ServiceContext } from '@/lib/services/base'
import { getErrorMessage } from '@/lib/services/base'

/** Minimal structural shape so we don't depend on Zod's generic ordering. */
interface Parser<Out> {
  parse: (input: unknown) => Out
}

/**
 * Reduces CRUD action boilerplate: Zod validation → service call → error wrap.
 * Cache invalidation is deliberately client-side (useMutationSuccess +
 * router.refresh()), so actions do not call revalidatePath.
 *
 * Anything non-standard (bulk ops, join tables, custom validation) is a plain
 * hand-written 'use server' function that parses and calls the service.
 */
export function createCRUDActions<T, CreateInput, UpdateInput>(config: {
  serviceName: string
  schemas: {
    create: Parser<CreateInput>
    update: Parser<UpdateInput>
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
        const parsed = config.schemas.create.parse(input)
        return await config.service.create(parsed)
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error, `Failed to create ${config.serviceName}`),
        }
      }
    },
    async update(id: string, input: UpdateInput): Promise<ActionResult<T>> {
      try {
        const parsed = config.schemas.update.parse(input)
        return await config.service.update(id, parsed)
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
