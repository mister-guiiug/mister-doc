-- mister-doc — Libre-service du compte
-- ---------------------------------------------------------------------------
-- Un compte « en attente » (approved=false) peut supprimer lui-même sa demande
-- d'accès : on retire la fiche médecin ET l'utilisateur auth (l'e-mail
-- redevient disponible pour une nouvelle inscription). Verrou de sécurité : un
-- compte DÉJÀ approuvé ne peut pas s'auto-supprimer par ce biais (ses gardes
-- seraient purgées en cascade) — il doit passer par un administrateur.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d   public.doctors;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into d from public.doctors where auth_id = uid;
  if found and d.approved then
    raise exception 'compte approuvé : demandez la suppression à un administrateur';
  end if;

  -- Retire la fiche « en attente » (sans effet si déjà absente).
  delete from public.doctors where auth_id = uid and approved = false;

  -- Libère l'utilisateur d'authentification (e-mail réutilisable).
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
