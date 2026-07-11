-- mister-doc — Notifications in-app + sauvegardes.

-- ============================ Helper ============================
create or replace function public.current_doctor_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select id from public.doctors where auth_id = auth.uid() limit 1;
$$;
grant execute on function public.current_doctor_id() to authenticated;

-- ========================= Notifications =========================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  work_date  date,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_doctor_idx
  on public.notifications (doctor_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications
  for select to authenticated using (doctor_id = public.current_doctor_id());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update to authenticated
  using (doctor_id = public.current_doctor_id())
  with check (doctor_id = public.current_doctor_id());
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications
  for delete to authenticated using (doctor_id = public.current_doctor_id());
-- Pas d'INSERT client : les notifications sont créées par des triggers.

create or replace function public.mark_all_notifications_read()
  returns void language sql security definer set search_path = public as $$
  update public.notifications set read = true
  where doctor_id = public.current_doctor_id() and not read;
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Libellé lisible d'un créneau.
create or replace function public.shift_label(t text) returns text
  language sql immutable as $$
  select case t when 'S1J' then 'S1 Jour' when 'S1N' then 'S1 Nuit'
    when 'S2J' then 'S2 Jour' when 'S3' then 'S3' else t end;
$$;

-- Notifie un médecin (si compte lié et action non initiée par lui-même).
create or replace function public.notify_doctor(
  p_doctor uuid, p_type text, p_title text, p_body text, p_date date)
  returns void language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  select auth_id into a from public.doctors where id = p_doctor;
  if a is null or a = auth.uid() then return; end if;
  insert into public.notifications(doctor_id, type, title, body, work_date)
    values (p_doctor, p_type, p_title, p_body, p_date);
end; $$;

-- Gardes
create or replace function public.trg_notify_shift()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    perform public.notify_doctor(NEW.doctor_id, 'shift_assigned', 'Nouvelle garde',
      public.shift_label(NEW.shift_type) || ' le ' || to_char(NEW.work_date, 'DD/MM/YYYY'), NEW.work_date);
  elsif TG_OP = 'DELETE' then
    perform public.notify_doctor(OLD.doctor_id, 'shift_removed', 'Garde retirée',
      public.shift_label(OLD.shift_type) || ' le ' || to_char(OLD.work_date, 'DD/MM/YYYY'), OLD.work_date);
  elsif NEW.doctor_id <> OLD.doctor_id then
    perform public.notify_doctor(OLD.doctor_id, 'shift_removed', 'Garde retirée',
      public.shift_label(OLD.shift_type) || ' le ' || to_char(OLD.work_date, 'DD/MM/YYYY'), OLD.work_date);
    perform public.notify_doctor(NEW.doctor_id, 'shift_assigned', 'Nouvelle garde',
      public.shift_label(NEW.shift_type) || ' le ' || to_char(NEW.work_date, 'DD/MM/YYYY'), NEW.work_date);
  end if;
  return coalesce(NEW, OLD);
end; $$;
drop trigger if exists shifts_notify on public.shifts;
create trigger shifts_notify after insert or update or delete on public.shifts
  for each row execute function public.trg_notify_shift();

-- Absences
create or replace function public.trg_notify_leave()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_doctor(NEW.doctor_id, 'leave_added', 'Absence enregistrée',
    (case NEW.kind when 'training' then 'Formation' else 'Congé annuel' end)
      || ' le ' || to_char(NEW.work_date, 'DD/MM/YYYY'), NEW.work_date);
  return NEW;
end; $$;
drop trigger if exists leaves_notify on public.leaves;
create trigger leaves_notify after insert on public.leaves
  for each row execute function public.trg_notify_leave();

-- Médecins : demande de compte (aux admins) + approbation (au médecin)
create or replace function public.trg_notify_doctor_change()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.auth_id is not null and not NEW.approved then
      insert into public.notifications(doctor_id, type, title, body)
        select id, 'approval_request', 'Nouvelle demande de compte',
          coalesce(NEW.name, NEW.email) || ' souhaite accéder au planning.'
        from public.doctors where is_admin;
    end if;
  elsif TG_OP = 'UPDATE' and NEW.approved and not OLD.approved then
    insert into public.notifications(doctor_id, type, title, body)
      values (NEW.id, 'approved', 'Compte approuvé', 'Bienvenue ! Vous avez accès au planning.');
  end if;
  return NEW;
end; $$;
drop trigger if exists doctors_notify on public.doctors;
create trigger doctors_notify after insert or update on public.doctors
  for each row execute function public.trg_notify_doctor_change();

-- ============================ Sauvegardes ============================
create table if not exists public.backups (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('auto', 'manual')),
  payload    jsonb not null,
  size       int,
  created_at timestamptz not null default now()
);
alter table public.backups enable row level security;
drop policy if exists backups_admin on public.backups;
create policy backups_admin on public.backups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Construit un instantané complet (hors secrets) et l'enregistre.
create or replace function public._mkbackup(p_kind text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare snap jsonb; bid uuid;
begin
  snap := jsonb_build_object(
    'version', 1,
    'created_at', now(),
    'doctors', (select coalesce(jsonb_agg(to_jsonb(d) - 'calendar_token'), '[]'::jsonb) from public.doctors d),
    'shifts', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.shifts s),
    'leaves', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.leaves l),
    'day_notes', (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from public.day_notes n),
    'locked_months', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.locked_months m),
    'settings', (select settings from public.app_config where id = 1)
  );
  insert into public.backups(kind, payload, size)
    values (p_kind, snap, length(snap::text)) returning id into bid;
  -- Ne conserve que les 10 dernières sauvegardes auto.
  delete from public.backups where kind = 'auto' and id not in (
    select id from public.backups where kind = 'auto' order by created_at desc limit 10
  );
  return bid;
end; $$;
revoke all on function public._mkbackup(text) from public;

create or replace function public.admin_backup()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare bid uuid; p jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  bid := public._mkbackup('manual');
  select payload into p from public.backups where id = bid;
  return p;
end; $$;
grant execute on function public.admin_backup() to authenticated;

-- Restauration (admin). mode 'replace' vide d'abord gardes/absences/notes/verrous.
create or replace function public.admin_restore(p_payload jsonb, p_mode text default 'merge')
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  set local session_replication_role = replica; -- bypasse triggers (verrous, notifs)

  if p_mode = 'replace' then
    delete from public.shifts;
    delete from public.leaves;
    delete from public.day_notes;
    delete from public.locked_months;
  end if;

  -- Roster (jamais de suppression de compte) : upsert nom/couleur.
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
    on conflict (work_date, shift_type) do update set doctor_id = excluded.doctor_id;

  insert into public.leaves (doctor_id, work_date, kind, hours, created_by)
    select (x->>'doctor_id')::uuid, (x->>'work_date')::date, x->>'kind',
           nullif(x->>'hours', '')::numeric, nullif(x->>'created_by', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'leaves', '[]'::jsonb)) x
    on conflict (doctor_id, work_date) do update set kind = excluded.kind, hours = excluded.hours;

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

-- Realtime notifications
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end; $$;

-- ================ Sauvegarde automatique hebdomadaire (pg_cron) ================
-- Best-effort : nécessite l'extension pg_cron (dispo sur Supabase). Lundi 3h.
do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule('mister-doc-weekly-backup', '0 3 * * 1', 'select public._mkbackup(''auto'')');
exception when others then
  raise notice 'pg_cron indisponible : planifier la sauvegarde manuellement.';
end;
$$;
