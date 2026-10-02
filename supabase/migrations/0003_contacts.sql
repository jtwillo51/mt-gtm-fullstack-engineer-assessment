-- 0003_contacts.sql
-- A contact is a standalone person. Contacts relate to companies many-to-many
-- via contact_companies (see 0004) — a contact can belong to several companies
-- and has at most one PRIMARY company. This is the reference pattern for a
-- join table with a "primary" flag (the shape a campaign-membership feature
-- would follow).

CREATE TABLE public.contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name  TEXT,
  email      TEXT,
  title      TEXT,
  owner_id   UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_contacts_live ON public.contacts (id) WHERE deleted_at IS NULL;

CREATE TRIGGER audit_contacts_fields
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_authenticated_select" ON public.contacts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.is_editor() OR public.is_admin());

CREATE POLICY "contacts_editor_insert" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "contacts_owner_update" ON public.contacts
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (owner_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "contacts_admin_delete" ON public.contacts
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "contacts_active_app_membership" ON public.contacts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;

-- Person-only view. 0004 recreates this to add the derived primary company
-- once the join table exists.
CREATE VIEW public.v_contacts AS
SELECT
  ct.*,
  owner.name    AS owner_name,
  creator.name  AS created_by_name,
  updater.name  AS updated_by_name
FROM public.contacts ct
LEFT JOIN public.users owner   ON owner.id = ct.owner_id
LEFT JOIN public.users creator ON creator.id = ct.created_by
LEFT JOIN public.users updater ON updater.id = ct.updated_by;

GRANT SELECT ON public.v_contacts TO authenticated;
ALTER VIEW public.v_contacts SET (security_invoker = true);
