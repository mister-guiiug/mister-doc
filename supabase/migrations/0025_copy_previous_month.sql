-- mister-doc — Copie du mois précédent (gardes) :
--   1. Notifications d'affectation GROUPÉES à l'insertion : reprendre un mois
--      crée ~90 gardes d'un coup, or `shifts_notify` (0006) est `for each row`
--      → une notification (et un push) par ligne, soit une dizaine par médecin.
--      Même remède que 0012 pour les congés : trigger de niveau INSTRUCTION
--      avec table de transition, une seule notification par médecin et par lot.
--      UPDATE et DELETE restent par ligne : leur logique diffère (réaffectation
--      = retrait + attribution) et ils ne partent jamais en masse.
--   2. RPC d'insertion en lot `assign_shifts_bulk` : tout le lot dans UNE
--      transaction, sans jamais écraser un créneau déjà attribué.

-- ================= Notifications d'affectation (groupées) =================

-- L'INSERT est désormais traité par `trg_notify_shift_ins` (ci-dessous) : la
-- branche correspondante disparaît d'ici, pour qu'une garde nouvellement créée
-- ne puisse jamais être notifiée deux fois.
create or replace function public.trg_notify_shift()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform public.notify_doctor(OLD.doctor_id, 'shift_removed', 'Garde retirée',
      public.shift_label(OLD.shift_type) || ' le ' || to_char(OLD.work_date, 'DD/MM/YYYY'), OLD.work_date);
  elsif TG_OP = 'UPDATE' and NEW.doctor_id <> OLD.doctor_id then
    perform public.notify_doctor(OLD.doctor_id, 'shift_removed', 'Garde retirée',
      public.shift_label(OLD.shift_type) || ' le ' || to_char(OLD.work_date, 'DD/MM/YYYY'), OLD.work_date);
    perform public.notify_doctor(NEW.doctor_id, 'shift_assigned', 'Nouvelle garde',
      public.shift_label(NEW.shift_type) || ' le ' || to_char(NEW.work_date, 'DD/MM/YYYY'), NEW.work_date);
  end if;
  return coalesce(NEW, OLD);
end; $$;

-- Une notification par médecin et par instruction d'insertion. Le corps reste
-- lisible : garde unique = message historique ; petit lot = liste des dates ;
-- gros lot = plage, sur le modèle de `date_span_fr` (0012).
create or replace function public.trg_notify_shift_ins()
  returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select doctor_id,
           count(*)::int                          as n,
           min(work_date)                         as d0,
           max(work_date)                         as d1,
           min(public.shift_label(shift_type))    as lbl, -- utile si n = 1
           string_agg(
             to_char(work_date, 'DD/MM') || ' ' || public.shift_label(shift_type),
             ' · ' order by work_date, shift_type
           )                                      as detail
    from new_shifts
    group by doctor_id
  loop
    if r.n = 1 then
      perform public.notify_doctor(r.doctor_id, 'shift_assigned', 'Nouvelle garde',
        r.lbl || ' le ' || to_char(r.d0, 'DD/MM/YYYY'), r.d0);
    elsif r.n <= 8 then
      -- Assez peu nombreuses pour être listées telles quelles.
      perform public.notify_doctor(r.doctor_id, 'shift_assigned',
        r.n || ' nouvelles gardes', r.detail, r.d0);
    else
      -- Au-delà, la liste deviendrait illisible : on donne la plage couverte.
      perform public.notify_doctor(r.doctor_id, 'shift_assigned',
        r.n || ' nouvelles gardes',
        'Du ' || to_char(r.d0, 'DD/MM/YYYY') || ' au ' || to_char(r.d1, 'DD/MM/YYYY'),
        r.d0);
    end if;
  end loop;
  return null;
end; $$;

-- Remplace l'ancien trigger « insert or update or delete » par ligne.
drop trigger if exists shifts_notify on public.shifts;
create trigger shifts_notify after update or delete on public.shifts
  for each row execute function public.trg_notify_shift();

drop trigger if exists shifts_notify_ins on public.shifts;
create trigger shifts_notify_ins after insert on public.shifts
  referencing new table as new_shifts
  for each statement execute function public.trg_notify_shift_ins();

-- ===================== Insertion en lot (copie de mois) =====================
-- Fonction NORMALE (security invoker) : la RLS de `shifts`, le trigger de
-- verrou de mois (`assert_month_unlocked`) et l'historique (`trg_shift_history`)
-- s'appliquent exactement comme sur une écriture ligne à ligne. Aucun
-- contournement (pas de SECURITY DEFINER, pas de session_replication_role).
--
-- `on conflict do nothing` : un créneau déjà attribué n'est JAMAIS écrasé — la
-- copie de mois ne fait qu'ajouter. Le nombre réellement inséré est renvoyé.
create or replace function public.assign_shifts_bulk(p_rows jsonb)
  returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows doit être un tableau JSON';
  end if;

  insert into public.shifts (work_date, shift_type, doctor_id, created_by)
  select (x->>'work_date')::date, x->>'shift_type', (x->>'doctor_id')::uuid,
         public.current_doctor_id()
  from jsonb_array_elements(p_rows) x
  on conflict (work_date, shift_type) do nothing;

  get diagnostics n = row_count;
  return n;
end; $$;
comment on function public.assign_shifts_bulk(jsonb) is
  'Insère un lot de gardes [{work_date, shift_type, doctor_id}] en une transaction, sans écraser les créneaux déjà attribués. Renvoie le nombre de lignes créées.';
grant execute on function public.assign_shifts_bulk(jsonb) to authenticated;
