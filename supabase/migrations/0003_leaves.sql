-- mister-doc — Congés annuels et formations
-- Une absence = un médecin, un jour, un type (congé annuel / formation).
-- Les formations portent un nombre d'heures. Édition partagée entre médecins
-- approuvés, comme les gardes.

create table if not exists public.leaves (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  work_date  date not null,
  kind       text not null check (kind in ('annual', 'training')),
  hours      numeric(4, 1) check (hours is null or (hours >= 0 and hours <= 24)),
  created_by uuid references public.doctors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, work_date),
  constraint training_needs_hours check (kind <> 'training' or hours is not null)
);
comment on table public.leaves is
  'Absences : congé annuel (kind=annual) ou formation (kind=training, hours = nb d''heures). 1 par médecin et par jour.';

create index if not exists leaves_work_date_idx on public.leaves (work_date);
create index if not exists leaves_doctor_idx on public.leaves (doctor_id);

alter table public.leaves enable row level security;

drop policy if exists leaves_select on public.leaves;
create policy leaves_select on public.leaves
  for select to authenticated using (public.is_approved());

drop policy if exists leaves_insert on public.leaves;
create policy leaves_insert on public.leaves
  for insert to authenticated with check (public.is_approved());

drop policy if exists leaves_update on public.leaves;
create policy leaves_update on public.leaves
  for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists leaves_delete on public.leaves;
create policy leaves_delete on public.leaves
  for delete to authenticated using (public.is_approved());

drop trigger if exists leaves_touch on public.leaves;
create trigger leaves_touch before update on public.leaves
  for each row execute function public.touch_updated_at();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.leaves;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
