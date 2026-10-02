-- 0001_init.sql
-- Shared foundation: the users table, role helpers, and the audit trigger.
-- Later model migrations (companies, contacts, and the Campaigns feature you
-- build) REUSE these — they never redefine them.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Two UUIDs, exactly like the real app:
--   id       — stable app UUID, used as the FK target everywhere (audit fields,
--              ownership). Never changes.
--   auth_id  — the Supabase Auth UUID, linked at login. Nullable until linked.
CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       UUID UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Editor', 'Viewer')),
  login_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.users TO authenticated;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Any active app user can read the directory; writes are admin-only (managed
-- out of band / by seed here — there is no users CRUD in this assessment app).
CREATE POLICY "users_authenticated_select" ON public.users
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Identity + role helpers (SECURITY DEFINER so they can read users under RLS)
-- ---------------------------------------------------------------------------

-- Resolve the calling user's stable app id. Two-step, zero DB round-trip after
-- first login: read app_user_id from the JWT, else fall back to an auth_id lookup.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'app_user_id',
      ''
    )::uuid,
    (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
  );
$$;

-- An active app user is one whose row exists and whose login is enabled.
CREATE OR REPLACE FUNCTION public.is_active_app_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = public.current_app_user_id()
      AND u.login_enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = public.current_app_user_id()
      AND u.login_enabled = true
      AND u.role = 'Admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = public.current_app_user_id()
      AND u.login_enabled = true
      AND u.role IN ('Admin', 'Editor')
  );
$$;

-- ---------------------------------------------------------------------------
-- handle_audit_fields()
-- ---------------------------------------------------------------------------
-- One trigger per table handles updated_at, owner_id on insert, and no-change
-- suppression. created_by / updated_by / deleted_by are set by the service
-- layer (explicitly, including NULL for system writes) — the trigger does not
-- touch them.
--
-- No-change suppression: strip the 4 audit columns, compare OLD vs NEW. If the
-- rest is identical, leave updated_at alone so a no-op write stays quiet.
CREATE OR REPLACE FUNCTION public.handle_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := public.current_app_user_id();
  old_j JSONB;
  new_j JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    IF NEW.owner_id IS NULL THEN
      NEW.owner_id := v_user;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  old_j := to_jsonb(OLD) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';
  new_j := to_jsonb(NEW) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';

  IF old_j = new_j THEN
    -- Nothing meaningful changed; keep the prior stamp.
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
