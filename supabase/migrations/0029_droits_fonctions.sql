-- 0029 : quatre fonctions SECURITY DEFINER qu'aucun client ne doit appeler, et
-- une garde d'autorisation qui laissait passer NULL.
-- ---------------------------------------------------------------------------
-- 1. `_mkbackup`, `enqueue_shift_reminders`, `enqueue_weekly_digest` et
--    `notify_doctor` ne sont appelées que par pg_cron, par des déclencheurs et
--    par des fonctions SECURITY DEFINER (enveloppes `admin_*`, échanges de
--    gardes) : tous s'exécutent sous le propriétaire des fonctions, que ce
--    retrait ne touche pas. Les migrations qui les créent écrivaient
--    `revoke all … from public`, ce qui ne retire RIEN à `anon` ni à
--    `authenticated` : Supabase leur accorde EXECUTE par un privilège PAR
--    DÉFAUT explicite sur toute fonction créée dans `public`, et retirer le
--    droit implicite de `public` ne défait pas cette concession. La clé
--    publique du bundle pouvait donc lancer une sauvegarde ou les rappels
--    planifiés, et un compte connecté pouvait écrire à un confrère une
--    notification, donc un Web Push, au texte de son choix. On nomme chaque
--    rôle à écarter ; `service_role` garde le droit.
--
-- 2. `anonymize_doctor` : la garde `if not (is_admin() or
--    current_doctor_id() = p_id)` vaut NULL quand l'appelant n'a pas de fiche
--    (visiteur anonyme, compte sans fiche) : `false or null` est NULL, `not
--    null` aussi, et `if NULL` ne lève pas. L'appel anonymisait alors le
--    médecin visé et supprimait son compte d'authentification.
--    `coalesce(…, false)` referme la garde ; le reste du corps est celui de
--    0019, inchangé.
--
-- Idempotente, comme toute migration à partir de 0014 : `supabase.yml` les
-- rejoue toutes à chaque déploiement, dans une seule transaction, et celle-ci
-- passe APRÈS 0019, 0023 et 0026, qui recréent les fonctions visées.
-- `create or replace` conserve les droits : les rejouer ne rend rien à `anon`.
-- Prouvé par `supabase/tests/droits-des-fonctions.test.sql`.
-- ---------------------------------------------------------------------------

revoke all on function public._mkbackup(text) from public, anon, authenticated;
revoke all on function public.enqueue_shift_reminders() from public, anon, authenticated;
revoke all on function public.enqueue_weekly_digest() from public, anon, authenticated;
revoke all on function public.notify_doctor(uuid, text, text, text, date)
  from public, anon, authenticated;

create or replace function public.anonymize_doctor(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_auth  uuid;
  v_admin boolean;
  v_label text;
begin
  -- Autorisation : soi-même OU un administrateur. Sans `coalesce`, un appelant
  -- sans fiche rend la condition NULL, et `if NULL` ne lève pas.
  if not coalesce(public.is_admin() or public.current_doctor_id() = p_id, false) then
    raise exception 'forbidden';
  end if;

  select auth_id, is_admin into v_auth, v_admin
    from public.doctors where id = p_id;
  if not found then raise exception 'médecin introuvable'; end if;

  -- Ne jamais laisser l'application sans administrateur.
  if v_admin and (select count(*) from public.doctors where is_admin) <= 1 then
    raise exception 'impossible d''anonymiser le dernier administrateur';
  end if;

  v_label := 'Ancien médecin (' || substr(p_id::text, 1, 4) || ')';

  -- 1) Effacement de l'identité (la fiche est CONSERVÉE : pas de cascade destructrice).
  update public.doctors set
    name = v_label,
    email = null,
    auth_id = null,
    is_admin = false,
    approved = false,
    calendar_token = null,
    calendar_token_hash = null
  where id = p_id;

  -- 2) Suppression des données purement personnelles.
  delete from public.wishes where doctor_id = p_id;             -- préférences de dispo
  delete from public.notifications where doctor_id = p_id;      -- notifications perso
  delete from public.push_subscriptions where doctor_id = p_id; -- abonnements push (appareils)

  -- 3) Anonymisation des noms dénormalisés du journal d'audit.
  update public.audit_log set actor_name = v_label where actor_id = p_id;
  update public.audit_log set target_name = v_label where target_id = p_id;

  -- 4) Libère le compte d'authentification (e-mail réutilisable, plus de PII d'auth).
  if v_auth is not null then
    delete from auth.users where id = v_auth;
  end if;
end;
$$;

grant execute on function public.anonymize_doctor(uuid) to authenticated;
