-- 0018 — Hachage des tokens calendrier AU REPOS (défense contre une fuite de base).
--
-- Le token d'abonnement .ics doit rester dans l'URL (les agendas s'abonnent par
-- simple GET) mais NE DOIT PLUS être stocké en clair : un dump de la base ne doit
-- pas révéler de liens utilisables. On ne conserve que le SHA-256 du token
-- (`calendar_token_hash`) ; l'Edge Function hache le token reçu et compare au hash
-- (SHA-256 hex minuscule, identique côté Deno/WebCrypto, Node et pgcrypto).
--
-- CONSÉQUENCE UX : un token existant n'est plus ré-affichable (on n'a que son hash)
-- → il n'est montré qu'UNE fois, à la génération/régénération (cf. front « montré
-- une fois »). `calendar_token_status()` indique juste s'il en existe un.
--
-- ⚠️⚠️ ORDRE DE DÉPLOIEMENT : l'Edge Function `calendar` (qui compare par hash, avec
-- repli plaintext) DOIT être déployée AVANT cette migration — sinon, une fois le
-- plaintext annulé ci-dessous, l'ancienne fonction (lookup plaintext) ne trouverait
-- plus aucun token. Le front est compatible (mode hashé si la RPC existe, sinon
-- repli legacy). Idempotent.

-- 1) Colonnes de hash + index de lookup (les NULL multiples sont autorisés).
alter table public.doctors add column if not exists calendar_token_hash text;
create unique index if not exists doctors_calendar_token_hash_idx
  on public.doctors (calendar_token_hash);
alter table public.app_config add column if not exists calendar_token_hash text;

-- 2) Backfill : hash des tokens existants (les URLs déjà distribuées restent valides,
-- car hash(leur token) = ce qu'on stocke ici).
update public.doctors
  set calendar_token_hash = encode(extensions.digest(calendar_token, 'sha256'), 'hex')
  where calendar_token is not null and calendar_token_hash is null;
update public.app_config
  set calendar_token_hash = encode(extensions.digest(calendar_token, 'sha256'), 'hex')
  where calendar_token is not null and calendar_token_hash is null;

-- 3) Suppression du plaintext (on garde la colonne, mise à NULL : plus rien en clair).
update public.doctors set calendar_token = null where calendar_token is not null;
update public.app_config set calendar_token = null where calendar_token is not null;

-- 4) RPC hash-only. `rotate` génère un token, stocke SON HASH, ne garde pas le clair,
-- et le renvoie UNE fois. `my_calendar_token` (appelée seulement par d'anciens bundles
-- en cache) crée-si-absent puis renvoie une fois, sinon NULL (existant non révélable).
create or replace function public.rotate_calendar_token()
  returns text language plpgsql security definer
  set search_path = public, extensions as $$
declare t text;
begin
  if not public.is_approved() then raise exception 'forbidden'; end if;
  t := 'dcal_' || replace(gen_random_uuid()::text, '-', '');
  update public.doctors
    set calendar_token_hash = encode(extensions.digest(t, 'sha256'), 'hex'),
        calendar_token = null
    where auth_id = auth.uid();
  return t;
end; $$;

create or replace function public.my_calendar_token()
  returns text language plpgsql security definer
  set search_path = public, extensions as $$
declare t text; h text;
begin
  if not public.is_approved() then raise exception 'forbidden'; end if;
  select calendar_token_hash into h from public.doctors where auth_id = auth.uid();
  if h is not null then
    return null; -- token existant : non ré-affichable (hashé au repos)
  end if;
  t := 'dcal_' || replace(gen_random_uuid()::text, '-', '');
  update public.doctors
    set calendar_token_hash = encode(extensions.digest(t, 'sha256'), 'hex'),
        calendar_token = null
    where auth_id = auth.uid();
  return t;
end; $$;

-- 5) Statut : le médecin a-t-il un token ? (booléen, jamais le token). Le front
-- l'utilise pour choisir entre « Générer » et « Régénérer ».
create or replace function public.calendar_token_status()
  returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved()
     and exists (
       select 1 from public.doctors
       where auth_id = auth.uid() and calendar_token_hash is not null
     );
$$;
grant execute on function public.calendar_token_status() to authenticated;

notify pgrst, 'reload schema';
