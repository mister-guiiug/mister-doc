-- 0014 — Rate-limiting de l'Edge Function « calendar ».
--
-- Le flux .ics est PUBLIC (verify_jwt=false) et lit la base via service_role : on
-- borne le débit PAR IP en défense en profondeur (brute-force de token, DoS,
-- scraping). Compteur en fenêtre fixe, atomique, dans une table UNLOGGED (volatil :
-- ni durabilité ni WAL nécessaires pour un simple compteur anti-abus).
--
-- Idempotent (create if not exists / create or replace) : ré-applicable sans risque.

create unlogged table if not exists public.edge_rate_limit (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer     not null default 0
);

-- La table n'est jamais lue/écrite directement : uniquement via la RPC ci-dessous
-- (SECURITY DEFINER). RLS activée sans policy = tout accès direct refusé.
alter table public.edge_rate_limit enable row level security;

-- Incrémente le compteur de `p_key` et renvoie TRUE si la requête est AUTORISÉE
-- (compteur <= p_max dans la fenêtre), FALSE si la limite est dépassée. Atomique :
-- l'UPSERT verrouille la ligne, et les deux branches CASE lisent le `window_start`
-- d'AVANT mise à jour (sémantique Postgres des expressions SET). Une nouvelle
-- fenêtre repart à 1 dès que l'ancienne est expirée.
create or replace function public.edge_rate_limit_hit(
  p_key text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.edge_rate_limit as e (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when e.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
          else e.window_start
        end,
        count = case
          when e.window_start < now() - make_interval(secs => p_window_seconds)
          then 1
          else e.count + 1
        end
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- Réservé au service_role (appelée par l'Edge Function). Jamais exposée aux clients.
revoke all on function public.edge_rate_limit_hit(text, integer, integer) from public;
revoke all on function public.edge_rate_limit_hit(text, integer, integer)
  from anon, authenticated;
grant execute on function public.edge_rate_limit_hit(text, integer, integer)
  to service_role;

-- Purge des IP inactives (table UNLOGGED conservée entre redémarrages normaux) :
-- nettoyage quotidien best-effort si pg_cron est disponible. Sans échec bloquant
-- si l'extension n'est pas activée.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'mister-doc-rate-limit-cleanup',
      '17 4 * * *',
      $cron$ delete from public.edge_rate_limit
             where window_start < now() - interval '1 day' $cron$
    );
  end if;
exception
  when others then
    -- Le nettoyage planifié est un bonus : ne jamais faire échouer la migration.
    raise notice 'pg_cron cleanup non planifié : %', sqlerrm;
end
$$;

-- Expose immédiatement la nouvelle RPC à PostgREST (rechargement du cache de schéma).
notify pgrst, 'reload schema';
