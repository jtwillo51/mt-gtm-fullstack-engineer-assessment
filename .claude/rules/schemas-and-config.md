---
paths:
  - 'src/lib/schemas/**/*.ts'
  - 'src/lib/config/**/*.ts'
---

# Schemas and model config

## Zod schemas (`src/lib/schemas/`)

- `xSchema` (create) and `xUpdateSchema = xFields.partial()`. Export `z.input<>` types
  (react-hook-form's resolver needs the pre-transform shape).
- **No `.default()` on the shared base**: Zod 4 applies defaults inside `.partial()`, so
  an update omitting the field would reset it. Put defaults on the create schema only.
- Optional strings use `emptyStringToNull` (blank form input becomes `null`). A URL
  rendered as an `href` must be `z.url({ protocol: /^https?$/ })`.
- Option lists are `as const` arrays exported from the schema, mirrored by a DB `CHECK`.
  Pin them in a test.
- Every user-facing error message is a readable sentence. It ends up in a toast.

## Model config (`src/lib/config/models/*-config.ts`)

- `xFields`: one entry per column (`type` drives the form input, `renderType` drives the
  detail/table cell, `options` for selects). Detail-only/computed values go in
  `additionalColumns`. Spread `METADATA_FIELDS` last.
- `xSections`: form/detail layout; end with `RECORD_INFO_SECTION`.
- `xListConfig`: `generateListColumns` + overrides. Mark `sortable: true` only on real
  view columns (it's the `orderBy` whitelist). `searchFields` are the view columns
  the service's search matches; `searchPlaceholder` says what they are.
- Config must stay plain data. It crosses the Server→Client boundary (no functions or
  components). New render behavior = a new `RenderType` string + a case in `DataTable`
  / `DetailView`.
