---
name: add-model
description: Add a new data model (e.g. Deals, Tasks, Locations) to the Atlas CRM end to end — migration, generated types, schema, service, actions, config, forms, pages, nav and tests — in the order that keeps each layer verifiable. Use whenever the user asks for a new entity/table/model/resource, or a new child table of an existing one.
---

# Add a model end to end

A model touches ~15 files across 8 layers. Build **bottom-up** and verify each layer
before starting the next. Companies (`company`) is the base-model reference;
Contacts (`contact`) is the reference for a child shown on a parent's detail page;
Campaigns (`campaign`) is the reference for custom panels (members, artifacts).

Below, `widget` / `widgets` / `Widget` stand for the new model's singular / plural /
type name.

## 0. Decide before coding (ask the user if unclear)

- Columns, which are required, and any fixed option lists (→ Zod enum + DB CHECK).
- Relationship to existing models: FK (child) or join table (many-to-many)?
- List columns, which are sortable, and what the search box should match.
- Who can do what. The default is the standard RLS shape (all read, editors insert,
  owner-or-admin update, admin delete). Say so explicitly if it should differ.

## 1. Migration — `supabase/migrations/NNNN_widgets.sql`

Follow `.claude/rules/migrations.md` (copy `0002_companies.sql`): table + audit block,
live/FK indexes, audit trigger, RLS + 4 policies + restrictive gate, grants, a
`v_widgets` view with owner/creator/updater names and `security_invoker = true`.

```bash
npx supabase migration up
npm run db:types
```

Verify: run the `db-reviewer` agent on the migration, then
`npx vitest run --project integration src/lib/services/db-conventions.test.ts`.

## 2. Schema — `src/lib/schemas/widget.schema.ts` (+ `.test.ts`)

`widgetSchema`, `widgetUpdateSchema = widgetFields.partial()`, `WidgetFormInput`,
`WidgetUpdateInput` via `z.input`. Option lists exported `as const`. Use the helpers in
`helpers.ts` for optional/url/email/enum fields. Re-export from `schemas/index.ts`.

Test: every field accept/reject with exact messages, output keys, partial update
leaves omitted keys out, option lists pinned.

## 3. Service — `src/lib/services/widgets.ts` (+ `.test.ts`, DB-backed)

Copy `companies.ts`: `Widget` interface (= `v_widgets` columns), `getWidget` (with
`isUuid` guard), `listWidgets` (with `applySearch` + stable order), `createWidget`,
`updateWidget`, `deleteWidget` (soft). Child of a parent? Add `listWidgetsForX(parentId)`.

Test (`DB_BACKED_TESTS` in `vitest.config.ts`!): audit stamping, viewer blocked, a CHECK
holds with Zod bypassed, search incl. a comma, soft delete, `getWidget('bad')` → null.
Add a `SameKeys<Widget, Tables<'v_widgets'>>` line to `campaign-shape.test.ts`.
Add `widgets` (and any join table, first) to `cleanupTestDataByOwner`, plus a
`createTestWidget` seed helper.

## 4. Actions — `src/actions/widgets.ts`

`'use server'`; `createCRUDActions<Widget, WidgetFormInput, WidgetUpdateInput>` →
export `createWidgetAction`, `updateWidgetAction`, `deleteWidgetAction`; plus
`getWidgetAction(id)` for the edit form. Extra actions use `validate()`.

## 5. Config — `src/lib/config/models/widget-config.ts` (+ `.test.ts`)

`widgetFields`, `widgetSections`, `widgetListConfig` (sortable = real view columns;
`searchFields` + `searchPlaceholder`). Test: form fields match the schema keys; sortable
columns exist on `Widget`.

## 6. Data plumbing

- `src/lib/query-keys.ts`: add `widgets: { all, detail }`.
- `src/lib/hooks/use-entity.ts`: add `useWidget(id)`.

## 7. Form + registries

- `src/components/forms/widget-form.tsx` (+ `.test.tsx`): copy `company-form.tsx`
  (`FormSheet` + `ConfigFormSections`; defaultValues for every field; arrays start as `[]`).
- `src/components/actions/form-registry.tsx`: add `'widget'` to `FormType` and an entry.
- `src/components/actions/delete-button.tsx`: add a `widget` entry if it should be
  deletable from its detail page.

## 8. Pages + nav

- `src/app/(dashboard)/widgets/page.tsx`: `listWidgets(parseSearchParams(sp, widgetListConfig))`,
  `PageHeader` + `NewButton` + `DataTable`. Add `loading.tsx`.
- `src/app/(dashboard)/widgets/[id]/page.tsx`: `getWidget` → `notFound()`, `PageHeader`
  with `EditButton` (+ `DeleteButton`), `DetailView`. Add `loading.tsx`, `error.tsx`
  and `not-found.tsx` (copy the campaigns ones).
- `src/components/sidebar.tsx`: add the nav item.
- Seed a few realistic rows in `supabase/seed.sql` so the pages aren't empty.

## 9. Finish

```bash
npm run verify     # format → lint → build → test → check:tests
```

Then click through in the preview browser as **editor** (create, edit, search with a
comma, delete) and as **viewer** (no edit controls). Note any product decisions you made
in the PR description.
