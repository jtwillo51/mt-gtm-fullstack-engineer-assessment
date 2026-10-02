-- 0004_contact_companies.sql
-- The company↔contact join. A contact can belong to many companies; at most one
-- membership per contact is `is_primary`. Two DB-enforced invariants:
--   • UNIQUE (contact_id, company_id) among live rows (no duplicate membership)
--   • at most one live primary per contact (partial unique index)
-- plus triggers that keep the primary coherent. This is the reference for a
-- "membership" join table.

CREATE TABLE public.contact_companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  owner_id   UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id)
);

-- One live membership per (contact, company); partial so a removed (soft-deleted)
-- membership doesn't block re-adding.
CREATE UNIQUE INDEX uq_contact_companies_pair
  ON public.contact_companies (contact_id, company_id)
  WHERE deleted_at IS NULL;

-- At most one live primary company per contact.
CREATE UNIQUE INDEX uq_contact_companies_one_primary
  ON public.contact_companies (contact_id)
  WHERE is_primary AND deleted_at IS NULL;

CREATE INDEX idx_contact_companies_company ON public.contact_companies (company_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_contact_companies_contact ON public.contact_companies (contact_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER audit_contact_companies_fields
  BEFORE INSERT OR UPDATE ON public.contact_companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

-- The first live membership a contact gets becomes primary automatically.
CREATE OR REPLACE FUNCTION public.ensure_first_contact_company_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND NOT NEW.is_primary THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contact_companies
      WHERE contact_id = NEW.contact_id AND is_primary AND deleted_at IS NULL
    ) THEN
      NEW.is_primary := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_first_contact_company_primary
  BEFORE INSERT ON public.contact_companies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_first_contact_company_primary();

-- Setting a membership primary demotes the contact's other primaries. The
-- recursive UPDATE sets is_primary=false, so its own trigger pass is a no-op.
CREATE OR REPLACE FUNCTION public.unset_other_primary_contact_companies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary AND NEW.deleted_at IS NULL THEN
    UPDATE public.contact_companies
    SET is_primary = false
    WHERE contact_id = NEW.contact_id
      AND id <> NEW.id
      AND is_primary
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER unset_other_primary_contact_companies
  BEFORE INSERT OR UPDATE ON public.contact_companies
  FOR EACH ROW EXECUTE FUNCTION public.unset_other_primary_contact_companies();

ALTER TABLE public.contact_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_companies_authenticated_select" ON public.contact_companies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.is_editor() OR public.is_admin());

CREATE POLICY "contact_companies_editor_insert" ON public.contact_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "contact_companies_owner_update" ON public.contact_companies
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (owner_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "contact_companies_admin_delete" ON public.contact_companies
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "contact_companies_active_app_membership" ON public.contact_companies
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_companies TO authenticated;

-- Membership view: contact + company names + the primary flag.
CREATE VIEW public.v_contact_companies AS
SELECT
  cc.*,
  ct.first_name AS contact_first_name,
  ct.last_name  AS contact_last_name,
  ct.email      AS contact_email,
  ct.title      AS contact_title,
  co.name       AS company_name
FROM public.contact_companies cc
JOIN public.contacts ct  ON ct.id = cc.contact_id
JOIN public.companies co ON co.id = cc.company_id;

GRANT SELECT ON public.v_contact_companies TO authenticated;
ALTER VIEW public.v_contact_companies SET (security_invoker = true);

-- Recreate v_contacts to expose the derived primary company.
-- (DROP VIEW loses ALTER VIEW settings — security_invoker is re-applied below.)
DROP VIEW public.v_contacts;
CREATE VIEW public.v_contacts AS
SELECT
  ct.*,
  owner.name   AS owner_name,
  creator.name AS created_by_name,
  updater.name AS updated_by_name,
  pc.company_id AS primary_company_id,
  pc.company_name AS primary_company_name
FROM public.contacts ct
LEFT JOIN public.users owner   ON owner.id = ct.owner_id
LEFT JOIN public.users creator ON creator.id = ct.created_by
LEFT JOIN public.users updater ON updater.id = ct.updated_by
LEFT JOIN LATERAL (
  SELECT cc.company_id, co.name AS company_name
  FROM public.contact_companies cc
  JOIN public.companies co ON co.id = cc.company_id
  WHERE cc.contact_id = ct.id AND cc.is_primary AND cc.deleted_at IS NULL
  LIMIT 1
) pc ON true;

GRANT SELECT ON public.v_contacts TO authenticated;
ALTER VIEW public.v_contacts SET (security_invoker = true);
