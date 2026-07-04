-- ===========================================================================
-- ATLAS 5.0 — fix-auth-ids.sql (FALLBACK ONLY)
-- ===========================================================================
-- WHEN TO USE:
--   Only if the direct auth.users insert in seed.sql failed on your Supabase
--   project (e.g. "permission denied for table users" or the test accounts
--   can't log in). In that case:
--
--     1. Delete the six seed rows from auth.users if any partially landed:
--          delete from auth.identities where user_id::text like 'd0000000%';
--          delete from auth.users      where id::text     like 'd0000000%';
--     2. Create the six users in Dashboard → Authentication → Add User
--        (check "Auto Confirm"), using EXACTLY these emails, password Atlas!2026:
--          superadmin@atlas.app, chief@anytownpd.gov, ia@anytownpd.gov,
--          training@anytownpd.gov, admin@anytownpd.gov, supervisor@anytownpd.gov
--     3. Run this script in the SQL Editor.
--
-- WHAT IT DOES:
--   For each email, finds the real auth UUID and remaps the seed profile row
--   (and every table that references it) from the placeholder d0000000-… UUID
--   to the real one. Safe to re-run: already-matching rows are skipped.
-- ===========================================================================

do $$
declare
  m record;
  new_id uuid;
begin
  for m in
    select * from (values
      ('superadmin@atlas.app',     'd0000000-0000-0000-0000-000000000001'::uuid),
      ('chief@anytownpd.gov',      'd0000000-0000-0000-0000-000000000002'::uuid),
      ('ia@anytownpd.gov',         'd0000000-0000-0000-0000-000000000003'::uuid),
      ('training@anytownpd.gov',   'd0000000-0000-0000-0000-000000000004'::uuid),
      ('admin@anytownpd.gov',      'd0000000-0000-0000-0000-000000000005'::uuid),
      ('supervisor@anytownpd.gov', 'd0000000-0000-0000-0000-000000000006'::uuid)
    ) as t(email, seed_id)
  loop
    select id into new_id from auth.users where email = m.email limit 1;

    if new_id is null then
      raise notice 'SKIP  %: no auth user found — create it in the dashboard first.', m.email;
      continue;
    end if;

    if new_id = m.seed_id then
      raise notice 'OK    %: already aligned (%).', m.email, new_id;
      continue;
    end if;

    if not exists (select 1 from profiles where id = m.seed_id) then
      raise notice 'SKIP  %: seed profile % not found (already remapped?).', m.email, m.seed_id;
      continue;
    end if;

    -- 1) Duplicate the profile under the real auth UUID (FK to auth.users now valid)
    insert into profiles (id, agency_id, role, full_name, email, rank_id, is_active, created_at)
    select new_id, agency_id, role, full_name, email, rank_id, is_active, created_at
    from profiles where id = m.seed_id;

    -- 2) Repoint every FK that references profiles(id)
    update supervisor_rosters    set supervisor_id = new_id where supervisor_id = m.seed_id;
    update bwc_reviews           set reviewer_id   = new_id where reviewer_id   = m.seed_id;
    update ia_cases              set opened_by     = new_id where opened_by     = m.seed_id;
    update ia_access_list        set profile_id    = new_id where profile_id    = m.seed_id;
    update ia_access_list        set granted_by    = new_id where granted_by    = m.seed_id;
    update pips                  set created_by    = new_id where created_by    = m.seed_id;
    update pip_access_list       set profile_id    = new_id where profile_id    = m.seed_id;
    update pip_access_list       set granted_by    = new_id where granted_by    = m.seed_id;
    update in_person_reviews     set supervisor_id = new_id where supervisor_id = m.seed_id;
    update auto_select_receipts  set supervisor_id = new_id where supervisor_id = m.seed_id;
    update access_requests       set decided_by    = new_id where decided_by    = m.seed_id;
    update trouble_tickets       set submitted_by  = new_id where submitted_by  = m.seed_id;
    update activity_log          set actor_id      = new_id where actor_id      = m.seed_id;

    -- 3) Remove the placeholder profile
    delete from profiles where id = m.seed_id;

    raise notice 'FIXED %: % -> %', m.email, m.seed_id, new_id;
  end loop;
end $$;

-- Verify: all six should show a real auth UUID and the right role
select p.email, p.role, p.agency_id, (u.id is not null) as auth_linked
from profiles p
left join auth.users u on u.id = p.id
where p.email in ('superadmin@atlas.app','chief@anytownpd.gov','ia@anytownpd.gov',
                  'training@anytownpd.gov','admin@anytownpd.gov','supervisor@anytownpd.gov')
order by p.role;
