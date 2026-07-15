-- mister-doc — Améliorations des notifications :
--   1. Congés groupés  : une seule notif par plage posée/supprimée (fini le spam
--      « 1 notif par jour » quand on pose un congé de plusieurs jours).
--   2. Heures non cliniques : notif quand un AUTRE médecin en saisit pour vous.
--   3. Verrouillage de mois : notif à toute l'équipe (verrou / déverrou).
-- Les notifications restent créées côté serveur (triggers) : jamais par le
-- client. `notify_doctor` n'auto-notifie pas l'auteur de l'action.

-- Nom de mois français depuis un index 0-11 (comme en base : 0 = janvier).
create or replace function public.month_fr(m int) returns text
  language sql immutable as $$
  select (array['janvier','février','mars','avril','mai','juin','juillet',
    'août','septembre','octobre','novembre','décembre'])[m + 1];
$$;

-- Fragment « le JJ/MM/AAAA » (jour seul) ou « du … au … (N j) » (plage).
create or replace function public.date_span_fr(d0 date, d1 date, n int)
  returns text language sql immutable as $$
  select case when d0 = d1
    then ' le ' || to_char(d0, 'DD/MM/YYYY')
    else ' du ' || to_char(d0, 'DD/MM/YYYY') || ' au ' || to_char(d1, 'DD/MM/YYYY')
         || ' (' || n || ' j)' end;
$$;

-- ============================ Congés (groupés) ============================
-- Déclencheurs de niveau INSTRUCTION avec tables de transition : une plage
-- posée/retirée en une requête = une seule notification par (médecin, type).

create or replace function public.trg_notify_leave_ins()
  returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select doctor_id, kind, min(work_date) d0, max(work_date) d1, count(*)::int n
    from new_leaves group by doctor_id, kind
  loop
    perform public.notify_doctor(r.doctor_id, 'leave_added', 'Absence enregistrée',
      (case r.kind when 'training' then 'Formation' else 'Congé annuel' end)
        || public.date_span_fr(r.d0, r.d1, r.n),
      r.d0);
  end loop;
  return null;
end; $$;

create or replace function public.trg_notify_leave_del()
  returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select doctor_id, kind, min(work_date) d0, max(work_date) d1, count(*)::int n
    from old_leaves group by doctor_id, kind
  loop
    perform public.notify_doctor(r.doctor_id, 'leave_removed', 'Absence supprimée',
      (case r.kind when 'training' then 'Formation' else 'Congé annuel' end)
        || public.date_span_fr(r.d0, r.d1, r.n),
      r.d0);
  end loop;
  return null;
end; $$;

-- Remplace l'ancien trigger par-ligne à l'insertion.
drop trigger if exists leaves_notify on public.leaves;
create trigger leaves_notify after insert on public.leaves
  referencing new table as new_leaves
  for each statement execute function public.trg_notify_leave_ins();
drop function if exists public.trg_notify_leave();

drop trigger if exists leaves_notify_del on public.leaves;
create trigger leaves_notify_del after delete on public.leaves
  referencing old table as old_leaves
  for each statement execute function public.trg_notify_leave_del();

-- ======================== Heures non cliniques ========================
-- Notifie le médecin quand quelqu'un d'AUTRE saisit ses HNC (create only :
-- une simple édition d'heures — UPDATE via l'upsert — ne re-notifie pas).
create or replace function public.trg_notify_hnc()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_doctor(NEW.doctor_id, 'hnc_added', 'Heures non cliniques',
    rtrim(rtrim(to_char(NEW.hours, 'FM99990.0'), '0'), '.') || ' h le '
      || to_char(NEW.work_date, 'DD/MM/YYYY'),
    NEW.work_date);
  return NEW;
end; $$;
drop trigger if exists hnc_notify on public.hnc_hours;
create trigger hnc_notify after insert on public.hnc_hours
  for each row execute function public.trg_notify_hnc();

-- ========================= Verrouillage de mois =========================
-- Le verrou/déverrou concerne tout le monde : notif à tous les médecins
-- approuvés (l'auteur est ignoré par `notify_doctor`).
create or replace function public.trg_notify_lock()
  returns trigger language plpgsql security definer set search_path = public as $$
declare d record; ml text;
begin
  if TG_OP = 'INSERT' then
    ml := public.month_fr(NEW.month) || ' ' || NEW.year;
    for d in select id from public.doctors where approved loop
      perform public.notify_doctor(d.id, 'month_locked', 'Mois verrouillé',
        'Le planning de ' || ml || ' est verrouillé.',
        make_date(NEW.year, NEW.month + 1, 1));
    end loop;
  elsif TG_OP = 'DELETE' then
    ml := public.month_fr(OLD.month) || ' ' || OLD.year;
    for d in select id from public.doctors where approved loop
      perform public.notify_doctor(d.id, 'month_unlocked', 'Mois déverrouillé',
        'Le planning de ' || ml || ' est de nouveau modifiable.',
        make_date(OLD.year, OLD.month + 1, 1));
    end loop;
  end if;
  return coalesce(NEW, OLD);
end; $$;
drop trigger if exists locks_notify on public.locked_months;
create trigger locks_notify after insert or delete on public.locked_months
  for each row execute function public.trg_notify_lock();
