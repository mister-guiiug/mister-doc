-- mister-doc — Échange de gardes + vœux/indisponibilités.

-- =============================== Vœux ===============================
-- Chaque médecin exprime, par jour, une préférence (prefer) ou une
-- indisponibilité souple (avoid). Visible de tous (approuvés), éditable par soi.
create table if not exists public.wishes (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  work_date  date not null,
  kind       text not null check (kind in ('prefer', 'avoid')),
  note       text,
  created_at timestamptz not null default now(),
  unique (doctor_id, work_date)
);
create index if not exists wishes_date_idx on public.wishes (work_date);

alter table public.wishes enable row level security;
drop policy if exists wishes_select on public.wishes;
create policy wishes_select on public.wishes
  for select to authenticated using (public.is_approved());
drop policy if exists wishes_insert on public.wishes;
create policy wishes_insert on public.wishes
  for insert to authenticated with check (doctor_id = public.current_doctor_id());
drop policy if exists wishes_update on public.wishes;
create policy wishes_update on public.wishes
  for update to authenticated
  using (doctor_id = public.current_doctor_id())
  with check (doctor_id = public.current_doctor_id());
drop policy if exists wishes_delete on public.wishes;
create policy wishes_delete on public.wishes
  for delete to authenticated using (doctor_id = public.current_doctor_id());

-- ========================= Échanges de gardes =========================
create table if not exists public.swap_requests (
  id          uuid primary key default gen_random_uuid(),
  work_date   date not null,
  shift_type  text not null check (shift_type in ('S1J', 'S1N', 'S2J', 'S3')),
  from_doctor uuid not null references public.doctors (id) on delete cascade,
  to_doctor   uuid references public.doctors (id) on delete cascade, -- null = ouvert à tous
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message     text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.doctors (id) on delete set null
);
create index if not exists swaps_status_idx on public.swap_requests (status, to_doctor);

alter table public.swap_requests enable row level security;
drop policy if exists swaps_select on public.swap_requests;
create policy swaps_select on public.swap_requests
  for select to authenticated using (public.is_approved());
-- Écritures via RPC uniquement.

-- Proposer un échange de MA garde (ciblé ou ouvert).
create or replace function public.propose_swap(
  p_work_date date, p_shift_type text, p_to_doctor uuid, p_message text)
  returns public.swap_requests
  language plpgsql security definer set search_path = public as $$
declare me uuid; r public.swap_requests; myname text;
begin
  me := public.current_doctor_id();
  if me is null or not public.is_approved() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.shifts
                 where work_date = p_work_date and shift_type = p_shift_type and doctor_id = me) then
    raise exception 'Vous n''êtes pas affecté à ce créneau.';
  end if;
  if exists (select 1 from public.swap_requests
             where work_date = p_work_date and shift_type = p_shift_type
               and from_doctor = me and status = 'pending') then
    raise exception 'Une proposition est déjà en cours pour ce créneau.';
  end if;
  insert into public.swap_requests(work_date, shift_type, from_doctor, to_doctor, message)
    values (p_work_date, p_shift_type, me, p_to_doctor, nullif(trim(p_message), ''))
    returning * into r;
  if p_to_doctor is not null then
    select name into myname from public.doctors where id = me;
    perform public.notify_doctor(p_to_doctor, 'swap_offer', 'Proposition d''échange',
      coalesce(myname, 'Un médecin') || ' vous propose ' || public.shift_label(p_shift_type)
        || ' le ' || to_char(p_work_date, 'DD/MM/YYYY'), p_work_date);
  end if;
  return r;
end; $$;
grant execute on function public.propose_swap(date, text, uuid, text) to authenticated;

-- Accepter un échange : réaffecte la garde au demandeur.
create or replace function public.accept_swap(p_id uuid)
  returns public.swap_requests
  language plpgsql security definer set search_path = public as $$
declare me uuid; r public.swap_requests; myname text; n int;
begin
  me := public.current_doctor_id();
  if me is null or not public.is_approved() then raise exception 'forbidden'; end if;
  select * into r from public.swap_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Proposition indisponible.'; end if;
  if r.to_doctor is not null and r.to_doctor <> me then raise exception 'Proposition non destinée à vous.'; end if;
  if r.from_doctor = me then raise exception 'Vous ne pouvez pas accepter votre propre proposition.'; end if;

  update public.shifts set doctor_id = me, updated_by = me
    where work_date = r.work_date and shift_type = r.shift_type and doctor_id = r.from_doctor;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'La garde a déjà été réattribuée.'; end if;

  update public.swap_requests set status = 'accepted', resolved_at = now(), resolved_by = me
    where id = p_id returning * into r;
  -- annule les autres propositions en cours sur le même créneau
  update public.swap_requests set status = 'cancelled', resolved_at = now()
    where work_date = r.work_date and shift_type = r.shift_type and status = 'pending' and id <> p_id;

  select name into myname from public.doctors where id = me;
  perform public.notify_doctor(r.from_doctor, 'swap_accepted', 'Échange accepté',
    coalesce(myname, 'Un médecin') || ' reprend ' || public.shift_label(r.shift_type)
      || ' le ' || to_char(r.work_date, 'DD/MM/YYYY'), r.work_date);
  return r;
end; $$;
grant execute on function public.accept_swap(uuid) to authenticated;

-- Décliner (par le destinataire).
create or replace function public.decline_swap(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare me uuid; r public.swap_requests; myname text;
begin
  me := public.current_doctor_id();
  select * into r from public.swap_requests where id = p_id;
  if not found or r.status <> 'pending' then raise exception 'Proposition indisponible.'; end if;
  if r.to_doctor is distinct from me then raise exception 'forbidden'; end if;
  update public.swap_requests set status = 'declined', resolved_at = now(), resolved_by = me where id = p_id;
  select name into myname from public.doctors where id = me;
  perform public.notify_doctor(r.from_doctor, 'swap_declined', 'Échange décliné',
    coalesce(myname, 'Un médecin') || ' a décliné ' || public.shift_label(r.shift_type)
      || ' le ' || to_char(r.work_date, 'DD/MM/YYYY'), r.work_date);
end; $$;
grant execute on function public.decline_swap(uuid) to authenticated;

-- Annuler (par le demandeur).
create or replace function public.cancel_swap(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  me := public.current_doctor_id();
  update public.swap_requests set status = 'cancelled', resolved_at = now()
    where id = p_id and from_doctor = me and status = 'pending';
  if not found then raise exception 'forbidden'; end if;
end; $$;
grant execute on function public.cancel_swap(uuid) to authenticated;

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.wishes; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.swap_requests; exception when duplicate_object then null; end;
  end if;
end; $$;
