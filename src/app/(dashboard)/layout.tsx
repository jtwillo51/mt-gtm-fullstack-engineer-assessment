import { requireAuth, canEdit } from '@/lib/auth'
import { PermissionProvider } from '@/components/permission-provider'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  return (
    <PermissionProvider value={{ role: user.role, canEdit: canEdit(user.role) }}>
      <Sidebar name={user.name} email={user.email} role={user.role} />
      <div className="pl-60">
        <main className="mx-auto max-w-5xl px-8 py-10">{children}</main>
      </div>
    </PermissionProvider>
  )
}
