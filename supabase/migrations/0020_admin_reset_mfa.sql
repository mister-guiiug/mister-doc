-- 0020 — Récupération TOTP : réinitialisation de la double authentification par un admin.
--
-- Si un médecin perd son authentificateur (téléphone changé, appli supprimée…), il
-- ne peut plus produire le code à 6 chiffres : sa session s'authentifie bien par mot
-- de passe (aal1) mais reste bloquée sur l'écran de défi, et il ne peut pas retirer
-- son facteur (cela exige aal2). Un ADMIN supprime alors son ou ses facteurs TOTP :
-- le médecin se reconnecte ensuite avec son seul mot de passe (aal1 suffit), et peut
-- réactiver la 2FA depuis son profil.
--
-- La suppression touche `auth.mfa_factors` (schéma GoTrue) : SECURITY DEFINER (owner
-- postgres, qui a déjà accès au schéma auth — cf. delete_my_account/admin_reject qui
-- suppriment `auth.users`). Action journalisée. Idempotent (no-op si aucun facteur).

create or replace function public.admin_reset_mfa(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_auth uuid;
  v_name text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select auth_id, name into v_auth, v_name from public.doctors where id = p_id;
  if not found then raise exception 'médecin introuvable'; end if;
  if v_auth is null then raise exception 'compte non lié à une authentification'; end if;

  delete from auth.mfa_factors where user_id = v_auth;

  perform public._audit('mfa.reset', p_id, v_name, null);
end; $$;

grant execute on function public.admin_reset_mfa(uuid) to authenticated;
