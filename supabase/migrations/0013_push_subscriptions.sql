-- mister-doc — Abonnements Web Push (notifications hors application).
-- Chaque médecin peut enregistrer un ou plusieurs abonnements push (un par
-- navigateur/appareil). L'envoi est fait par l'Edge Function « push »,
-- déclenchée par un webhook base de données sur l'insertion d'une notification.

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  doctor_id  uuid not null default public.current_doctor_id()
               references public.doctors (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_doctor_idx
  on public.push_subscriptions (doctor_id);

alter table public.push_subscriptions enable row level security;

-- Chacun ne gère que ses propres abonnements. L'Edge Function lit via
-- service_role (contourne la RLS) pour envoyer les push.
drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions
  for select to authenticated using (doctor_id = public.current_doctor_id());
drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert to authenticated with check (doctor_id = public.current_doctor_id());
drop policy if exists push_update on public.push_subscriptions;
create policy push_update on public.push_subscriptions
  for update to authenticated
  using (doctor_id = public.current_doctor_id())
  with check (doctor_id = public.current_doctor_id());
drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete on public.push_subscriptions
  for delete to authenticated using (doctor_id = public.current_doctor_id());
