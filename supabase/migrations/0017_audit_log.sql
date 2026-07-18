-- 0017 — Journal d'audit des actions sensibles (admin & cycle de vie des comptes).
--
-- Traçabilité : qui a approuvé/rejeté/supprimé qui, promu/rétrogradé un admin,
-- verrouillé/déverrouillé un mois. Écrit UNIQUEMENT par des triggers SECURITY
-- DEFINER (aucune écriture cliente possible → journal infalsifiable), lisible par
-- les seuls admins. Les triggers captent le vrai changement de données quel que
-- soit le chemin RPC → pas besoin de modifier les RPC existantes.
--
-- Dénormalisé (actor_name/target_name, PAS de clés étrangères) : le journal SURVIT
-- à la suppression des médecins concernés et reste lisible pour toujours.

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,          -- id du médecin acteur (sans FK : le log survit aux suppressions)
  actor_name  text,
  action      text not null, -- 'doctor.approve', 'doctor.grant_admin', 'month.lock'…
  target_id   uuid,
  target_name text,
  details     jsonb
);

alter table public.audit_log enable row level security;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_admin());
-- Aucune policy insert/update/delete : append-only, écrit seulement via `_audit`.

-- Insère une entrée en résolvant l'acteur (médecin de `auth.uid()`). SECURITY
-- DEFINER → bypass RLS pour l'écriture. Réservée aux triggers (jamais aux clients).
create or replace function public._audit(
  p_action text, p_target_id uuid, p_target_name text, p_details jsonb default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  a_id   uuid := public.current_doctor_id();
  a_name text;
begin
  select name into a_name from public.doctors where id = a_id;
  insert into public.audit_log (actor_id, actor_name, action, target_id, target_name, details)
  values (a_id, a_name, p_action, p_target_id, p_target_name, p_details);
end; $$;
revoke all on function public._audit(text, uuid, text, jsonb) from public, anon, authenticated;

-- Cycle de vie des médecins. On ne journalise QUE les événements sensibles :
-- création (roster vs auto-inscription), (dés)approbation, (dé)promotion, suppression.
-- Les éditions de nom/couleur (approved/is_admin inchangés) ne produisent RIEN.
create or replace function public.audit_doctors()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._audit(
      case when new.approved then 'doctor.add' else 'doctor.signup' end,
      new.id, new.name, null);
  elsif tg_op = 'DELETE' then
    perform public._audit('doctor.remove', old.id, old.name, null);
  elsif tg_op = 'UPDATE' then
    if new.approved is distinct from old.approved then
      perform public._audit(
        case when new.approved then 'doctor.approve' else 'doctor.unapprove' end,
        new.id, new.name, null);
    end if;
    if new.is_admin is distinct from old.is_admin then
      perform public._audit(
        case when new.is_admin then 'doctor.grant_admin' else 'doctor.revoke_admin' end,
        new.id, new.name, null);
    end if;
  end if;
  return null; -- AFTER trigger : valeur ignorée
end; $$;
drop trigger if exists audit_doctors_trg on public.doctors;
create trigger audit_doctors_trg
  after insert or update or delete on public.doctors
  for each row execute function public.audit_doctors();

-- Verrouillage de mois.
create or replace function public.audit_locks()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._audit('month.lock', null, null,
      jsonb_build_object('year', new.year, 'month', new.month));
  elsif tg_op = 'DELETE' then
    perform public._audit('month.unlock', null, null,
      jsonb_build_object('year', old.year, 'month', old.month));
  end if;
  return null;
end; $$;
drop trigger if exists audit_locks_trg on public.locked_months;
create trigger audit_locks_trg
  after insert or delete on public.locked_months
  for each row execute function public.audit_locks();

-- Expose la table à PostgREST (lecture admin).
notify pgrst, 'reload schema';
