-- mister-doc — Renommage d'un médecin par un administrateur
-- Complète `update_my_profile` (édition de son propre profil) par une fonction
-- réservée aux admins pour renommer/recolorer n'importe quelle fiche (utile
-- pour corriger une entrée de roster ou harmoniser un nom).

create or replace function public.admin_update_doctor(
  p_id uuid, p_name text, p_color text)
  returns public.doctors
  language plpgsql security definer set search_path = public as $$
declare d public.doctors;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.doctors set
    name = coalesce(nullif(trim(p_name), ''), name),
    color = coalesce(nullif(trim(p_color), ''), color)
  where id = p_id
  returning * into d;
  if not found then raise exception 'not found'; end if;
  return d;
end;
$$;

grant execute on function public.admin_update_doctor(uuid, text, text) to authenticated;
