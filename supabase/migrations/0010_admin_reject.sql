-- mister-doc — Rejet d'une demande de compte en attente (admin)
-- ---------------------------------------------------------------------------
-- Un admin peut REJETER une demande en attente : on supprime la fiche médecin
-- et l'utilisateur d'authentification (l'e-mail redevient disponible). Refusé
-- si le compte est déjà approuvé (utiliser la gestion normale du roster).
-- ---------------------------------------------------------------------------

create or replace function public.admin_reject_doctor(p_id uuid)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  a   uuid;
  app boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select auth_id, approved into a, app from public.doctors where id = p_id;
  if not found then raise exception 'demande introuvable'; end if;
  if app then raise exception 'compte déjà approuvé'; end if;

  delete from public.doctors where id = p_id;      -- cascade éventuelle
  if a is not null then
    delete from auth.users where id = a;           -- libère l'e-mail
  end if;
end;
$$;

grant execute on function public.admin_reject_doctor(uuid) to authenticated;
