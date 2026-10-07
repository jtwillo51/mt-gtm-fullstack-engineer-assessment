/** Centralized React Query keys. Use these instead of inline string arrays. */
export const queryKeys = {
  companies: {
    all: ['companies'] as const,
    detail: (id: string) => ['companies', id] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    detail: (id: string) => ['contacts', id] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    detail: (id: string) => ['campaigns', id] as const,
  },
} as const

export type ModelName = keyof typeof queryKeys
