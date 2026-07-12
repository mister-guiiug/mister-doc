-- mister-doc — Historique des changements d'une case (créneau clinique)
-- ---------------------------------------------------------------------------
-- Chaque affectation/réaffectation/libération d'un créneau est journalisée dans
-- `shift_history` par un trigger. L'app affiche les ~10 derniers changements
-- d'une case au clic. Lisible par tout médecin approuvé ; écrit uniquement par
-- le trigger (SECURITY DEFINER). Le mode restauration (session_replication_role
-- = replica) désactive les triggers → pas de pollution de l'historique.
-- ---------------------------------------------------------------------------

create table if not exists public.shift_history (
  id             uuid primary key default gen_random_uuid(),
  work_date      date not null,
  shift_type     text not null,
  action         text not null check (action in ('assigned', 'reassigned', 'removed')),
  doctor_id      uuid references public.doctors (id) on delete set null,
  prev_doctor_id uuid references public.doctors (id) on delete set null,
  changed_by     uuid references public.doctors (id) on delete set null,
  changed_at     timestamptz not null default now()
);
comment on table public.shift_history is
  'Journal des changements d''affectation par créneau (case). Alimenté par trigger.';

create index if not exists shift_history_slot_idx
  on public.shift_history (work_date, shift_type, changed_at desc);

alter table public.shift_history enable row level security;
drop policy if exists shift_history_select on public.shift_history;
create policy shift_history_select on public.shift_history
  for select to authenticated using (public.is_approved());
-- Aucune policy d'écriture : seul le trigger (SECURITY DEFINER) insère.

create or replace function public.trg_shift_history()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(
    public.current_doctor_id(),
    (case when TG_OP = 'DELETE' then OLD.created_by else NEW.created_by end)
  );
begin
  if TG_OP = 'INSERT' then
    insert into public.shift_history(work_date, shift_type, action, doctor_id, prev_doctor_id, changed_by)
      values (NEW.work_date, NEW.shift_type, 'assigned', NEW.doctor_id, null, actor);
  elsif TG_OP = 'DELETE' then
    insert into public.shift_history(work_date, shift_type, action, doctor_id, prev_doctor_id, changed_by)
      values (OLD.work_date, OLD.shift_type, 'removed', null, OLD.doctor_id, actor);
  elsif NEW.doctor_id <> OLD.doctor_id then
    insert into public.shift_history(work_date, shift_type, action, doctor_id, prev_doctor_id, changed_by)
      values (NEW.work_date, NEW.shift_type, 'reassigned', NEW.doctor_id, OLD.doctor_id, actor);
  end if;
  return coalesce(NEW, OLD);
end; $$;

drop trigger if exists shifts_history on public.shifts;
create trigger shifts_history after insert or update or delete on public.shifts
  for each row execute function public.trg_shift_history();

-- Amorce : une entrée « attribué » par créneau existant (base de l'historique).
insert into public.shift_history(work_date, shift_type, action, doctor_id, changed_by, changed_at)
  select work_date, shift_type, 'assigned', doctor_id, created_by, created_at
  from public.shifts;

-- Realtime (facultatif) : rafraîchit l'historique ouvert en direct.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.shift_history;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
