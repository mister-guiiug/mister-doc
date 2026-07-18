-- 0021 — Codes de secours 2FA (récupération TOTP self-service).
--
-- Complément à la réinitialisation admin (0020) : un médecin qui a activé la 2FA
-- reçoit des codes de secours à usage unique. En cas de perte de l'authentificateur,
-- il présente un code sur l'écran de défi (sa session est déjà aal1) → la RPC vérifie
-- le code, le consomme, et RETIRE ses facteurs TOTP → l'accès n'exige plus le code à
-- 6 chiffres. Aucun admin nécessaire.
--
-- Les codes ne sont JAMAIS stockés en clair : seul leur SHA-256 est conservé
-- (comparaison par hash), et l'accès à la table passe exclusivement par les RPC
-- SECURITY DEFINER (RLS active sans policy = accès direct refusé).

create table if not exists public.mfa_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.mfa_recovery_codes enable row level security;
create index if not exists mfa_recovery_codes_doctor_idx
  on public.mfa_recovery_codes (doctor_id);

-- Normalise un code saisi (minuscule, alphanumérique) avant hachage/comparaison :
-- « 3F8A-2B91 » et « 3f8a2b91 » correspondent au même code.
create or replace function public._normalize_recovery_code(p text)
  returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(p, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- (Re)génère 10 codes à usage unique pour le médecin connecté et renvoie leur
-- version EN CLAIR une seule fois (à afficher/enregistrer). Invalide les anciens.
create or replace function public.generate_mfa_recovery_codes()
  returns text[] language plpgsql security definer
  set search_path = public, extensions as $$
declare
  v_doc   uuid := public.current_doctor_id();
  v_codes text[] := '{}';
  v_raw   text;
begin
  if v_doc is null or not public.is_approved() then raise exception 'forbidden'; end if;
  delete from public.mfa_recovery_codes where doctor_id = v_doc;
  for i in 1..10 loop
    v_raw := encode(gen_random_bytes(4), 'hex'); -- 8 caractères hex
    insert into public.mfa_recovery_codes (doctor_id, code_hash)
      values (v_doc, encode(digest(v_raw, 'sha256'), 'hex'));
    -- Format lisible « xxxx-xxxx » (le hash porte sur la forme normalisée sans tiret).
    v_codes := array_append(v_codes, substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4));
  end loop;
  return v_codes;
end; $$;
grant execute on function public.generate_mfa_recovery_codes() to authenticated;

-- Consomme un code de secours (si valide et inutilisé) et retire les facteurs TOTP
-- du médecin → l'accès n'exige plus l'étape à 6 chiffres. Renvoie true si accepté.
create or replace function public.use_mfa_recovery_code(p_code text)
  returns boolean language plpgsql security definer
  set search_path = public, extensions as $$
declare
  v_doc  uuid := public.current_doctor_id();
  v_auth uuid := auth.uid();
  v_id   uuid;
begin
  if v_doc is null then raise exception 'forbidden'; end if;
  select id into v_id from public.mfa_recovery_codes
    where doctor_id = v_doc
      and used_at is null
      and code_hash = encode(digest(public._normalize_recovery_code(p_code), 'sha256'), 'hex')
    limit 1;
  if v_id is null then return false; end if;

  update public.mfa_recovery_codes set used_at = now() where id = v_id;
  delete from auth.mfa_factors where user_id = v_auth;
  perform public._audit('mfa.recovery_used', v_doc,
    (select name from public.doctors where id = v_doc), null);
  return true;
end; $$;
grant execute on function public.use_mfa_recovery_code(text) to authenticated;

notify pgrst, 'reload schema';
