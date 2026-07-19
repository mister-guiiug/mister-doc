-- mister-doc — Rappels de garde programmés (push « garde demain » / « nuit ce soir »).
-- ---------------------------------------------------------------------------
-- Un job pg_cron quotidien insère des notifications de rappel ; l'insertion dans
-- `public.notifications` déclenche le webhook base → Edge Function « push », donc
-- le rappel part en Web Push (et apparaît aussi dans la cloche in-app en Realtime).
-- Aucune nouvelle Edge Function : on réutilise tout le pipeline de notifications.
--
-- Deux rappels, calculés chaque soir :
--   • « Garde demain »  : toute garde du lendemain (current_date + 1) ;
--   • « Nuit ce soir »  : garde du jour dont le type est marqué `is_night`.
--
-- Dépendance : requiert `public.shift_types` (migration 0022) pour `is_night`.
-- Idempotent : ne re-notifie jamais un même (médecin, type, date) déjà rappelé.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_shift_reminders()
  returns int language plpgsql security definer set search_path = public as $$
declare total int := 0; n int;
begin
  -- « Garde demain » : gardes du lendemain, pour les médecins ayant un compte.
  insert into public.notifications (doctor_id, type, title, body, work_date)
  select s.doctor_id, 'shift_reminder', 'Garde demain',
         public.shift_label(s.shift_type) || ' le ' || to_char(s.work_date, 'DD/MM/YYYY'),
         s.work_date
  from public.shifts s
  join public.doctors d on d.id = s.doctor_id and d.auth_id is not null
  where s.work_date = current_date + 1
    and not exists (
      select 1 from public.notifications x
      where x.doctor_id = s.doctor_id and x.type = 'shift_reminder'
        and x.work_date = s.work_date
    );
  get diagnostics n = row_count; total := total + n;

  -- « Nuit ce soir » : gardes du jour dont le type est une nuit (is_night).
  insert into public.notifications (doctor_id, type, title, body, work_date)
  select s.doctor_id, 'night_reminder', 'Nuit ce soir',
         'Vous êtes de nuit : ' || public.shift_label(s.shift_type)
           || ' le ' || to_char(s.work_date, 'DD/MM/YYYY'),
         s.work_date
  from public.shifts s
  join public.doctors d on d.id = s.doctor_id and d.auth_id is not null
  join public.shift_types t on t.code = s.shift_type and t.is_night
  where s.work_date = current_date
    and not exists (
      select 1 from public.notifications x
      where x.doctor_id = s.doctor_id and x.type = 'night_reminder'
        and x.work_date = s.work_date
    );
  get diagnostics n = row_count; total := total + n;

  return total;
end; $$;
-- Appelée par pg_cron (propriétaire) et par le wrapper admin ci-dessous ; jamais
-- directement par un client.
revoke all on function public.enqueue_shift_reminders() from public;

-- Déclenchement manuel réservé aux admins (test / rattrapage). Renvoie le nombre
-- de rappels créés.
create or replace function public.admin_send_reminders()
  returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return public.enqueue_shift_reminders();
end; $$;
grant execute on function public.admin_send_reminders() to authenticated;

-- ================ Planification quotidienne (pg_cron) ================
-- Best-effort : nécessite l'extension pg_cron (dispo sur Supabase). 17:00 UTC ≈
-- 18–19 h à Paris : les rappels « demain » et « nuit ce soir » partent en soirée.
-- L'heure est réglable en réordonnançant le job (cron s'exécute en UTC).
do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule('mister-doc-shift-reminders', '0 17 * * *',
    'select public.enqueue_shift_reminders()');
exception when others then
  raise notice 'pg_cron indisponible : planifier les rappels manuellement.';
end;
$$;
