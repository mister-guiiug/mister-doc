-- mister-doc — Écritures de garde CONDITIONNELLES (rejeu d'une file hors ligne)
-- ---------------------------------------------------------------------------
-- POURQUOI. Jusqu'ici toute affectation passait par un upsert
-- `on conflict (work_date, shift_type) do update` : le dernier arrivé gagne.
-- C'est le bon geste EN LIGNE — le médecin voit l'occupant à l'écran et décide
-- en connaissance de cause. C'est le mauvais geste AU REJEU d'une file hors
-- ligne : l'écran que le médecin a vu date de plusieurs heures, et un upsert
-- délogerait en silence le collègue qui a pris le créneau entre-temps. Un
-- créneau a UN occupant ; deux médecins hors ligne peuvent le viser.
--
-- CE QUE CES DEUX FONCTIONS AJOUTENT. Un compare-and-set : « écris seulement
-- si le créneau est encore dans l'état que j'avais sous les yeux ». La
-- comparaison et l'écriture sont la MÊME instruction SQL — c'est la base qui
-- tranche, pas le client, et deux rejeux concurrents ne peuvent pas gagner
-- tous les deux. Le client apprend en retour QUI occupe le créneau, de quoi
-- le dire au médecin dont l'écriture est refusée.
--
-- CE QUE CES FONCTIONS NE CONTOURNENT PAS. `security invoker`, comme
-- `assign_shifts_bulk` (0025) : la RLS de `shifts`, le verrou de mois
-- (`assert_month_unlocked`, 0005) et l'historique (`trg_shift_history`, 0011)
-- s'appliquent exactement comme sur une écriture ligne à ligne. Un rejeu sur
-- un mois verrouillé lève, et la file le classe en rejet définitif — pas en
-- boucle de rejeu.
--
-- IDEMPOTENCE. Un rejeu dont l'effet est DÉJÀ en base (même occupant visé,
-- ou créneau déjà libre) rend `applied = true` : le réseau peut couper entre
-- l'écriture et son accusé de réception, et la file réessaiera. Une deuxième
-- application ne doit pas être signalée comme un conflit.
-- ---------------------------------------------------------------------------

-- ============ Affecter un médecin si l'occupant n'a pas changé ============
-- p_expected_doctor_id NULL = « je voyais le créneau LIBRE ».
-- Renvoie { applied, holder_id, holder_name } — l'occupant APRÈS l'opération.
create or replace function public.assign_shift_if_unchanged(
  p_work_date          date,
  p_shift_type         text,
  p_doctor_id          uuid,
  p_expected_doctor_id uuid
) returns jsonb
  language plpgsql security invoker set search_path = public as $$
declare
  n            int;
  v_applied    boolean := false;
  v_holder     uuid;
  v_holder_nom text;
begin
  if p_doctor_id is null then
    raise exception 'p_doctor_id est obligatoire';
  end if;

  if p_expected_doctor_id is null then
    -- Créneau vu LIBRE : on ne prend que s'il l'est encore. `do nothing` rend
    -- la prise atomique — deux rejeux simultanés, un seul `row_count = 1`.
    insert into public.shifts (work_date, shift_type, doctor_id, created_by)
    values (p_work_date, p_shift_type, p_doctor_id, public.current_doctor_id())
    on conflict (work_date, shift_type) do nothing;
    get diagnostics n = row_count;
    v_applied := n = 1;
  else
    -- Réaffectation : on ne remplace QUE l'occupant qu'on avait sous les yeux.
    update public.shifts
       set doctor_id = p_doctor_id, created_by = public.current_doctor_id()
     where work_date  = p_work_date
       and shift_type = p_shift_type
       and doctor_id  = p_expected_doctor_id;
    get diagnostics n = row_count;
    v_applied := n = 1;
  end if;

  select s.doctor_id, d.name into v_holder, v_holder_nom
    from public.shifts s
    left join public.doctors d on d.id = s.doctor_id
   where s.work_date = p_work_date and s.shift_type = p_shift_type;

  -- Déjà dans l'état voulu : rejeu d'une opération qui avait abouti, pas un
  -- conflit. Sans cette ligne, un accusé de réception perdu produirait une
  -- fausse alerte de conflit à chaque coupure réseau.
  if not v_applied and v_holder = p_doctor_id then
    v_applied := true;
  end if;

  return jsonb_build_object(
    'applied',     v_applied,
    'holder_id',   v_holder,
    'holder_name', v_holder_nom
  );
end; $$;
comment on function public.assign_shift_if_unchanged(date, text, uuid, uuid) is
  'Affecte un médecin à un créneau UNIQUEMENT si l''occupant est encore celui '
  'attendu (NULL = créneau vu libre). Pour le rejeu d''une file d''écritures '
  'hors ligne : ne délogera jamais un collègue arrivé entre-temps. Renvoie '
  '{applied, holder_id, holder_name}.';
grant execute on function public.assign_shift_if_unchanged(date, text, uuid, uuid)
  to authenticated;

-- ============= Libérer un créneau si l'occupant n'a pas changé =============
-- p_expected_doctor_id NULL est REFUSÉ : libérer « quel que soit l'occupant »
-- est précisément le geste qu'on veut interdire au rejeu.
create or replace function public.clear_shift_if_unchanged(
  p_work_date          date,
  p_shift_type         text,
  p_expected_doctor_id uuid
) returns jsonb
  language plpgsql security invoker set search_path = public as $$
declare
  n            int;
  v_applied    boolean := false;
  v_holder     uuid;
  v_holder_nom text;
begin
  if p_expected_doctor_id is null then
    raise exception 'p_expected_doctor_id est obligatoire : libérer sans savoir qui occupe le créneau est refusé';
  end if;

  delete from public.shifts
   where work_date  = p_work_date
     and shift_type = p_shift_type
     and doctor_id  = p_expected_doctor_id;
  get diagnostics n = row_count;
  v_applied := n = 1;

  select s.doctor_id, d.name into v_holder, v_holder_nom
    from public.shifts s
    left join public.doctors d on d.id = s.doctor_id
   where s.work_date = p_work_date and s.shift_type = p_shift_type;

  -- Déjà libre : le geste a abouti (rejeu), ce n'est pas un conflit.
  if not v_applied and v_holder is null then
    v_applied := true;
  end if;

  return jsonb_build_object(
    'applied',     v_applied,
    'holder_id',   v_holder,
    'holder_name', v_holder_nom
  );
end; $$;
comment on function public.clear_shift_if_unchanged(date, text, uuid) is
  'Libère un créneau UNIQUEMENT si son occupant est encore celui attendu. Pour '
  'le rejeu d''une file d''écritures hors ligne. Renvoie {applied, holder_id, '
  'holder_name}.';
grant execute on function public.clear_shift_if_unchanged(date, text, uuid)
  to authenticated;
