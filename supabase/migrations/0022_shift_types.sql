-- mister-doc — Types de créneaux (gardes) CONFIGURABLES.
-- ---------------------------------------------------------------------------
-- Jusqu'ici les créneaux S1J/S1N/S2J (+ S3 legacy) étaient figés dans le code
-- et dans des contraintes CHECK. Cette migration les rend gérables par un admin,
-- SANS casser l'existant : on conserve `code` comme clé (= valeur de
-- `shifts.shift_type`), donc AUCUNE donnée n'est réécrite. Les CHECK deviennent
-- des clés étrangères vers `shift_types(code)` (on delete restrict) et la
-- fonction `shift_label` lit désormais la table (les notifications suivent).
--
-- Rétrocompatibilité : le seed reproduit exactement le comportement actuel
-- (mêmes libellés, heures, couverture, statut « nuit », horaires .ics), donc
-- rien ne change tant qu'un admin n'édite pas la configuration.
-- ---------------------------------------------------------------------------

-- ============================ Table ==============================
create table if not exists public.shift_types (
  code           text primary key,               -- 'S1J' — court, stable, = shifts.shift_type
  label          text not null,                  -- 'S1 Jour'
  hours          numeric(4, 1) not null default 0 check (hours >= 0 and hours <= 24),
  sort_order     int not null default 0,         -- ordre d'affichage (colonnes)
  clinical       boolean not null default true,  -- créneau à couvrir (vs technique/legacy)
  is_night       boolean not null default false, -- déclenche repos de sécurité + compteur nuits
  weekend        boolean not null default true,  -- requis aussi le week-end / férié
  start_time     time,                           -- pour le flux .ics (facultatif)
  end_time       time,
  end_day_offset int not null default 0 check (end_day_offset in (0, 1)), -- 1 = fin le lendemain
  color          text,                           -- badge (facultatif)
  active         boolean not null default true,  -- (dés)activable sans suppression
  created_at     timestamptz not null default now()
);
comment on table public.shift_types is
  'Types de créneaux configurables. code = valeur de shifts.shift_type (stable). '
  'clinical=à couvrir, is_night=repos de sécurité + compteur nuits, weekend=requis le week-end.';

-- Seed = comportement historique à l'identique. Idempotent (on conflict do nothing)
-- pour ne jamais écraser une configuration déjà personnalisée par un admin.
insert into public.shift_types
  (code, label, hours, sort_order, clinical, is_night, weekend, start_time, end_time, end_day_offset, active)
values
  ('S1J', 'S1 Jour', 10, 0, true,  false, true,  '08:00', '18:00', 0, true),
  ('S1N', 'S1 Nuit', 15, 1, true,  true,  true,  '18:00', '09:00', 1, true),
  ('S2J', 'S2 Jour', 8,  2, true,  false, false, '08:00', '16:00', 0, true),
  -- S3 : ancien créneau devenu « heures non cliniques » (table hnc_hours séparée).
  -- Conservé pour l'historique/la FK, mais non clinique et inactif (jamais proposé).
  ('S3',  'Heures non cliniques', 8, 3, false, false, false, null, null, 0, false)
on conflict (code) do nothing;

-- ===================== CHECK → clé étrangère =====================
-- Un type référencé par une garde/un échange ne peut plus être supprimé
-- (on delete restrict) — seulement désactivé. Les CHECK figés disparaissent.
alter table public.shifts drop constraint if exists shifts_shift_type_check;
alter table public.shifts drop constraint if exists shifts_shift_type_fkey;
alter table public.shifts
  add constraint shifts_shift_type_fkey
  foreign key (shift_type) references public.shift_types (code) on delete restrict;

alter table public.swap_requests drop constraint if exists swap_requests_shift_type_check;
alter table public.swap_requests drop constraint if exists swap_requests_shift_type_fkey;
alter table public.swap_requests
  add constraint swap_requests_shift_type_fkey
  foreign key (shift_type) references public.shift_types (code) on delete restrict;

-- ============================== RLS ==============================
alter table public.shift_types enable row level security;
drop policy if exists shift_types_select on public.shift_types;
create policy shift_types_select on public.shift_types
  for select to authenticated using (public.is_approved());
-- Écritures via RPC SECURITY DEFINER uniquement (réservées aux admins).

-- ==================== Fonctions de lecture ====================
-- `shift_label` lisait un CASE figé ; elle lit désormais la table (fallback au
-- code). Passe de IMMUTABLE à STABLE (dépend de données) — les triggers de
-- notification qui l'appellent restent corrects, avec les libellés à jour.
create or replace function public.shift_label(t text) returns text
  language sql stable security definer set search_path = public as $$
  select coalesce((select label from public.shift_types where code = t), t);
$$;

create or replace function public.shift_hours(t text) returns numeric
  language sql stable security definer set search_path = public as $$
  select coalesce((select hours from public.shift_types where code = t), 0);
$$;
grant execute on function public.shift_hours(text) to authenticated;

-- ========================= RPC admin =========================
-- Créer ou mettre à jour un type. Le `code` est immuable (identité). Refuse de
-- désactiver/déclasser le DERNIER créneau clinique actif (au moins un requis).
create or replace function public.admin_upsert_shift_type(
  p_code text, p_label text, p_hours numeric, p_clinical boolean,
  p_is_night boolean, p_weekend boolean, p_start_time time, p_end_time time,
  p_end_day_offset int, p_color text, p_active boolean)
  returns public.shift_types
  language plpgsql security definer set search_path = public as $$
declare r public.shift_types; v_code text; nextord int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  v_code := upper(nullif(trim(p_code), ''));
  if v_code is null then raise exception 'code requis'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'libellé requis'; end if;

  -- Garde-fou : ne pas retirer le dernier créneau clinique actif.
  if not (coalesce(p_clinical, true) and coalesce(p_active, true))
     and exists (select 1 from public.shift_types where code = v_code) then
    if not exists (
      select 1 from public.shift_types
      where clinical and active and code <> v_code
    ) then
      raise exception 'Au moins un créneau clinique actif est requis.';
    end if;
  end if;

  select coalesce(max(sort_order) + 1, 0) into nextord from public.shift_types;
  insert into public.shift_types as st
    (code, label, hours, clinical, is_night, weekend,
     start_time, end_time, end_day_offset, color, active, sort_order)
  values
    (v_code, trim(p_label), coalesce(p_hours, 0), coalesce(p_clinical, true),
     coalesce(p_is_night, false), coalesce(p_weekend, true),
     p_start_time, p_end_time, coalesce(p_end_day_offset, 0),
     nullif(trim(p_color), ''), coalesce(p_active, true), nextord)
  on conflict (code) do update set
    label = excluded.label, hours = excluded.hours, clinical = excluded.clinical,
    is_night = excluded.is_night, weekend = excluded.weekend,
    start_time = excluded.start_time, end_time = excluded.end_time,
    end_day_offset = excluded.end_day_offset, color = excluded.color,
    active = excluded.active
  returning st.* into r;
  return r;
end; $$;
grant execute on function public.admin_upsert_shift_type(
  text, text, numeric, boolean, boolean, boolean, time, time, int, text, boolean) to authenticated;

-- Activer / désactiver (sans suppression). Refuse de désactiver le dernier
-- créneau clinique actif.
create or replace function public.admin_set_shift_type_active(p_code text, p_active boolean)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not coalesce(p_active, false) and not exists (
    select 1 from public.shift_types
    where clinical and active and code <> p_code
  ) and exists (
    select 1 from public.shift_types where code = p_code and clinical and active
  ) then
    raise exception 'Au moins un créneau clinique actif est requis.';
  end if;
  update public.shift_types set active = coalesce(p_active, active) where code = p_code;
  if not found then raise exception 'type introuvable'; end if;
end; $$;
grant execute on function public.admin_set_shift_type_active(text, boolean) to authenticated;

-- Réordonner : applique l'ordre des codes fournis (les absents passent après).
create or replace function public.admin_reorder_shift_types(p_codes text[])
  returns void language plpgsql security definer set search_path = public as $$
declare i int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for i in 1 .. coalesce(array_length(p_codes, 1), 0) loop
    update public.shift_types set sort_order = i - 1 where code = p_codes[i];
  end loop;
end; $$;
grant execute on function public.admin_reorder_shift_types(text[]) to authenticated;

-- Supprimer : autorisé UNIQUEMENT si aucune garde/échange ne référence le type
-- (la FK on delete restrict le garantit ; on renvoie un message clair sinon).
create or replace function public.admin_delete_shift_type(p_code text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if exists (select 1 from public.shifts where shift_type = p_code)
     or exists (select 1 from public.swap_requests where shift_type = p_code) then
    raise exception 'Type utilisé par des gardes : désactivez-le plutôt que de le supprimer.';
  end if;
  delete from public.shift_types where code = p_code;
  if not found then raise exception 'type introuvable'; end if;
end; $$;
grant execute on function public.admin_delete_shift_type(text) to authenticated;

-- ============================ Realtime ============================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.shift_types;
    exception when duplicate_object then null; end;
  end if;
end; $$;
