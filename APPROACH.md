# Approach: Marketing Campaigns

## How I worked

1. **Read before writing.** I traced Companies and Contacts end to end (migration →
   service → schema → actions → config → pages → tests) and treated them as the spec for
   _how_ to build. The scaffold already hinted at the shape (`campaign_members` is
   mentioned in `0002_companies.sql`, Draft/Active/Completed is in the badge map), so I
   followed those hints.
2. **Decided what a campaign is from the user's point of view** before touching code.
3. **Built bottom-up and verified each layer:** migration applied before services, type
   check and lint after the UI, then every flow clicked through as admin, editor and
   viewer.

## Data model

- **`campaigns`:** name, type (Email, Direct Mail, SMS, Social, Event, Other), status
  (Draft, Active, Completed), audience (**Internal** = existing customers, **External** =
  new business), optional occasion ("4th of July Sale"), purpose, target industries,
  dates.
- **`campaign_members`:** who was reached. Either a **company** or a **person** (with the
  company they were reached through), each with an outcome: Targeted → Sent → Opened →
  Responded → Converted, or Bounced.
- **`campaign_artifacts`:** the creative. Uploaded files (private Storage bucket) or
  links.

Every table follows the reference conventions: audit block and trigger, soft delete, the
same RLS policies, `security_invoker` views.

## Key decisions

- **Stats are derived, never stored.** `v_campaigns` counts member outcomes (cumulative:
  a Converted member also counts as sent, opened and responded). Every number traces back
  to specific companies and people, so "who was in the campaign" and "how did it perform"
  come from the same data.
- **Members can be companies or people,** in one table with a check constraint.
  Some campaigns target businesses, others individuals.
- **Target industries drive member selection:** one click adds every matching company.
- **The campaign owner runs the campaign.** Editors manage the campaigns they own,
  including members and artifacts other people added (`0006_campaign_access.sql`). Admins
  manage everything. Others see the campaign read-only, with a note saying who owns it.
- **Option lists live in the Zod schema** and are mirrored by DB `CHECK`s.
- **Zod 4 gotcha:** `.default()` still applies inside `.partial()`, which would reset
  `status` to Draft on every update. Defaults live on the create schema only, and a test
  pins it.

## Testing

Schema tests cover every input, with exact error messages. Integration tests run against
the local Supabase stack with real RLS: audit stamping, viewers blocked, constraints that
hold even when Zod is bypassed, the owner rules above, and search with special
characters. Component tests run as both editor and viewer. A catalog test checks every
table follows the RLS and audit conventions. `npm run verify` and CI run all of it.

## Beyond the feature

Working on campaigns, I found and fixed a few issues in shared code the campaign pages
depend on (for example, a comma in the member picker's search crashed it). I also wrote
up what I noticed elsewhere **without changing the Companies or Contacts pages** (apart from that shared search fix). Both
are in [`AUDIT.md`](AUDIT.md), along with the guardrails I added for future work
(`AGENTS.md`, CI, Claude Code hooks).

## Tools

- **Claude Code** as a pair programmer: traced the codebase, drafted code under my
  direction, ran the checks, and drove a browser for manual testing. I made the product
  calls (what a campaign tracks, page layout, per-member outcomes, owner access) and
  reviewed the output.
- Local Supabase (Docker + CLI), Vitest, Testing Library, ESLint, Prettier.

## What I'd do next

- **Import outcomes** from the email platform (webhook or CSV) instead of setting them by
  hand. The per-member model is built for it.
- **Bulk outcome updates,** filtering members by outcome, and paging the member table.
- **Campaign history** on company and contact pages.
- **Cost per campaign** → cost per conversion.
- **One industry list** shared by companies and campaigns (see `AUDIT.md`).
