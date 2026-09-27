-- mister-doc — table de keep-alive Supabase
-- ---------------------------------------------------------------------------
-- POURQUOI. Le workflow « Supabase keep-alive » fait un SELECT anonyme sur
-- public.keep_alive. Le 25/09/2026 il répondait HTTP 404 (PGRST205) : la table
-- n'existait pas, et un projet Free se met en pause après sept jours sans
-- requête. Le SQL est celui du socle (templates/supabase/keep-alive.sql).
--
-- LECTURE SEULE. Les privilèges par défaut du schéma donnent à anon
-- l'écriture et TRUNCATE, et TRUNCATE ignore la RLS. On retire donc tout,
-- puis on ne rend que le SELECT à anon — la seule opération du ping.

create table if not exists public.keep_alive (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);

alter table public.keep_alive enable row level security;

drop policy if exists "anon read keep_alive" on public.keep_alive;
create policy "anon read keep_alive"
  on public.keep_alive
  for select
  to anon
  using (true);

insert into public.keep_alive (pinged_at)
select now()
where not exists (select 1 from public.keep_alive);

revoke all on table public.keep_alive from anon, authenticated;
grant select on table public.keep_alive to anon;
