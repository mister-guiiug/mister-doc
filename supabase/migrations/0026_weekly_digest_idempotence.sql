-- mister-doc — Récapitulatif hebdomadaire : clé d'idempotence ancrée sur la semaine.
-- ---------------------------------------------------------------------------
-- `0024` datait le récapitulatif de `current_date + 1` et s'en servait comme clé
-- « déjà envoyé ». Cela ne dédoublonne QUE si la fonction s'exécute toujours le
-- même jour. Or le bouton admin existe précisément pour le test et le
-- rattrapage : lancé un mercredi après le passage du cron du dimanche, il
-- produisait une SECONDE notification pour la même semaine.
--
-- La clé devient le LUNDI de la semaine du premier jour couvert
-- (`date_trunc('week', …)`, qui suit la semaine ISO commençant le lundi). Deux
-- exécutions visant la même semaine portent donc la même clé, quel que soit le
-- jour où on les déclenche.
--
-- Les récapitulatifs déjà envoyés par le cron du dimanche portaient déjà un
-- lundi : leur clé est inchangée, aucune reprise de données n'est nécessaire.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_weekly_digest()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with periode as (
    select
      (current_date + 1) as debut,
      (current_date + 7) as fin,
      -- Identifie la SEMAINE notifiée, indépendamment du jour de déclenchement.
      date_trunc('week', (current_date + 1)::timestamp)::date as semaine
  ),
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
    p.semaine
  from recap r cross join periode p
  where not exists (
    select 1 from public.notifications x
    where x.doctor_id = r.doctor_id
      and x.type = 'weekly_digest'
      and x.work_date = p.semaine
  );
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.enqueue_weekly_digest() from public;
