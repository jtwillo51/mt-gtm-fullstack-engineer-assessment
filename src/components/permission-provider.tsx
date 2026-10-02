'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Role } from '@/lib/auth'

interface Permissions {
  role: Role
  canEdit: boolean
}

const PermissionContext = createContext<Permissions>({ role: 'Viewer', canEdit: false })

export function PermissionProvider({
  value,
  children,
}: {
  value: Permissions
  children: ReactNode
}) {
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermissions(): Permissions {
  return useContext(PermissionContext)
}
