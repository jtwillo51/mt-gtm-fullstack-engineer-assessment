-- 0006_campaign_access.sql
-- Follow-ups to 0005_campaigns, found while testing the feature as an editor.
--
--   • A campaign's owner manages its members and artifacts. The reference RLS
--     shape lets only a row's owner (or an admin) update it, so an editor
--     couldn't record outcomes for members someone else added to their own
--     campaign. Member/artifact updates now also pass for the campaign owner.
--   • target_industries is constrained to the same list as the Zod schema
--     (src/lib/schemas/campaign.schema.ts), like every other option list.
--   • Orphaned uploads can be cleaned up: an editor may delete a Storage object
--     they uploaded ONLY while no artifact row references it. The artifacts UI
--     uses this to roll back an upload whose row insert failed; objects behind
--     real (even soft-deleted) artifacts stay forward-only.

-- True when the caller owns the campaign.
CREATE OR REPLACE FUNCTION public.owns_campaign(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id AND c.owner_id = public.current_app_user_id()
  )
$$;

DROP POLICY "campaign_members_owner_update" ON public.campaign_members;
CREATE POLICY "campaign_members_owner_update" ON public.campaign_members
  FOR UPDATE TO authenticated
  USING (
    owner_id = public.current_app_user_id() OR public.is_admin()
    OR public.owns_campaign(campaign_id)
  )
  WITH CHECK (
    owner_id = public.current_app_user_id() OR public.is_admin()
    OR public.owns_campaign(campaign_id)
  );

DROP POLICY "campaign_artifacts_owner_update" ON public.campaign_artifacts;
CREATE POLICY "campaign_artifacts_owner_update" ON public.campaign_artifacts
  FOR UPDATE TO authenticated
  USING (
    owner_id = public.current_app_user_id() OR public.is_admin()
    OR public.owns_campaign(campaign_id)
  )
  WITH CHECK (
    owner_id = public.current_app_user_id() OR public.is_admin()
    OR public.owns_campaign(campaign_id)
  );

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_target_industries_known CHECK (
    target_industries <@ ARRAY[
      'Salon', 'Spa', 'Med Spa', 'Massage', 'Nail Salon',
      'Barbershop', 'Lash & Brow', 'Wellness', 'Tattoo Studio'
    ]::text[]
  );

CREATE POLICY "campaign_artifacts_storage_delete_orphan" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-artifacts'
    AND public.is_editor()
    AND owner_id = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_artifacts a WHERE a.storage_path = storage.objects.name
    )
  );
