-- seed.sql — synthetic data only. No real/customer data.
--
-- Creates three app users (Admin / Editor / Viewer) in BOTH auth.users and
-- public.users (the app id is carried in the JWT via app_metadata.app_user_id,
-- mirroring how the app links the two ids at login), then generates a demo
-- book of ~100 salon/spa/wellness companies with contacts.
--
-- Log in with:  admin@example.com  /  password123
--
-- NOTE: when you insert test users yourself (in tests), set BOTH
-- public.users.id AND public.users.auth_id — without auth_id the
-- is_admin()/is_editor() fallback lookup fails and RLS writes are blocked.

DO $$
DECLARE
  admin_auth  UUID := '00000000-0000-0000-0000-0000000000a1';
  editor_auth UUID := '00000000-0000-0000-0000-0000000000a2';
  viewer_auth UUID := '00000000-0000-0000-0000-0000000000a3';
  admin_app   UUID := '00000000-0000-0000-0000-0000000000b1';
  editor_app  UUID := '00000000-0000-0000-0000-0000000000b2';
  viewer_app  UUID := '00000000-0000-0000-0000-0000000000b3';
  r RECORD;

  -- Name parts for the generator. Larger pools + varied templates so names
  -- don't cluster.
  adjectives TEXT[] := ARRAY['Serene','Golden','Luxe','Urban','Coastal','Radiant','Velvet','Willow','Lotus','Gilded','Azure','Ember','Marble','Opal','Sable','Dewy','Lush','Noble','Bright','Bloom','Hazel','Indigo','Crimson','Mint','Amber','Pearl'];
  nouns      TEXT[] := ARRAY['Oak','Petal','Harbor','Sage','Ivory','Aura','Haven','Maple','Juniper','Birch','Fern','Dune','Reed','Cove','Grove','Lark','Wren','Thistle','Poppy','Cedar','Jade','Onyx','Meadow','Linden','Hollow','Bramble'];
  places     TEXT[] := ARRAY['Highland','Riverside','Marina','Old Town','Parkside','Midtown','Lakeview','Sunset','Harborview','Bayshore','Cedar Hill','North End','Grandview','Brookside','Fairview','Westgate','Kingsley','Ashford','Belmont','Clifton'];
  types      TEXT[] := ARRAY['Salon','Day Spa','Massage Studio','Med Spa','Nail Bar','Barbershop','Lash & Brow Studio','Wellness Studio','Skin Clinic','Hair Studio'];
  inds       TEXT[] := ARRAY['Salon','Spa','Massage','Med Spa','Nail Salon','Barbershop','Lash & Brow','Wellness','Med Spa','Salon'];
  firsts     TEXT[] := ARRAY['Ava','Liam','Mia','Noah','Sofia','Ethan','Isla','Lucas','Maya','Leo','Nora','Owen','Ruby','Kai','Elena','Jonah','Priya','Diego','Hana','Theo','Zoe','Omar','Lena','Max','Camila','Arjun','Freya','Malik','Yuki','Rosa','Ivan','Tara','Sam','Nia','Felix','Aisha','Bruno','Grace','Hugo','Lila'];
  lasts      TEXT[] := ARRAY['Rivera','Chen','Patel','Nguyen','Okafor','Silva','Kim','Haddad','Russo','Flores','Walsh','Ahmed','Costa','Jensen','Park','Moreno','Singh','Dubois','Romano','Weber','Larsen','Mori','Khan','Reyes','Novak','Bianchi','Hassan','Lindqvist','Tanaka','Mendez','Fischer','Abara','Kowalski','Serrano','Ivanov','Petit','Haas','Osei','Vargas','Bauer'];
  titles     TEXT[] := ARRAY['Owner','Co-Owner','General Manager','Front Desk Lead','Lead Stylist','Esthetician','Massage Therapist','Nail Technician','Barber','Spa Director'];

  i INT;
  k INT;
  j INT;
  n_contacts INT;
  cc INT := 0;
  cname TEXT;
  slug TEXT;
  website TEXT;
  industry TEXT;
  fname TEXT;
  lname TEXT;
  type_idx INT;
  a INT; b INT; b2 INT; p INT; s INT;
  seen TEXT[] := '{}';
  base TEXT; attempt INT; m INT;
  new_company UUID;
  new_contact UUID;
  company_ids UUID[] := '{}';
  contact_ids UUID[] := '{}';
  contact_primary UUID[] := '{}';
  target UUID;
BEGIN
  -- auth.users + auth.identities for each seeded user.
  FOR r IN
    SELECT * FROM (VALUES
      (admin_auth,  admin_app,  'admin@example.com',  'Avery Admin'),
      (editor_auth, editor_app, 'editor@example.com', 'Evan Editor'),
      (viewer_auth, viewer_app, 'viewer@example.com', 'Vera Viewer')
    ) AS t(auth_id, app_id, email, name)
  LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      -- GoTrue scans these token columns into Go strings and errors on NULL
      -- ("Database error querying schema" at login). Direct auth.users inserts
      -- MUST set them to '' rather than leaving them NULL.
      confirmation_token, recovery_token, email_change, email_change_token_new,
      phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      r.auth_id, 'authenticated', 'authenticated', r.email,
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'app_user_id', r.app_id),
      jsonb_build_object('name', r.name),
      '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) VALUES (
      r.auth_id, r.auth_id,
      jsonb_build_object('sub', r.auth_id::text, 'email', r.email),
      'email', now(), now()
    );
  END LOOP;

  INSERT INTO public.users (id, auth_id, email, name, role, login_enabled) VALUES
    (admin_app,  admin_auth,  'admin@example.com',  'Avery Admin',  'Admin',  true),
    (editor_app, editor_auth, 'editor@example.com', 'Evan Editor',  'Editor', true),
    (viewer_app, viewer_auth, 'viewer@example.com', 'Vera Viewer',  'Viewer', true);

  -- 100 companies, each with 1–3 contacts (the first is primary at that company).
  FOR i IN 0..99 LOOP
    -- Spread pool picks with different strides so neighbours don't cluster.
    type_idx := ((i * 3) % 10) + 1;
    a  := (i * 7) % array_length(adjectives, 1);
    b  := (i * 11) % array_length(nouns, 1);
    b2 := (i * 5 + 3) % array_length(nouns, 1);
    IF b2 = b THEN b2 := (b2 + 1) % array_length(nouns, 1); END IF;
    p  := (i * 13) % array_length(places, 1);
    s  := (i * 17) % array_length(lasts, 1);
    industry := inds[type_idx];

    -- Five naming templates for structural variety.
    CASE i % 5
      WHEN 0 THEN cname := adjectives[a + 1] || ' ' || nouns[b + 1] || ' ' || types[type_idx];
      WHEN 1 THEN cname := places[p + 1] || ' ' || types[type_idx];
      WHEN 2 THEN cname := nouns[b + 1] || ' & ' || nouns[b2 + 1] || ' ' || types[type_idx];
      WHEN 3 THEN cname := lasts[s + 1] || ' ' || types[type_idx];
      ELSE cname := 'The ' || adjectives[a + 1] || ' ' || nouns[b + 1];
    END CASE;

    -- Keep names unique: on collision, add a neighbourhood tag (chain-location
    -- style), trying successive places until distinct.
    base := cname;
    attempt := 0;
    WHILE cname = ANY (seen) LOOP
      cname := base || ' (' || places[((p + attempt) % array_length(places, 1)) + 1] || ')';
      attempt := attempt + 1;
      IF attempt > array_length(places, 1) THEN
        cname := base || ' #' || (i + 1);
        EXIT;
      END IF;
    END LOOP;
    seen := array_append(seen, cname);

    slug := regexp_replace(regexp_replace(lower(cname), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g');
    website := 'https://' || slug || '.example';

    INSERT INTO public.companies (name, website, industry, owner_id, created_by, updated_by)
    VALUES (cname, website, industry, admin_app, admin_app, admin_app)
    RETURNING id INTO new_company;
    company_ids := array_append(company_ids, new_company);

    n_contacts := 1 + (i % 3); -- 1, 2, or 3
    FOR k IN 0..(n_contacts - 1) LOOP
      cc := cc + 1;
      -- Walk a first×last grid via one coprime stride so (first,last) pairs stay
      -- distinct across all contacts (not just first OR last).
      m := (cc * 37) % (array_length(firsts, 1) * array_length(lasts, 1));
      fname := firsts[(m % array_length(firsts, 1)) + 1];
      lname := lasts[((m / array_length(firsts, 1)) % array_length(lasts, 1)) + 1];
      INSERT INTO public.contacts (first_name, last_name, email, title, owner_id, created_by, updated_by)
      VALUES (
        fname, lname,
        lower(fname) || '.' || lower(lname) || '@' || slug || '.example',
        titles[((cc * 3) % array_length(titles, 1)) + 1],
        admin_app, admin_app, admin_app
      )
      RETURNING id INTO new_contact;
      contact_ids := array_append(contact_ids, new_contact);
      contact_primary := array_append(contact_primary, new_company);

      INSERT INTO public.contact_companies (contact_id, company_id, is_primary, owner_id, created_by, updated_by)
      VALUES (new_contact, new_company, (k = 0), admin_app, admin_app, admin_app);
    END LOOP;
  END LOOP;

  -- Give some contacts a second (non-primary) company, to show the many-to-many.
  FOR j IN 1..array_length(contact_ids, 1) LOOP
    IF j % 6 = 0 THEN
      target := company_ids[((j * 13 + 7) % array_length(company_ids, 1)) + 1];
      IF target <> contact_primary[j] THEN
        BEGIN
          INSERT INTO public.contact_companies (contact_id, company_id, is_primary, owner_id, created_by, updated_by)
          VALUES (contact_ids[j], target, false, admin_app, admin_app, admin_app);
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Demo marketing campaigns. Members are pulled from the generated book by
-- industry; outcomes cycle through a fixed pattern so each campaign shows a
-- realistic funnel (more sent than opened, more opened than converted).
-- The editor owns two of them, so signing in as editor@ shows campaigns you
-- can manage (owner-or-admin RLS) next to ones that are read-only for you.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  admin_app  UUID := '00000000-0000-0000-0000-0000000000b1';
  editor_app UUID := '00000000-0000-0000-0000-0000000000b2';
  july_id   UUID;
  medspa_id UUID;
  mailer_id UUID;
  spring_id UUID;
BEGIN
  INSERT INTO public.campaigns
    (name, type, status, audience, occasion, purpose, target_industries, start_date, end_date,
     owner_id, created_by, updated_by)
  VALUES
    ('4th of July Booking Boost', 'Email', 'Completed', 'External', '4th of July Sale',
     'Win new salons and barbershops by offering two free months of online booking ahead of the holiday rush. Success = a booked demo.',
     ARRAY['Salon', 'Barbershop'], '2026-06-20', '2026-07-05', admin_app, admin_app, admin_app)
  RETURNING id INTO july_id;

  INSERT INTO public.campaigns
    (name, type, status, audience, occasion, purpose, target_industries, start_date, end_date,
     owner_id, created_by, updated_by)
  VALUES
    ('Marketing Suite Add-On for Med Spas', 'Email', 'Active', 'Internal', NULL,
     'Upsell existing med spa and spa customers onto the Marketing Suite add-on (automated rebooking reminders + review requests). Success = add-on activated.',
     ARRAY['Med Spa', 'Spa'], '2026-09-15', '2026-10-31', editor_app, editor_app, editor_app)
  RETURNING id INTO medspa_id;

  INSERT INTO public.campaigns
    (name, type, status, audience, occasion, purpose, target_industries, start_date, end_date,
     owner_id, created_by, updated_by)
  VALUES
    ('Holiday Gift Card Mailer', 'Direct Mail', 'Draft', 'External', 'Holiday Season',
     'Postcard to nail, lash and wellness studios showing how digital gift cards drive holiday revenue, with a QR code to sign up.',
     ARRAY['Nail Salon', 'Lash & Brow', 'Wellness'], '2026-11-15', '2026-12-20', editor_app, editor_app, editor_app)
  RETURNING id INTO mailer_id;

  INSERT INTO public.campaigns
    (name, type, status, audience, occasion, purpose, target_industries, start_date, end_date,
     owner_id, created_by, updated_by)
  VALUES
    ('Spring Wellness Text Reminder', 'SMS', 'Completed', 'Internal', 'Spring Reset',
     'Remind existing massage and wellness customers to turn on SMS appointment reminders before the spring season.',
     ARRAY['Massage', 'Wellness'], '2026-03-01', '2026-03-15', admin_app, admin_app, admin_app)
  RETURNING id INTO spring_id;

  -- 4th of July: company-level members.
  INSERT INTO public.campaign_members (campaign_id, company_id, status, owner_id, created_by, updated_by)
  SELECT july_id, co.id,
    (ARRAY['Sent', 'Opened', 'Opened', 'Responded', 'Converted', 'Sent', 'Bounced', 'Opened', 'Converted', 'Sent'])
      [((row_number() OVER (ORDER BY co.name)) - 1) % 10 + 1],
    admin_app, admin_app, admin_app
  FROM public.companies co
  WHERE co.industry IN ('Salon', 'Barbershop') AND co.deleted_at IS NULL;

  -- Med spa upsell (in flight): everyone whose primary company is a med spa / spa.
  INSERT INTO public.campaign_members (campaign_id, company_id, contact_id, status, owner_id, created_by, updated_by)
  SELECT medspa_id, cc.company_id, cc.contact_id,
    (ARRAY['Opened', 'Sent', 'Responded', 'Opened', 'Converted', 'Targeted', 'Sent', 'Opened'])
      [((row_number() OVER (ORDER BY ct.first_name, ct.last_name)) - 1) % 8 + 1],
    editor_app, editor_app, editor_app
  FROM public.contact_companies cc
  JOIN public.companies co ON co.id = cc.company_id
  JOIN public.contacts ct  ON ct.id = cc.contact_id
  WHERE cc.is_primary AND cc.deleted_at IS NULL AND co.industry IN ('Med Spa', 'Spa');

  -- Holiday mailer (draft): target list only, nothing sent yet.
  INSERT INTO public.campaign_members (campaign_id, company_id, status, owner_id, created_by, updated_by)
  SELECT mailer_id, co.id, 'Targeted', editor_app, editor_app, editor_app
  FROM public.companies co
  WHERE co.industry IN ('Nail Salon', 'Lash & Brow', 'Wellness') AND co.deleted_at IS NULL;

  -- Spring SMS: everyone whose primary company is a massage / wellness studio.
  INSERT INTO public.campaign_members (campaign_id, company_id, contact_id, status, owner_id, created_by, updated_by)
  SELECT spring_id, cc.company_id, cc.contact_id,
    (ARRAY['Responded', 'Sent', 'Converted', 'Responded', 'Bounced', 'Converted'])
      [((row_number() OVER (ORDER BY ct.first_name, ct.last_name)) - 1) % 6 + 1],
    admin_app, admin_app, admin_app
  FROM public.contact_companies cc
  JOIN public.companies co ON co.id = cc.company_id
  JOIN public.contacts ct  ON ct.id = cc.contact_id
  WHERE cc.is_primary AND cc.deleted_at IS NULL AND co.industry IN ('Massage', 'Wellness');
END $$;
