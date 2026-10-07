-- 0005_campaigns.sql
-- Marketing campaigns. Three tables, all with the standard audit block, soft
-- delete, and the same RLS shape as the reference models:
--   • campaigns           — the campaign itself (type, audience, purpose, …)
--   • campaign_members    — which companies / contacts were part of it, and how
--                           far each one got (Targeted → Sent → … → Converted)
--   • campaign_artifacts  — creative: uploaded files (Storage) or external links
-- Campaign stats are DERIVED from member outcomes in v_campaigns — never stored.

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL
    CHECK (type IN ('Email', 'Direct Mail', 'SMS', 'Social', 'Event', 'Other')),
  status            TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Active', 'Completed')),
  -- Internal = aimed at existing customers (add-ons / upsell);
  -- External = aimed at winning new customers.
  audience          TEXT NOT NULL CHECK (audience IN ('Internal', 'External')),
  -- Optional holiday / occasion the campaign is tied to, e.g. "4th of July Sale".
  occasion          TEXT,
  purpose           TEXT,
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  start_date        DATE,
  end_date          DATE,
  owner_id          UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES public.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES public.users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES public.users(id),
  CONSTRAINT campaigns_dates_ordered
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_campaigns_live ON public.campaigns (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_name ON public.campaigns (name) WHERE deleted_at IS NULL;

CREATE TRIGGER audit_campaigns_fields
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_authenticated_select" ON public.campaigns
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.is_editor() OR public.is_admin());

CREATE POLICY "campaigns_editor_insert" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "campaigns_owner_update" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (owner_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "campaigns_admin_delete" ON public.campaigns
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "campaigns_active_app_membership" ON public.campaigns
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;

-- ---------------------------------------------------------------------------
-- campaign_members
-- ---------------------------------------------------------------------------
-- A member is either a company (company_id set, contact_id NULL) or a person
-- (contact_id set; company_id records which company they were reached through,
-- defaulting to their primary company). `status` is the furthest funnel stage
-- the member reached; stats in v_campaigns are cumulative over these stages.
CREATE TABLE public.campaign_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id),
  company_id  UUID REFERENCES public.companies(id),
  contact_id  UUID REFERENCES public.contacts(id),
  status      TEXT NOT NULL DEFAULT 'Targeted'
    CHECK (status IN ('Targeted', 'Sent', 'Opened', 'Responded', 'Converted', 'Bounced')),
  owner_id    UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES public.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.users(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES public.users(id),
  CONSTRAINT campaign_members_has_target
    CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

-- One live membership per person, and one live company-level membership per
-- company. Partial so a removed member can be re-added.
CREATE UNIQUE INDEX uq_campaign_members_contact
  ON public.campaign_members (campaign_id, contact_id)
  WHERE contact_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_campaign_members_company
  ON public.campaign_members (campaign_id, company_id)
  WHERE contact_id IS NULL AND deleted_at IS NULL;

CREATE INDEX idx_campaign_members_campaign ON public.campaign_members (campaign_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_campaign_members_company ON public.campaign_members (company_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_campaign_members_contact ON public.campaign_members (contact_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER audit_campaign_members_fields
  BEFORE INSERT OR UPDATE ON public.campaign_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_members_authenticated_select" ON public.campaign_members
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.is_editor() OR public.is_admin());

CREATE POLICY "campaign_members_editor_insert" ON public.campaign_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "campaign_members_owner_update" ON public.campaign_members
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (owner_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "campaign_members_admin_delete" ON public.campaign_members
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "campaign_members_active_app_membership" ON public.campaign_members
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_members TO authenticated;

-- ---------------------------------------------------------------------------
-- campaign_artifacts
-- ---------------------------------------------------------------------------
-- kind = 'file' → the object lives in the campaign-artifacts Storage bucket at
-- storage_path ("<campaign_id>/<uuid>-<filename>"); kind = 'link' → url.
CREATE TABLE public.campaign_artifacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES public.campaigns(id),
  kind         TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  title        TEXT NOT NULL,
  url          TEXT,
  storage_path TEXT,
  mime_type    TEXT,
  size_bytes   BIGINT,
  owner_id     UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES public.users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES public.users(id),
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID REFERENCES public.users(id),
  CONSTRAINT campaign_artifacts_kind_shape CHECK (
    (kind = 'file' AND storage_path IS NOT NULL AND url IS NULL)
    OR (kind = 'link' AND url IS NOT NULL AND storage_path IS NULL)
  )
);

CREATE INDEX idx_campaign_artifacts_campaign ON public.campaign_artifacts (campaign_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER audit_campaign_artifacts_fields
  BEFORE INSERT OR UPDATE ON public.campaign_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

ALTER TABLE public.campaign_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_artifacts_authenticated_select" ON public.campaign_artifacts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.is_editor() OR public.is_admin());

CREATE POLICY "campaign_artifacts_editor_insert" ON public.campaign_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "campaign_artifacts_owner_update" ON public.campaign_artifacts
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (owner_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "campaign_artifacts_admin_delete" ON public.campaign_artifacts
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "campaign_artifacts_active_app_membership" ON public.campaign_artifacts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_artifacts TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded artifacts (private; read via signed URLs)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-artifacts',
  'campaign-artifacts',
  false,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Same role rules as the artifact rows: active users read, editors upload.
-- Objects are never removed from the app (artifact rows are soft-deleted).
CREATE POLICY "campaign_artifacts_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-artifacts' AND public.is_active_app_user());

CREATE POLICY "campaign_artifacts_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-artifacts' AND public.is_editor());

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
-- Campaign + audit names + DERIVED stats. Stages are cumulative: a Converted
-- member also counts as sent, opened and responded. Bounced counts as sent but
-- not delivered.
CREATE VIEW public.v_campaigns AS
SELECT
  c.*,
  owner.name   AS owner_name,
  creator.name AS created_by_name,
  updater.name AS updated_by_name,
  COALESCE(s.member_count, 0)    AS member_count,
  COALESCE(s.sent_count, 0)      AS sent_count,
  COALESCE(s.bounced_count, 0)   AS bounced_count,
  COALESCE(s.opened_count, 0)    AS opened_count,
  COALESCE(s.responded_count, 0) AS responded_count,
  COALESCE(s.converted_count, 0) AS converted_count
FROM public.campaigns c
LEFT JOIN public.users owner   ON owner.id = c.owner_id
LEFT JOIN public.users creator ON creator.id = c.created_by
LEFT JOIN public.users updater ON updater.id = c.updated_by
LEFT JOIN LATERAL (
  SELECT
    count(*)                                                              AS member_count,
    count(*) FILTER (WHERE m.status <> 'Targeted')                        AS sent_count,
    count(*) FILTER (WHERE m.status = 'Bounced')                          AS bounced_count,
    count(*) FILTER (WHERE m.status IN ('Opened', 'Responded', 'Converted')) AS opened_count,
    count(*) FILTER (WHERE m.status IN ('Responded', 'Converted'))        AS responded_count,
    count(*) FILTER (WHERE m.status = 'Converted')                        AS converted_count
  FROM public.campaign_members m
  WHERE m.campaign_id = c.id AND m.deleted_at IS NULL
) s ON true;

GRANT SELECT ON public.v_campaigns TO authenticated;
ALTER VIEW public.v_campaigns SET (security_invoker = true);

-- Member view: names for the member table.
CREATE VIEW public.v_campaign_members AS
SELECT
  m.*,
  co.name       AS company_name,
  co.industry   AS company_industry,
  ct.first_name AS contact_first_name,
  ct.last_name  AS contact_last_name,
  ct.email      AS contact_email,
  ct.title      AS contact_title
FROM public.campaign_members m
LEFT JOIN public.companies co ON co.id = m.company_id
LEFT JOIN public.contacts ct  ON ct.id = m.contact_id;

GRANT SELECT ON public.v_campaign_members TO authenticated;
ALTER VIEW public.v_campaign_members SET (security_invoker = true);
