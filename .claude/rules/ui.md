---
paths:
  - 'src/components/**/*.tsx'
  - 'src/app/**/*.tsx'
---

# UI (components and pages)

- **Pages** (`src/app/(dashboard)/…/page.tsx`) are async Server Components: await
  `params`/`searchParams`, fetch through services, `notFound()` for a missing record,
  and pass **plain serializable data** to client components. List pages call
  `parseSearchParams(sp, xListConfig)`.
- Errors: give a new route segment an `error.tsx` and `not-found.tsx` (see
  `app/(dashboard)/campaigns/`). Don't hand-roll try/catch around reads in pages.
- **Config-driven first.** A new field is a config entry, not JSX. A new display style is
  a `RenderType` case. Bespoke components only for genuinely custom panels (e.g. the
  campaign members manager).
- **Create/edit** forms open in a sheet via `NewButton`/`EditButton` and the form
  registry (`components/actions/form-registry.tsx`). `DeleteButton` covers models listed
  in its own registry (campaigns today).
- **Role gating:** `usePermissions().canEdit` hides edit controls. A detail page can
  narrow it per record with a nested `PermissionProvider` (the campaign page uses
  `canManageCampaign`). It's UX only; RLS is the real check, so still handle a refused
  mutation with a toast.
- **Mutations:** call the server action, `handleActionError(result, fallback)`, then
  `router.refresh()` (or `useMutationSuccess`). Destructive row actions use
  `ConfirmButton` (two-step), never a bare one-click delete.
- **Async UI states:** handle loading, empty ("No … match"), and failure for anything that
  fetches. A rejected server action must not become an unhandled promise.
- **Accessibility:** every input has a label or `aria-label`; icon-only buttons have
  `aria-label`; don't rely on hover alone (`pointer-coarse:` for touch); text uses
  `slate-500`+ (not `slate-400`) for contrast.
- Tailwind only, existing `components/ui/*` primitives, `cn()` for conditional classes.
