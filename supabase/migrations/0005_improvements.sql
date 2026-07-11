-- mister-doc — Lot d'améliorations : tokens calendrier par médecin, notes de
-- jour, verrouillage de mois, réglages d'app, colonnes d'audit.

-- 1) Tokens calendrier révocables PAR MÉDECIN --------------------------------
alter table public.doctors add column if not exists calendar_token text unique;
update public.doctors
  set calendar_token = 'dcal_' || replace(gen_random_uuid()::text, '-', '')
  where calendar_token is null;

create or replace function public.my_calendar_token()
  returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.is_approved() then raise exception 'forbidden'; end if;
  select calendar_token into t from public.doctors where auth_id = auth.uid();
  if t is null then
    t := 'dcal_' || replace(gen_random_uuid()::text, '-', '');
    update public.doctors set calendar_token = t where auth_id = auth.uid();
  end if;
  return t;
end; $$;
grant execute on function public.my_calendar_token() to authenticated;

create or replace function public.rotate_calendar_token()
  returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.is_approved() then raise exception 'forbidden'; end if;
  t := 'dcal_' || replace(gen_random_uuid()::text, '-', '');
  update public.doctors set calendar_token = t where auth_id = auth.uid();
  return t;
end; $$;
grant execute on function public.rotate_calendar_token() to authenticated;

-- 2) Notes de jour (réunions, staff…) ----------------------------------------
create table if not exists public.day_notes (
  work_date  date primary key,
  note       text not null,
  created_by uuid references public.doctors (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.day_notes enable row level security;
drop policy if exists day_notes_all on public.day_notes;
create policy day_notes_all on public.day_notes
  for all to authenticated using (public.is_approved()) with check (public.is_approved());
drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

-- 3) Verrouillage de mois (admin) --------------------------------------------
create table if not exists public.locked_months (
  year      int not null,
  month     int not null check (month between 0 and 11), -- 0 = janvier (JS)
  locked_by uuid references public.doctors (id) on delete set null,
  locked_at timestamptz not null default now(),
  primary key (year, month)
);
alter table public.locked_months enable row level security;
drop policy if exists locked_select on public.locked_months;
create policy locked_select on public.locked_months
  for select to authenticated using (public.is_approved());
drop policy if exists locked_insert on public.locked_months;
create policy locked_insert on public.locked_months
  for insert to authenticated with check (public.is_admin());
drop policy if exists locked_delete on public.locked_months;
create policy locked_delete on public.locked_months
  for delete to authenticated using (public.is_admin());

-- Empêche toute écriture de garde/absence sur un mois verrouillé.
create or replace function public.assert_month_unlocked()
  returns trigger language plpgsql security definer set search_path = public as $$
declare d date;
begin
  d := coalesce(new.work_date, old.work_date);
  if exists (
    select 1 from public.locked_months lm
    where lm.year = extract(year from d)::int
      and lm.month = (extract(month from d)::int - 1)
  ) then
    raise exception 'Mois verrouillé : modification impossible.';
  end if;
  return coalesce(new, old);
end; $$;
drop trigger if exists shifts_lock_guard on public.shifts;
create trigger shifts_lock_guard before insert or update or delete on public.shifts
  for each row execute function public.assert_month_unlocked();
drop trigger if exists leaves_lock_guard on public.leaves;
create trigger leaves_lock_guard before insert or update or delete on public.leaves
  for each row execute function public.assert_month_unlocked();

-- 4) Réglages d'application (jsonb) ------------------------------------------
alter table public.app_config add column if not exists settings jsonb not null default '{}'::jsonb;

create or replace function public.get_settings()
  returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_approved()
    then (select settings from public.app_config where id = 1)
    else '{}'::jsonb end;
$$;
grant execute on function public.get_settings() to authenticated;

create or replace function public.set_settings(p jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare s jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.app_config set settings = coalesce(p, '{}'::jsonb) where id = 1
    returning settings into s;
  return s;
end; $$;
grant execute on function public.set_settings(jsonb) to authenticated;

-- 5) Audit : qui a modifié en dernier ----------------------------------------
alter table public.shifts add column if not exists updated_by uuid references public.doctors (id) on delete set null;
alter table public.leaves add column if not exists updated_by uuid references public.doctors (id) on delete set null;

-- 6) Realtime pour les nouvelles tables --------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.day_notes; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.locked_months; exception when duplicate_object then null; end;
  end if;
end; $$;
