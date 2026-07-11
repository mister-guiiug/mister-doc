-- mister-doc — Flux calendrier iCalendar (.ics)
-- Un token secret (dans app_config) protège le flux servi par l'Edge Function
-- « calendar ». Les médecins approuvés récupèrent l'URL d'abonnement via la RPC
-- calendar_token(). Le token réel est injecté hors dépôt (placeholder NULL ici).

alter table public.app_config add column if not exists calendar_token text;

-- Renvoie le token du flux calendrier aux seuls médecins approuvés (pour
-- construire l'URL d'abonnement côté client). NULL sinon.
create or replace function public.calendar_token()
  returns text
  language sql stable security definer set search_path = public as $$
  select case
    when public.is_approved()
    then (select calendar_token from public.app_config where id = 1)
    else null
  end;
$$;

grant execute on function public.calendar_token() to authenticated;
