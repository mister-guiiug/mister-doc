-- mister-doc — Schéma initial du planning anesthésie
-- ---------------------------------------------------------------------------
-- Modèle : un roster de médecins (avec ou sans compte) + des affectations de
-- gardes (S1J/S1N/S2J/S3), 1 médecin par créneau et par jour.
--
-- Sécurité : le dépôt est public et la clé anon est dans le bundle. L'accès aux
-- données est donc verrouillé par une BARRIÈRE D'APPROBATION (RLS) : un nouvel
-- inscrit est « en attente » (approved=false) et ne voit rien tant qu'un admin
-- ne l'a pas approuvé. Le premier admin se débloque via un code de bootstrap
-- secret stocké dans app_config (jamais exposé au client). Toutes les écritures
-- sensibles passent par des fonctions SECURITY DEFINER.
-- ---------------------------------------------------------------------------

-- ============================ Tables ==============================

create table if not exists public.doctors (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique references auth.users (id) on delete set null,
  name       text not null,
  email      text,
  color      text not null default '#2563eb',
  is_admin   boolean not null default false,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.doctors is
  'Roster des médecins. auth_id non nul = compte lié ; auth_id nul = entrée de roster créée par un admin (assignable mais sans connexion).';

create table if not exists public.shifts (
  id         uuid primary key default gen_random_uuid(),
  work_date  date not null,
  shift_type text not null check (shift_type in ('S1J', 'S1N', 'S2J', 'S3')),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  created_by uuid references public.doctors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_date, shift_type)
);
comment on table public.shifts is
  'Une affectation = un médecin sur un créneau (S1J 10h / S1N 15h / S2J 8h / S3 8h) pour une date. Contrainte unique (work_date, shift_type) : 1 médecin par créneau et par jour.';

create index if not exists shifts_work_date_idx on public.shifts (work_date);
create index if not exists shifts_doctor_idx on public.shifts (doctor_id);

-- Ligne unique de configuration privée (jamais lisible par le client).
create table if not exists public.app_config (
  id             smallint primary key default 1 check (id = 1),
  bootstrap_code text
);
-- Code réel injecté hors dépôt (voir README). Placeholder NULL ici.
insert into public.app_config (id, bootstrap_code)
values (1, null)
on conflict (id) do nothing;

-- ======================= Helpers (SECURITY DEFINER) =======================
-- SECURITY DEFINER pour éviter la récursion RLS quand utilisés dans les policies.

create or replace function public.is_approved() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select approved from public.doctors where auth_id = auth.uid()), false);
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.doctors where auth_id = auth.uid()), false);
$$;

-- =============================== RLS ===============================

alter table public.doctors enable row level security;
alter table public.shifts enable row level security;
alter table public.app_config enable row level security;

-- doctors : un membre approuvé voit tout le roster ; sinon on ne voit que soi.
drop policy if exists doctors_select on public.doctors;
create policy doctors_select on public.doctors
  for select to authenticated
  using (public.is_approved() or auth_id = auth.uid());
-- Aucune policy insert/update/delete : toutes les écritures passent par RPC.

-- shifts : lecture et écriture réservées aux médecins approuvés (édition partagée).
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts
  for select to authenticated using (public.is_approved());

drop policy if exists shifts_insert on public.shifts;
create policy shifts_insert on public.shifts
  for insert to authenticated with check (public.is_approved());

drop policy if exists shifts_update on public.shifts;
create policy shifts_update on public.shifts
  for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists shifts_delete on public.shifts;
create policy shifts_delete on public.shifts
  for delete to authenticated using (public.is_approved());

-- app_config : aucune policy → totalement inaccessible au client.

-- =============================== Triggers ===============================

create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shifts_touch on public.shifts;
create trigger shifts_touch before update on public.shifts
  for each row execute function public.touch_updated_at();

-- =============================== RPC ===============================

-- Upsert de la fiche du médecin connecté (à chaque login). N'accorde jamais
-- approbation ni admin : un nouvel inscrit arrive « en attente ».
create or replace function public.ensure_self_doctor(p_name text default null)
  returns public.doctors
  language plpgsql security definer set search_path = public as $$
declare
  d public.doctors;
  u_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select email into u_email from auth.users where id = auth.uid();
  select * into d from public.doctors where auth_id = auth.uid();
  if found then
    update public.doctors set email = coalesce(email, u_email)
      where id = d.id returning * into d;
    return d;
  end if;
  insert into public.doctors (auth_id, name, email, approved, is_admin)
  values (
    auth.uid(),
    coalesce(nullif(trim(p_name), ''), split_part(u_email, '@', 1)),
    u_email, false, false
  )
  returning * into d;
  return d;
end;
$$;

-- Mise à jour du profil d'affichage (nom, couleur) — sans toucher aux droits.
create or replace function public.update_my_profile(p_name text, p_color text)
  returns public.doctors
  language plpgsql security definer set search_path = public as $$
declare d public.doctors;
begin
  update public.doctors set
    name = coalesce(nullif(trim(p_name), ''), name),
    color = coalesce(nullif(trim(p_color), ''), color)
  where auth_id = auth.uid()
  returning * into d;
  if not found then raise exception 'no doctor row'; end if;
  return d;
end;
$$;

-- Devenir le premier admin via le code de bootstrap (uniquement si aucun admin).
create or replace function public.claim_admin(p_code text)
  returns public.doctors
  language plpgsql security definer set search_path = public as $$
declare
  d public.doctors;
  code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.doctors where is_admin) then
    raise exception 'un administrateur existe déjà';
  end if;
  select bootstrap_code into code from public.app_config where id = 1;
  if code is null or p_code is null or p_code <> code then
    raise exception 'code invalide';
  end if;
  update public.doctors set is_admin = true, approved = true
    where auth_id = auth.uid() returning * into d;
  if not found then raise exception 'no doctor row'; end if;
  return d;
end;
$$;

-- Admin : approuver / promouvoir un médecin.
create or replace function public.admin_set_doctor(
  p_id uuid, p_approved boolean, p_is_admin boolean)
  returns public.doctors
  language plpgsql security definer set search_path = public as $$
declare d public.doctors;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.doctors set
    approved = coalesce(p_approved, approved),
    is_admin = coalesce(p_is_admin, is_admin)
  where id = p_id
  returning * into d;
  if not found then raise exception 'not found'; end if;
  return d;
end;
$$;

-- Admin : ajouter une entrée de roster (médecin sans compte, assignable).
create or replace function public.admin_add_roster(p_name text, p_color text default '#2563eb')
  returns public.doctors
  language plpgsql security definer set search_path = public as $$
declare d public.doctors;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;
  insert into public.doctors (name, color, approved, is_admin)
  values (trim(p_name), coalesce(nullif(trim(p_color), ''), '#2563eb'), true, false)
  returning * into d;
  return d;
end;
$$;

-- Admin : supprimer une entrée de roster non liée à un compte.
create or replace function public.admin_delete_doctor(p_id uuid)
  returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.doctors where id = p_id and auth_id is null;
  if not found then raise exception 'suppression impossible (compte lié ou introuvable)'; end if;
end;
$$;

-- Droits d'exécution
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.ensure_self_doctor(text) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.claim_admin(text) to authenticated;
grant execute on function public.admin_set_doctor(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_add_roster(text, text) to authenticated;
grant execute on function public.admin_delete_doctor(uuid) to authenticated;

-- Realtime : diffusion live des changements de planning.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.shifts;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
