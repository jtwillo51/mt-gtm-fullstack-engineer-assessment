-- 0002_companies.sql
-- The base-model reference. A company owns child records (contacts, and the
-- campaign_members you will add). Study this file first — your Campaigns
-- migration follows the same shape.

CREATE TABLE public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  website    TEXT,
  industry   TEXT,
  -- Standard audit block — every business table carries exactly this.
  owner_id   UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_companies_live ON public.companies (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_name ON public.companies (name) WHERE deleted_at IS NULL;

CREATE TRIGGER audit_companies_fields
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- SELECT: live rows for everyone; editors/admins also see soft-deleted rows so
-- the `.select()` confirmation after a soft-delete returns the row (otherwise
-- every delete would look like "permission denied / not found").
CREATE POLICY "companies_authenticated_select" ON public.companies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.is_editor() OR public.is_admin());

CREATE POLICY "companies_editor_insert" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "companies_owner_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (owner_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "companies_admin_delete" ON public.companies
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Restrictive membership gate — ANDs with the policies above. A deactivated
-- user passes none of them.
CREATE POLICY "companies_active_app_membership" ON public.companies
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;

-- Read view: joins the audit FKs to human-readable names. security_invoker so
-- it runs as the caller and respects the table's RLS.
CREATE VIEW public.v_companies AS
SELECT
  c.*,
  owner.name    AS owner_name,
  creator.name  AS created_by_name,
  updater.name  AS updated_by_name
FROM public.companies c
LEFT JOIN public.users owner   ON owner.id = c.owner_id
LEFT JOIN public.users creator ON creator.id = c.created_by
LEFT JOIN public.users updater ON updater.id = c.updated_by;

GRANT SELECT ON public.v_companies TO authenticated;
ALTER VIEW public.v_companies SET (security_invoker = true);
