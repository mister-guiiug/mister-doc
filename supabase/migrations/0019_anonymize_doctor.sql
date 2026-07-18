-- 0019 — Effacement RGPD (art. 17) des comptes APPROUVÉS par ANONYMISATION.
--
-- Jusqu'ici seul un compte « en attente » (delete_my_account) ou une entrée roster
-- sans compte (admin_delete_doctor) pouvait être supprimé ; un compte approuvé lié
-- à un utilisateur d'auth n'avait AUCUNE voie d'effacement dans l'app.
--
-- On ne peut pas SUPPRIMER la fiche : `shifts`/`leaves`/`hnc_hours`/`wishes`/
-- `notifications` sont `on delete cascade` → cela détruirait tout le planning passé.
-- On ANONYMISE donc : la fiche est conservée (les gardes passées restent, rattachées
-- à une identité anonyme), mais toute la PII est effacée (nom, e-mail, compte d'auth,
-- tokens), et les données purement personnelles (vœux, notifs, abonnements push) sont
-- supprimées. `shift_history` ne stocke que des uuid → l'historique est anonymisé de fait.
--
-- Appelable par le médecin LUI-MÊME (droit à l'effacement) ou par un ADMIN. Refuse
-- d'anonymiser le dernier administrateur (évite de laisser l'app sans admin). Idempotent.

-- Dépendance douce sur 0018 (colonne de hash) — idempotent si déjà présente.
alter table public.doctors add column if not exists calendar_token_hash text;

create or replace function public.anonymize_doctor(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_auth  uuid;
  v_admin boolean;
  v_label text;
begin
  -- Autorisation : soi-même OU un administrateur.
  if not (public.is_admin() or public.current_doctor_id() = p_id) then
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
