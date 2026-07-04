-- ============================================================================
-- ATLAS 5 — schema.sql
-- Law enforcement BWC performance management platform.
-- Run FIRST in the Supabase SQL editor, then run seed.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role as enum
  ('super_admin','chief','internal_affairs','training_bureau','agency_admin','supervisor');

-- officer_status enum is used ONLY on personnel_roster.
-- Every other table uses an is_active boolean. Never conflate the two.
create type officer_status as enum ('active','inactive','terminated','on_leave');

create type review_outcome as enum
  ('no_action','commendation','coaching','training','internal_affairs','pip');

create type delta_t_status as enum ('open','closed');
create type ia_status      as enum ('open','under_investigation','closed','unfounded','sustained');
create type pip_status     as enum ('draft','active','completed','terminated');
create type ticket_status  as enum ('open','in_progress','resolved','closed');
create type request_status as enum ('pending','approved','denied');
create type content_kind   as enum ('incident_type','kpi','safety_item','disposition');

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

create table agencies (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  state                     text,
  address                   text,
  city                      text,
  zip                       text,
  phone                     text,
  website                   text,
  head_name                 text,
  head_title                text,
  head_email                text,
  head_phone                text,
  liaison_name              text,
  liaison_email             text,
  liaison_phone             text,
  agency_size               text,
  patch_url                 text,
  review_frequency          text default 'monthly',
  min_performance_threshold numeric not null default 80,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now()
);

-- profiles.id MUST equal auth.users.id. agency_id is NULL for super_admin by design.
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  agency_id  uuid references agencies(id),
  role       user_role not null,
  full_name  text not null,
  email      text not null,
  rank_id    uuid,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Rank structure per agency. Canonical name: agency_ranks (never "ranks").
create table agency_ranks (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references agencies(id),
  rank_name  text not null,
  rank_order integer not null default 0,
  is_active  boolean not null default true
);

alter table profiles
  add constraint profiles_rank_fk foreign key (rank_id) references agency_ranks(id);

-- Officers being reviewed (NOT app users). Uses the officer_status enum.
create table personnel_roster (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references agencies(id),
  first_name        text not null,
  last_name         text not null,
  badge_number      text,
  email             text,
  rank_id           uuid references agency_ranks(id),
  performance_score numeric,                        -- running average of review scores
  officer_status    officer_status not null default 'active',
  created_at        timestamptz not null default now()
);

-- A supervisor's roster is defined HERE, not by a column on personnel_roster.
create table supervisor_rosters (
  id            uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references profiles(id),
  officer_id    uuid not null references personnel_roster(id),
  created_at    timestamptz not null default now(),
  unique (supervisor_id, officer_id)
);

-- Content: agency_id NULL = global baseline owned by super_admin.
create table incident_types (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid references agencies(id),   -- NULL = baseline
  name              text not null,
  is_global_default boolean not null default false,
  is_active         boolean not null default true,
  sort_order        integer not null default 0
);

-- incident_type_id NULL = the universal_assessment set (shown on every review).
create table kpi_definitions (
  id               uuid primary key default gen_random_uuid(),
  incident_type_id uuid references incident_types(id),
  agency_id        uuid references agencies(id),    -- NULL = baseline
  kpi_text         text not null,
  sort_order       integer not null default 0,
  is_active        boolean not null default true
);

create table safety_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid references agencies(id),          -- NULL = baseline
  item_text  text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- Dispositions are DB-driven, never hardcoded. Codes are stable identifiers.
create table disposition_types (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid references agencies(id),          -- NULL = baseline
  code       text not null,
  label      text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- Shared-baseline model: agencies suppress (never fork/delete) baseline items.
create table content_suppressions (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies(id),
  content_type content_kind not null,
  content_id   uuid not null,
  created_at   timestamptz not null default now(),
  unique (agency_id, content_type, content_id)
);

-- Per-agency, per-year counter used to generate ATLAS case numbers.
create table atlas_case_counters (
  agency_id uuid not null references agencies(id),
  yr        integer not null,
  counter   integer not null default 0,
  primary key (agency_id, yr)
);

-- The core record.
create table bwc_reviews (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references agencies(id),
  atlas_case_number  text not null,                 -- e.g. ATL-2026-00042 (trigger)
  police_case_number text,
  reviewer_id        uuid not null references profiles(id),
  primary_officer_id uuid not null references personnel_roster(id),
  backup_officer_ids uuid[] not null default '{}',  -- documentation only, no score impact
  review_date        date not null default current_date,
  incident_date      date,
  recording_start    time,
  recording_end      time,
  loc_street         text,
  loc_apt            text,
  loc_floor          text,
  loc_city           text,
  loc_state          text,
  incident_type_id   uuid references incident_types(id),
  kpi_responses      jsonb not null default '{}',   -- {kpi_id:'observed'|'not_observed'|'na', universal_assessment:kpi_id}
  safety_checklist   jsonb not null default '{}',   -- {item_id:true}
  dispositions       text[] not null default '{}',  -- disposition codes
  kpi_score          numeric,                       -- observed/(observed+not_observed), N/A excluded
  follow_up_outcome  review_outcome not null default 'no_action',
  is_ia_referral     boolean not null default false,
  internal_notes     text,                          -- confidential, never printed
  report_notes       text,                          -- printed, goes in officer's file
  status             text not null default 'approved',
  created_at         timestamptz not null default now()
);

-- Delta T intervention tracking. T1 observed → T2 trained → T4 verified.
create table delta_t_cases (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references agencies(id),
  officer_id            uuid not null references personnel_roster(id),
  kpi_id                uuid not null references kpi_definitions(id),
  source_review_id      uuid references bwc_reviews(id),
  status                delta_t_status not null default 'open',
  t1_incident_date      date not null,
  t2_training_delivered date,
  t4_verification_date  date,
  verification_review_id uuid references bwc_reviews(id),
  created_at            timestamptz not null default now()
);

create table training_assignments (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies(id),
  delta_t_case_id uuid references delta_t_cases(id),
  officer_id      uuid not null references personnel_roster(id),
  course          text not null,
  description     text,
  assigned_date   date not null default current_date,
  date_delivered  date,
  notes           text,
  created_at      timestamptz not null default now()
);

create table ia_cases (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references agencies(id),
  officer_id       uuid not null references personnel_roster(id),
  source_review_id uuid references bwc_reviews(id),
  case_number      text not null,
  status           ia_status not null default 'open',
  opened_by        uuid references profiles(id),
  notes            text,
  created_at       timestamptz not null default now()
);

create table ia_access_list (
  id         uuid primary key default gen_random_uuid(),
  ia_case_id uuid not null references ia_cases(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (ia_case_id, profile_id)
);

create table pips (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references agencies(id),
  officer_id     uuid not null references personnel_roster(id),
  status         pip_status not null default 'draft',
  start_date     date,
  end_date       date,
  objectives     text,
  linked_reviews uuid[] not null default '{}',
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);

create table pip_access_list (
  id         uuid primary key default gen_random_uuid(),
  pip_id     uuid not null references pips(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (pip_id, profile_id)
);

create table in_person_reviews (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies(id),
  supervisor_id uuid not null references profiles(id),
  officer_id    uuid not null references personnel_roster(id),
  session_date  date not null,
  topic         text,
  notes         text,
  completed     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- PERMANENT audit trail. No update/delete policies exist — receipts are forever.
create table auto_select_receipts (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references agencies(id),
  supervisor_id      uuid not null references profiles(id),
  officer_id         uuid not null references personnel_roster(id),
  incident_type_id   uuid references incident_types(id),
  incident_type_name text,
  priority_level     text,          -- tier: critical / elevated / standard
  selection_weight   numeric,
  methodology_notes  text,          -- full formula text
  created_at         timestamptz not null default now()
);

create table access_requests (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid references agencies(id),
  agency_name    text,
  full_name      text not null,
  email          text not null,
  requested_role user_role,
  message        text,
  status         request_status not null default 'pending',
  decided_by     uuid references profiles(id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- Canonical name: trouble_tickets (never "support_tickets").
create table trouble_tickets (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid references agencies(id),
  submitted_by uuid references profiles(id),
  subject     text not null,
  description text,
  priority    text default 'normal',
  status      ticket_status not null default 'open',
  resolution  text,
  created_at  timestamptz not null default now()
);

-- Append-only audit. No update/delete policies exist.
create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid references agencies(id),
  actor_id    uuid references profiles(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Agency setting: may supervisors review officers of equal rank?
create table same_rank_permissions (
  agency_id       uuid primary key references agencies(id),
  allow_same_rank boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER HELPERS
-- Mandatory: plain functions cause circular RLS loops (policy on profiles
-- would evaluate a query that itself hits the profiles policy).
-- ---------------------------------------------------------------------------
create or replace function get_my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function get_my_agency_id()
returns uuid language sql stable security definer set search_path = public as $$
  select agency_id from profiles where id = auth.uid();
$$;

create or replace function is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin');
$$;

-- True if the given officer is on the calling supervisor's roster.
create or replace function officer_on_my_roster(p_officer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from supervisor_rosters
    where supervisor_id = auth.uid() and officer_id = p_officer
  );
$$;

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

-- Auto-generate ATLAS case number: ATL-YYYY-NNNNN (per agency, per year).
create or replace function gen_atlas_case_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_yr int := extract(year from coalesce(new.review_date, current_date))::int;
  v_n  int;
begin
  insert into atlas_case_counters (agency_id, yr, counter)
  values (new.agency_id, v_yr, 1)
  on conflict (agency_id, yr) do update set counter = atlas_case_counters.counter + 1
  returning counter into v_n;
  new.atlas_case_number := 'ATL-' || v_yr || '-' || lpad(v_n::text, 5, '0');
  return new;
end $$;

create trigger trg_atlas_case_number
  before insert on bwc_reviews
  for each row when (new.atlas_case_number is null or new.atlas_case_number = '')
  execute function gen_atlas_case_number();

-- Keep personnel_roster.performance_score = running average of that officer's
-- approved review scores. Runs as definer so reviewers don't need roster UPDATE.
create or replace function refresh_officer_score()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update personnel_roster p
     set performance_score = sub.avg_score
    from (select round(avg(kpi_score)::numeric, 1) as avg_score
            from bwc_reviews
           where primary_officer_id = new.primary_officer_id
             and status = 'approved' and kpi_score is not null) sub
   where p.id = new.primary_officer_id;
  return new;
end $$;

create trigger trg_refresh_officer_score
  after insert or update of kpi_score on bwc_reviews
  for each row execute function refresh_officer_score();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table agencies               enable row level security;
alter table profiles               enable row level security;
alter table agency_ranks           enable row level security;
alter table personnel_roster       enable row level security;
alter table supervisor_rosters     enable row level security;
alter table incident_types         enable row level security;
alter table kpi_definitions        enable row level security;
alter table safety_checklist_items enable row level security;
alter table disposition_types      enable row level security;
alter table content_suppressions   enable row level security;
alter table atlas_case_counters    enable row level security;
alter table bwc_reviews            enable row level security;
alter table delta_t_cases          enable row level security;
alter table training_assignments   enable row level security;
alter table ia_cases               enable row level security;
alter table ia_access_list         enable row level security;
alter table pips                   enable row level security;
alter table pip_access_list        enable row level security;
alter table in_person_reviews      enable row level security;
alter table auto_select_receipts   enable row level security;
alter table access_requests        enable row level security;
alter table trouble_tickets        enable row level security;
alter table activity_log           enable row level security;
alter table same_rank_permissions  enable row level security;

-- agencies -------------------------------------------------------------------
create policy agencies_super_all on agencies
  for all using (is_super_admin()) with check (is_super_admin());
create policy agencies_member_select on agencies
  for select using (id = get_my_agency_id());
create policy agencies_admin_update on agencies
  for update using (id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (id = get_my_agency_id());

-- profiles -------------------------------------------------------------------
create policy profiles_self_select on profiles
  for select using (id = auth.uid());
create policy profiles_agency_select on profiles
  for select using (agency_id is not null and agency_id = get_my_agency_id());
create policy profiles_super_all on profiles
  for all using (is_super_admin()) with check (is_super_admin());
create policy profiles_admin_manage on profiles
  for update using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id());
create policy profiles_admin_insert on profiles
  for insert with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');
create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- agency_ranks ---------------------------------------------------------------
create policy ranks_super_all on agency_ranks
  for all using (is_super_admin()) with check (is_super_admin());
create policy ranks_member_select on agency_ranks
  for select using (agency_id = get_my_agency_id());
create policy ranks_admin_manage on agency_ranks
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

-- personnel_roster -----------------------------------------------------------
create policy roster_super_all on personnel_roster
  for all using (is_super_admin()) with check (is_super_admin());
create policy roster_member_select on personnel_roster
  for select using (agency_id = get_my_agency_id());
create policy roster_admin_manage on personnel_roster
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

-- supervisor_rosters ----------------------------------------------------------
create policy sr_super_all on supervisor_rosters
  for all using (is_super_admin()) with check (is_super_admin());
create policy sr_own_manage on supervisor_rosters
  for all using (supervisor_id = auth.uid()) with check (supervisor_id = auth.uid());
create policy sr_agency_select on supervisor_rosters
  for select using (
    get_my_role() in ('chief','internal_affairs','training_bureau','agency_admin')
    and exists (select 1 from profiles pr where pr.id = supervisor_id and pr.agency_id = get_my_agency_id())
  );

-- content tables (baseline visible to everyone authenticated; agency layer scoped)
create policy it_select on incident_types
  for select using (agency_id is null or agency_id = get_my_agency_id() or is_super_admin());
create policy it_super_manage on incident_types
  for all using (is_super_admin()) with check (is_super_admin());
create policy it_admin_manage on incident_types
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

create policy kpi_select on kpi_definitions
  for select using (agency_id is null or agency_id = get_my_agency_id() or is_super_admin());
create policy kpi_super_manage on kpi_definitions
  for all using (is_super_admin()) with check (is_super_admin());
create policy kpi_admin_manage on kpi_definitions
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

create policy safety_select on safety_checklist_items
  for select using (agency_id is null or agency_id = get_my_agency_id() or is_super_admin());
create policy safety_super_manage on safety_checklist_items
  for all using (is_super_admin()) with check (is_super_admin());
create policy safety_admin_manage on safety_checklist_items
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

create policy disp_select on disposition_types
  for select using (agency_id is null or agency_id = get_my_agency_id() or is_super_admin());
create policy disp_super_manage on disposition_types
  for all using (is_super_admin()) with check (is_super_admin());
create policy disp_admin_manage on disposition_types
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

-- content_suppressions ---------------------------------------------------------
create policy sup_super_all on content_suppressions
  for all using (is_super_admin()) with check (is_super_admin());
create policy sup_member_select on content_suppressions
  for select using (agency_id = get_my_agency_id());
create policy sup_admin_manage on content_suppressions
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

-- atlas_case_counters: touched only by the SECURITY DEFINER trigger.
create policy counters_super_select on atlas_case_counters
  for select using (is_super_admin());

-- bwc_reviews ------------------------------------------------------------------
create policy rev_super_select on bwc_reviews
  for select using (is_super_admin());
create policy rev_agency_roles_select on bwc_reviews
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs','training_bureau')
  );
create policy rev_supervisor_select on bwc_reviews
  for select using (
    agency_id = get_my_agency_id() and get_my_role() = 'supervisor'
    and (reviewer_id = auth.uid() or officer_on_my_roster(primary_officer_id))
  );
create policy rev_author_insert on bwc_reviews
  for insert with check (
    agency_id = get_my_agency_id()
    and reviewer_id = auth.uid()
    and get_my_role() in ('internal_affairs','training_bureau','supervisor')
  );

-- delta_t_cases ----------------------------------------------------------------
create policy dt_super_select on delta_t_cases
  for select using (is_super_admin());
create policy dt_agency_select on delta_t_cases
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs','training_bureau')
  );
create policy dt_supervisor_select on delta_t_cases
  for select using (
    agency_id = get_my_agency_id() and get_my_role() = 'supervisor'
    and officer_on_my_roster(officer_id)
  );
create policy dt_author_insert on delta_t_cases
  for insert with check (
    agency_id = get_my_agency_id()
    and get_my_role() in ('internal_affairs','training_bureau','supervisor')
  );
create policy dt_manage_update on delta_t_cases
  for update using (
    agency_id = get_my_agency_id()
    and (get_my_role() in ('internal_affairs','training_bureau')
         or (get_my_role() = 'supervisor' and officer_on_my_roster(officer_id)))
  ) with check (agency_id = get_my_agency_id());

-- training_assignments -----------------------------------------------------------
create policy ta_super_select on training_assignments
  for select using (is_super_admin());
create policy ta_agency_select on training_assignments
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs','training_bureau')
  );
create policy ta_supervisor_select on training_assignments
  for select using (
    agency_id = get_my_agency_id() and get_my_role() = 'supervisor'
    and officer_on_my_roster(officer_id)
  );
create policy ta_insert on training_assignments
  for insert with check (
    agency_id = get_my_agency_id()
    and get_my_role() in ('internal_affairs','training_bureau','supervisor')
  );
create policy ta_update on training_assignments
  for update using (
    agency_id = get_my_agency_id()
    and (get_my_role() in ('internal_affairs','training_bureau')
         or (get_my_role() = 'supervisor' and officer_on_my_roster(officer_id)))
  ) with check (agency_id = get_my_agency_id());

-- ia_cases: invisible to supervisors and training_bureau. Named grants extend.
create policy ia_super_select on ia_cases
  for select using (is_super_admin());
create policy ia_role_select on ia_cases
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs')
  );
create policy ia_named_select on ia_cases
  for select using (
    exists (select 1 from ia_access_list al
            where al.ia_case_id = ia_cases.id and al.profile_id = auth.uid())
  );
-- Any reviewer may INSERT (auto-created on IA referral) but selection is denied
-- to the submitting supervisor afterward — that is the "loses visibility" rule.
create policy ia_referral_insert on ia_cases
  for insert with check (
    agency_id = get_my_agency_id()
    and get_my_role() in ('internal_affairs','training_bureau','supervisor')
  );
create policy ia_manage_update on ia_cases
  for update using (
    (agency_id = get_my_agency_id() and get_my_role() = 'internal_affairs')
    or is_super_admin()
  ) with check (true);

create policy ial_manage on ia_access_list
  for all using (
    is_super_admin()
    or exists (select 1 from ia_cases c where c.id = ia_case_id
               and c.agency_id = get_my_agency_id()
               and get_my_role() in ('internal_affairs','chief'))
  ) with check (
    is_super_admin()
    or exists (select 1 from ia_cases c where c.id = ia_case_id
               and c.agency_id = get_my_agency_id()
               and get_my_role() in ('internal_affairs','chief'))
  );
create policy ial_self_select on ia_access_list
  for select using (profile_id = auth.uid());

-- pips ---------------------------------------------------------------------------
create policy pip_super_select on pips
  for select using (is_super_admin());
create policy pip_role_select on pips
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs','training_bureau')
  );
create policy pip_supervisor_select on pips
  for select using (
    agency_id = get_my_agency_id() and get_my_role() = 'supervisor'
    and officer_on_my_roster(officer_id)
  );
create policy pip_named_select on pips
  for select using (
    exists (select 1 from pip_access_list al
            where al.pip_id = pips.id and al.profile_id = auth.uid())
  );
create policy pip_insert on pips
  for insert with check (
    agency_id = get_my_agency_id()
    and get_my_role() in ('internal_affairs','training_bureau','supervisor')
  );
create policy pip_update on pips
  for update using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('internal_affairs','training_bureau')
  ) with check (agency_id = get_my_agency_id());

create policy pal_manage on pip_access_list
  for all using (
    is_super_admin()
    or exists (select 1 from pips p where p.id = pip_id
               and p.agency_id = get_my_agency_id()
               and get_my_role() in ('internal_affairs','training_bureau','chief'))
  ) with check (
    is_super_admin()
    or exists (select 1 from pips p where p.id = pip_id
               and p.agency_id = get_my_agency_id()
               and get_my_role() in ('internal_affairs','training_bureau','chief'))
  );
create policy pal_self_select on pip_access_list
  for select using (profile_id = auth.uid());

-- in_person_reviews ----------------------------------------------------------------
create policy ipr_super_select on in_person_reviews
  for select using (is_super_admin());
create policy ipr_agency_select on in_person_reviews
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs','training_bureau')
  );
create policy ipr_supervisor_all on in_person_reviews
  for all using (
    agency_id = get_my_agency_id() and supervisor_id = auth.uid()
  ) with check (agency_id = get_my_agency_id() and supervisor_id = auth.uid());
create policy ipr_super_insert on in_person_reviews
  for insert with check (is_super_admin());

-- auto_select_receipts: PERMANENT — no update/delete policies exist, ever.
create policy asr_super_select on auto_select_receipts
  for select using (is_super_admin());
create policy asr_agency_select on auto_select_receipts
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','internal_affairs','training_bureau','agency_admin')
  );
create policy asr_supervisor_select on auto_select_receipts
  for select using (supervisor_id = auth.uid());
create policy asr_supervisor_insert on auto_select_receipts
  for insert with check (
    supervisor_id = auth.uid()
    and agency_id = get_my_agency_id()
    and get_my_role() = 'supervisor'
  );

-- access_requests: public signup form may insert; admins triage.
create policy ar_public_insert on access_requests
  for insert to anon, authenticated with check (status = 'pending');
create policy ar_super_all on access_requests
  for all using (is_super_admin()) with check (is_super_admin());
create policy ar_admin_select on access_requests
  for select using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');
create policy ar_admin_update on access_requests
  for update using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id());

-- trouble_tickets ---------------------------------------------------------------
create policy tt_super_all on trouble_tickets
  for all using (is_super_admin()) with check (is_super_admin());
create policy tt_admin_select on trouble_tickets
  for select using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');
create policy tt_admin_insert on trouble_tickets
  for insert with check (
    agency_id = get_my_agency_id() and get_my_role() = 'agency_admin'
    and submitted_by = auth.uid()
  );
create policy tt_admin_update on trouble_tickets
  for update using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id());

-- activity_log: append-only. No update/delete policies exist.
create policy al_insert on activity_log
  for insert with check (
    actor_id = auth.uid()
    and (agency_id is null or agency_id = get_my_agency_id() or is_super_admin())
  );
create policy al_super_select on activity_log
  for select using (is_super_admin());
create policy al_agency_select on activity_log
  for select using (
    agency_id = get_my_agency_id()
    and get_my_role() in ('chief','agency_admin')
  );

-- same_rank_permissions -----------------------------------------------------------
create policy srp_super_all on same_rank_permissions
  for all using (is_super_admin()) with check (is_super_admin());
create policy srp_member_select on same_rank_permissions
  for select using (agency_id = get_my_agency_id());
create policy srp_admin_manage on same_rank_permissions
  for all using (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin')
  with check (agency_id = get_my_agency_id() and get_my_role() = 'agency_admin');

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index idx_profiles_agency          on profiles(agency_id);
create index idx_roster_agency            on personnel_roster(agency_id);
create index idx_sr_supervisor            on supervisor_rosters(supervisor_id);
create index idx_reviews_agency           on bwc_reviews(agency_id, review_date desc);
create index idx_reviews_officer          on bwc_reviews(primary_officer_id);
create index idx_reviews_reviewer         on bwc_reviews(reviewer_id);
create index idx_dt_agency_status         on delta_t_cases(agency_id, status);
create index idx_dt_officer_kpi           on delta_t_cases(officer_id, kpi_id, status);
create index idx_kpi_type                 on kpi_definitions(incident_type_id);
create index idx_receipts_supervisor      on auto_select_receipts(supervisor_id, created_at desc);
create index idx_activity_agency          on activity_log(agency_id, created_at desc);
-- ============================================================================
-- END schema.sql
-- ============================================================================
