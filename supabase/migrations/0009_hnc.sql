-- mister-doc — Heures Non Cliniques (HNC), ex-« S3 »
-- ---------------------------------------------------------------------------
-- S3 n'est plus un créneau de garde à occupant unique : ce sont des HEURES NON
-- CLINIQUES qu'UN OU PLUSIEURS médecins saisissent librement (nombre d'heures
-- propre à chacun), N'IMPORTE QUEL JOUR (y compris week-ends/fériés), et qui NE
-- font PAS partie de la couverture « à couvrir ». On les modélise comme les
-- congés/formations : une table dédiée `hnc_hours` (1 entrée par médecin et par
-- jour), édition partagée entre médecins approuvés.
-- ---------------------------------------------------------------------------

create table if not exists public.hnc_hours (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  work_date  date not null,
  hours      numeric(4, 1) not null check (hours > 0 and hours <= 24),
  created_by uuid references public.doctors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, work_date)
);
comment on table public.hnc_hours is
  'Heures non cliniques (ex-S3) : un médecin déclare un nombre d''heures pour un jour. Plusieurs médecins par jour, 1 entrée par médecin et par jour.';

create index if not exists hnc_work_date_idx on public.hnc_hours (work_date);
create index if not exists hnc_doctor_idx on public.hnc_hours (doctor_id);

alter table public.hnc_hours enable row level security;

drop policy if exists hnc_select on public.hnc_hours;
create policy hnc_select on public.hnc_hours
  for select to authenticated using (public.is_approved());

drop policy if exists hnc_insert on public.hnc_hours;
create policy hnc_insert on public.hnc_hours
  for insert to authenticated with check (public.is_approved());

drop policy if exists hnc_update on public.hnc_hours;
create policy hnc_update on public.hnc_hours
  for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists hnc_delete on public.hnc_hours;
create policy hnc_delete on public.hnc_hours
  for delete to authenticated using (public.is_approved());

drop trigger if exists hnc_touch on public.hnc_hours;
create trigger hnc_touch before update on public.hnc_hours
  for each row execute function public.touch_updated_at();

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.hnc_hours;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- Migration des données : les anciennes gardes « S3 » (8 h chacune) deviennent
-- des heures non cliniques, puis on retire ces lignes de `shifts`.
insert into public.hnc_hours (work_date, doctor_id, hours, created_by, created_at, updated_at)
  select work_date, doctor_id, 8, created_by, created_at, updated_at
  from public.shifts where shift_type = 'S3'
  on conflict (doctor_id, work_date) do nothing;
delete from public.shifts where shift_type = 'S3';

-- ===================== Sauvegarde : inclure hnc_hours =====================
create or replace function public._mkbackup(p_kind text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare snap jsonb; bid uuid;
begin
  snap := jsonb_build_object(
    'version', 2,
    'created_at', now(),
    'doctors', (select coalesce(jsonb_agg(to_jsonb(d) - 'calendar_token'), '[]'::jsonb) from public.doctors d),
    'shifts', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.shifts s),
    'leaves', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.leaves l),
    'hnc_hours', (select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from public.hnc_hours h),
    'day_notes', (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from public.day_notes n),
    'locked_months', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.locked_months m),
    'settings', (select settings from public.app_config where id = 1)
  );
  insert into public.backups(kind, payload, size)
    values (p_kind, snap, length(snap::text)) returning id into bid;
  delete from public.backups where kind = 'auto' and id not in (
    select id from public.backups where kind = 'auto' order by created_at desc limit 10
  );
  return bid;
end; $$;
revoke all on function public._mkbackup(text) from public;

create or replace function public.admin_restore(p_payload jsonb, p_mode text default 'merge')
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  set local session_replication_role = replica;

  if p_mode = 'replace' then
    delete from public.shifts;
    delete from public.leaves;
    delete from public.hnc_hours;
    delete from public.day_notes;
    delete from public.locked_months;
  end if;

  insert into public.doctors (id, name, email, color, is_admin, approved)
    select (x->>'id')::uuid, x->>'name', x->>'email',
           coalesce(x->>'color', '#2563eb'),
           coalesce((x->>'is_admin')::boolean, false),
           coalesce((x->>'approved')::boolean, false)
    from jsonb_array_elements(coalesce(p_payload->'doctors', '[]'::jsonb)) x
    on conflict (id) do update set name = excluded.name, color = excluded.color;

  insert into public.shifts (work_date, shift_type, doctor_id, created_by)
    select (x->>'work_date')::date, x->>'shift_type', (x->>'doctor_id')::uuid,
           nullif(x->>'created_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'shifts', '[]'::jsonb)) x
    where x->>'shift_type' <> 'S3'
    on conflict (work_date, shift_type) do update set doctor_id = excluded.doctor_id;

  insert into public.leaves (doctor_id, work_date, kind, hours, created_by)
    select (x->>'doctor_id')::uuid, (x->>'work_date')::date, x->>'kind',
           nullif(x->>'hours', '')::numeric, nullif(x->>'created_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'leaves', '[]'::jsonb)) x
    on conflict (doctor_id, work_date) do update set kind = excluded.kind, hours = excluded.hours;

  -- HNC : depuis la clé dédiée, ou repli sur d'anciennes gardes S3 d'un backup v1.
  insert into public.hnc_hours (doctor_id, work_date, hours, created_by)
    select (x->>'doctor_id')::uuid, (x->>'work_date')::date,
           coalesce(nullif(x->>'hours', '')::numeric, 8), nullif(x->>'created_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'hnc_hours', '[]'::jsonb)) x
    on conflict (doctor_id, work_date) do update set hours = excluded.hours;

  insert into public.hnc_hours (doctor_id, work_date, hours, created_by)
    select (x->>'doctor_id')::uuid, (x->>'work_date')::date, 8, nullif(x->>'created_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'shifts', '[]'::jsonb)) x
    where x->>'shift_type' = 'S3'
    on conflict (doctor_id, work_date) do nothing;

  insert into public.day_notes (work_date, note, created_by)
    select (x->>'work_date')::date, x->>'note', nullif(x->>'created_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'day_notes', '[]'::jsonb)) x
    on conflict (work_date) do update set note = excluded.note;

  insert into public.locked_months (year, month, locked_by)
    select (x->>'year')::int, (x->>'month')::int, nullif(x->>'locked_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'locked_months', '[]'::jsonb)) x
    on conflict (year, month) do nothing;

  if p_payload ? 'settings' then
    update public.app_config set settings = coalesce(p_payload->'settings', '{}'::jsonb) where id = 1;
  end if;
end; $$;
grant execute on function public.admin_restore(jsonb, text) to authenticated;
