-- mister-doc : qui peut exécuter les fonctions SECURITY DEFINER. pgTAP, joué
-- par `supabase test db` sur la pile jetable de la CI.
--
-- Une fonction SECURITY DEFINER s'exécute sous son propriétaire (`postgres`,
-- qui porte BYPASSRLS) : elle contourne la RLS, et seul son propre contrôle de
-- l'appelant protège les données. Supabase accorde EXECUTE à `anon` et à
-- `authenticated` sur toute fonction créée dans `public`, par un privilège PAR
-- DÉFAUT, et `revoke … from public` ne le retire pas. 0029 a retiré ce droit à
-- quatre fonctions que seuls pg_cron, les déclencheurs et les enveloppes
-- `admin_*` appellent, et refermé la garde d'`anonymize_doctor`, qui laissait
-- passer un appelant sans fiche. Ce fichier le prouve (§ 1 à 3), puis fige trois
-- invariants de structure (§ 4) :
--   - aucune table de `public` sans RLS ;
--   - les fonctions SECURITY DEFINER qu'`anon` peut exécuter forment une liste
--     RELUE. Une fonction neuve qui n'y figure pas fait échouer ce test : lui
--     retirer `anon` en nommant le rôle, ou l'ajouter à la liste après avoir
--     relu son contrôle de l'appelant ;
--   - aucune fonction de `public` ne lève `40001` (`serialization_failure`).
--     PostgREST prend ce code pour un échec de sérialisation passager et
--     rejoue la transaction SANS FIN : la requête ne répond jamais, et le
--     backend tourne jusqu'à ce qu'on le tue (PostgREST 14, corrigé en 16).
--     Un conflit métier se signale par `PT409`, rendu en HTTP 409. Ajouté le
--     01/10/2026, après une boucle en production sur mister-molkky.
--
-- Comme dans `barriere-approbation.test.sql`, aucune assertion n'est jouée
-- sous `anon` ni `authenticated` : on tente sous le rôle, on dépose le
-- résultat dans un réglage de session (annulé avec la transaction), et on
-- juge une fois le rôle rendu.

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(22);

-- ── Deux outils : le SQLSTATE d'une tentative, ou son message ─────────────
--
-- SECURITY INVOKER (le défaut) : ils s'exécutent sous le rôle courant, ce qui
-- est tout leur intérêt, et restent hors de la liste du § 4.

create function df_t_tenter(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return 'aucune erreur';
exception when others then return sqlstate;
end
$fn$;

create function df_t_message(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return '(aucune erreur)';
exception when others then return sqlerrm;
end
$fn$;

grant execute on function df_t_tenter(text), df_t_message(text) to authenticated, anon;

-- ── Décor : une administratrice, un médecin approuvé, un compte sans fiche ──
--
-- Dave est le cas qui compte pour `anonymize_doctor` : un compte créé par
-- l'API d'authentification, qui n'a jamais appelé `ensure_self_doctor`.
-- `current_doctor_id()` lui rend NULL, exactement comme au visiteur anonyme.

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@exemple.test', now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@exemple.test', now(), now()),
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dave@exemple.test', now(), now());

insert into public.doctors (id, auth_id, name, email, is_admin, approved)
values
  ('d0000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Alice', 'alice@exemple.test', true, true),
  ('d0000000-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'Bob', 'bob@exemple.test', false, true);

select diag(
  'privilège par défaut, mesuré : anon exécute shift_label(text), qu''aucune'
  || ' migration ne lui accorde : '
  || has_function_privilege('anon', 'public.shift_label(text)', 'execute')::text
  || '   <<< true : c''est la concession qu''un « revoke … from public »'
  || ' laisse en place.'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Quatre fonctions que plus aucun client n'exécute.                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select ok(
  not has_function_privilege('anon', 'public._mkbackup(text)', 'execute'),
  'anon n''exécute plus _mkbackup'
);
select ok(
  not has_function_privilege('authenticated', 'public._mkbackup(text)', 'execute'),
  '... authenticated non plus : seule l''enveloppe admin_backup y mène'
);
select ok(
  not has_function_privilege('anon', 'public.enqueue_shift_reminders()', 'execute'),
  'anon n''exécute plus enqueue_shift_reminders'
);
select ok(
  not has_function_privilege('authenticated', 'public.enqueue_shift_reminders()', 'execute'),
  '... authenticated non plus : pg_cron et admin_send_reminders suffisent'
);
select ok(
  not has_function_privilege('anon', 'public.enqueue_weekly_digest()', 'execute'),
  'anon n''exécute plus enqueue_weekly_digest'
);
select ok(
  not has_function_privilege('authenticated', 'public.enqueue_weekly_digest()', 'execute'),
  '... authenticated non plus : pg_cron et admin_send_weekly_digest suffisent'
);
select ok(
  not has_function_privilege('anon', 'public.notify_doctor(uuid,text,text,text,date)', 'execute'),
  'anon n''exécute plus notify_doctor'
);
select ok(
  not has_function_privilege('authenticated', 'public.notify_doctor(uuid,text,text,text,date)', 'execute'),
  '... authenticated non plus : seuls les déclencheurs et les échanges notifient'
);

-- Les chemins légitimes restent ouverts : ces enveloppes vérifient is_admin()
-- et appellent la fonction retirée sous leur propriétaire.
select ok(
  has_function_privilege('authenticated', 'public.admin_backup()', 'execute'),
  'admin_backup reste appelable par un compte (elle exige is_admin)'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_send_reminders()', 'execute'),
  'admin_send_reminders aussi'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_send_weekly_digest()', 'execute'),
  'admin_send_weekly_digest aussi'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. À l'exécution, le refus est un 42501, pas un contrôle qui rattrape.   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set role anon;
select set_config('df.res',
  df_t_tenter($$ select public._mkbackup('auto') $$), true);
reset role;

select is(
  current_setting('df.res'), '42501',
  'la clé publique du bundle ne lance plus de sauvegarde'
);

-- Bob, approuvé, voit les identifiants de ses confrères : il ne doit pas
-- pouvoir leur écrire une notification (donc un Web Push) de son choix.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('df.res',
  df_t_tenter($$
    select public.notify_doctor('d0000000-0000-4000-8000-000000000001',
      'shift_assigned', 'Titre libre', 'Texte libre', current_date)
  $$), true);
reset role;

select is(
  current_setting('df.res'), '42501',
  'un médecin connecté n''écrit plus de notification à un confrère'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. anonymize_doctor : un appelant sans fiche est refusé.                 ║
-- ║                                                                          ║
-- ║ Avant 0029, `not (false or null)` valait NULL et `if NULL` ne levait     ║
-- ║ pas : le visiteur anonyme anonymisait le médecin visé et supprimait son  ║
-- ║ compte d'authentification.                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set role anon;
select set_config('df.res',
  df_t_message($$ select public.anonymize_doctor('d0000000-0000-4000-8000-000000000002') $$),
  true);
reset role;

select is(
  current_setting('df.res'), 'forbidden',
  'anonymize_doctor refuse la clé publique'
);
select is(
  (select name from public.doctors where id = 'd0000000-0000-4000-8000-000000000002'),
  'Bob',
  '... et la fiche de Bob est intacte'
);
select ok(
  exists (select 1 from auth.users where id = '22222222-2222-2222-2222-222222222222'),
  '... comme son compte d''authentification'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('df.res',
  df_t_message($$ select public.anonymize_doctor('d0000000-0000-4000-8000-000000000002') $$),
  true);
reset role;

select is(
  current_setting('df.res'), 'forbidden',
  'un compte connecté SANS fiche est refusé de même'
);

-- Le droit à l'effacement tient toujours : Bob s'anonymise lui-même.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('df.res',
  df_t_message($$ select public.anonymize_doctor('d0000000-0000-4000-8000-000000000002') $$),
  true);
reset role;

select is(
  current_setting('df.res'), '(aucune erreur)',
  'Bob peut toujours s''anonymiser lui-même'
);
select is(
  (select name from public.doctors where id = 'd0000000-0000-4000-8000-000000000002'),
  'Ancien médecin (d000)',
  '... et sa fiche l''est bien'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Trois invariants de structure.                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Les tables d'une extension (s'il y en avait dans `public`) ne relèvent pas
-- des migrations : elles sont écartées.
select is_empty(
  $$
    select c.relname::text
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p')
       and not c.relrowsecurity
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
       )
  $$,
  'aucune table de public sans RLS'
);

-- La liste relue le 29/09/2026. Chacune contrôle son appelant (is_admin(),
-- is_approved(), current_doctor_id() ou auth.uid() non NULL), sauf les
-- lectures sans enjeu (shift_label, shift_hours) et les aides de la RLS
-- (is_admin, is_approved, current_doctor_id), qui ne rendent que ce qui
-- concerne l'appelant.
select set_eq(
  $$
    select p.proname::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind = 'f'
       and p.prosecdef
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and has_function_privilege('anon', p.oid, 'execute')
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
  $$,
  array[
    'accept_swap', 'admin_add_roster', 'admin_backup', 'admin_delete_doctor',
    'admin_delete_shift_type', 'admin_reject_doctor', 'admin_reorder_shift_types',
    'admin_reset_mfa', 'admin_restore', 'admin_send_reminders',
    'admin_send_weekly_digest', 'admin_set_doctor', 'admin_set_shift_type_active',
    'admin_update_doctor', 'admin_upsert_shift_type', 'anonymize_doctor',
    'calendar_token', 'calendar_token_status', 'cancel_swap', 'claim_admin',
    'current_doctor_id', 'decline_swap', 'delete_my_account', 'ensure_self_doctor',
    'generate_mfa_recovery_codes', 'get_settings', 'is_admin', 'is_approved',
    'mark_all_notifications_read', 'my_calendar_token', 'propose_swap',
    'rotate_calendar_token', 'set_settings', 'shift_hours', 'shift_label',
    'update_my_profile', 'use_mfa_recovery_code'
  ],
  'les fonctions SECURITY DEFINER exécutables par anon sont exactement la liste relue'
);

-- Le corps entier est lu, commentaires compris : une fonction qui ne fait que
-- CITER le code échoue aussi. C'est voulu, la règle reste simple à tenir. Les
-- outils `df_t_*` de ce fichier n'en parlent pas.
select is_empty(
  $$
    select p.proname::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind in ('f', 'p')
       and pg_get_functiondef(p.oid) ~* '40001|serialization_failure'
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
  $$,
  'aucune fonction de public ne lève 40001 : PostgREST la rejouerait sans fin'
);

select * from finish();

rollback;
