-- mister-doc — Récapitulatif hebdomadaire des gardes (push + cloche).
-- ---------------------------------------------------------------------------
-- Complète les rappels quotidiens de 0023 : ceux-ci préviennent la veille, ce
-- qui est trop tard pour s'organiser. Le récap est envoyé une fois par semaine
-- et liste TOUTES les gardes des 7 jours suivants, en une seule notification.
--
-- Même pipeline que les rappels : l'insertion dans `public.notifications`
-- déclenche le webhook base → Edge Function « push ». Aucune Edge Function
-- supplémentaire, aucun réglage à ajouter.
--
-- Idempotent : `work_date` porte le LUNDI de la semaine couverte, ce qui sert
-- de clé « déjà envoyé » — relancer le job (ou le bouton admin) le même jour ne
-- crée pas de doublon.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_weekly_digest()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- Semaine couverte : les 7 jours à partir de demain. Envoyé le dimanche soir,
  -- cela correspond exactement à la semaine lundi → dimanche qui commence.
  with periode as (
    select (current_date + 1) as debut, (current_date + 7) as fin
  ),
  -- Une ligne par médecin AYANT UN COMPTE (seuls ceux-ci peuvent recevoir un
  -- push ou consulter la cloche), avec ses gardes de la période mises en forme.
  recap as (
    select
      s.doctor_id,
      count(*) as nb,
      string_agg(
        to_char(s.work_date, 'DD/MM') || ' ' || public.shift_label(s.shift_type),
        ' · ' order by s.work_date, s.shift_type
      ) as detail
    from public.shifts s
    join public.doctors d on d.id = s.doctor_id and d.auth_id is not null
    cross join periode p
    where s.work_date between p.debut and p.fin
    group by s.doctor_id
  )
  insert into public.notifications (doctor_id, type, title, body, work_date)
  select
    r.doctor_id,
    'weekly_digest',
    case when r.nb = 1 then 'Votre garde de la semaine'
         else 'Vos ' || r.nb || ' gardes de la semaine' end,
    r.detail,
    p.debut
  from recap r cross join periode p
  where not exists (
    select 1 from public.notifications x
    where x.doctor_id = r.doctor_id
      and x.type = 'weekly_digest'
      and x.work_date = p.debut
  );
  get diagnostics n = row_count;
  return n;
end; $$;
-- Appelée par pg_cron (propriétaire) et par le wrapper admin ; jamais par un
-- client directement.
revoke all on function public.enqueue_weekly_digest() from public;

-- Déclenchement manuel réservé aux admins (test / rattrapage).
create or replace function public.admin_send_weekly_digest()
  returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return public.enqueue_weekly_digest();
end; $$;
grant execute on function public.admin_send_weekly_digest() to authenticated;

-- ================ Planification hebdomadaire (pg_cron) ================
-- Dimanche 17:00 UTC ≈ 18–19 h à Paris : le récap arrive la veille au soir de
-- la semaine qu'il couvre. Best-effort, comme les autres jobs du projet.
do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule('mister-doc-weekly-digest', '0 17 * * 0',
    'select public.enqueue_weekly_digest()');
exception when others then
  raise notice 'pg_cron indisponible : planifier le récap manuellement.';
end;
$$;
