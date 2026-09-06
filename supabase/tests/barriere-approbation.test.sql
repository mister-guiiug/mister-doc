-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ mister-doc — La barrière d'approbation. pgTAP, joué par `supabase test db`.║
-- ║                                                                          ║
-- ║ PREMIER FICHIER DE TEST DE CE DÉPÔT, et premier endroit où ses           ║
-- ║ vingt-sept migrations s'exécutent d'affilée sur une base VIDE. Le poste   ║
-- ║ de développement n'a pas de démon Docker ; la CI applique 0014→… sur le   ║
-- ║ projet hébergé par `psql` (cf. `supabase.yml`) et n'a jamais rejoué       ║
-- ║ 0001→0013, posées à la main. Ce qui suit n'avait donc, jusqu'ici, été     ║
-- ║ que RELU.                                                                ║
-- ║                                                                          ║
-- ║ CE QU'IL Y A À PROUVER ICI, et pas ailleurs. L'en-tête de `0001` énonce   ║
-- ║ le modèle de sécurité de l'application en trois phrases :                ║
-- ║                                                                          ║
-- ║   « le dépôt est public et la clé anon est dans le bundle. L'accès aux    ║
-- ║     données est donc verrouillé par une BARRIÈRE D'APPROBATION (RLS) :    ║
-- ║     un nouvel inscrit est en attente et ne voit rien tant qu'un admin ne  ║
-- ║     l'a pas approuvé. Le premier admin se débloque via un code de         ║
-- ║     bootstrap secret stocké dans app_config (jamais exposé au client). »  ║
-- ║                                                                          ║
-- ║ Trois affirmations, trois façons de tomber en silence : une policy qui    ║
-- ║ manque, un GRANT qui reste, une RPC qui ne vérifie pas son appelant. La   ║
-- ║ RLS est le seul endroit du système où une erreur d'UNE ligne expose une   ║
-- ║ table entière à une clé publique — elle mérite d'être exécutée, pas lue.  ║
-- ║                                                                          ║
-- ║ AUCUNE ASSERTION N'EST JOUÉE SOUS `authenticated` NI `anon`. Se faire     ║
-- ║ passer pour un compte sert à LIRE, pas à juger : `is()` et `ok()` vivent  ║
-- ║ dans `extensions`, et faire dépendre un verdict des droits que ces rôles  ║
-- ║ y ont, c'est se donner une chance d'échouer pour la mauvaise raison. Le   ║
-- ║ résultat de chaque tentative est déposé dans un réglage de session        ║
-- ║ (`is_local` : annulé avec la transaction), relu une fois le rôle rendu.   ║
-- ║                                                                          ║
-- ║ DEUX RÉGIMES DE PRIVILÈGES POSSIBLES, et le fichier tient dans les deux.  ║
-- ║ Le projet hébergé a été provisionné quand Supabase exposait              ║
-- ║ automatiquement toute table créée dans `public` (d'où le `revoke` de      ║
-- ║ 0015, qui n'aurait rien à révoquer sinon). Une pile neuve peut suivre la  ║
-- ║ règle inverse. Une lecture refusée par MANQUE DE PRIVILÈGE (42501) et     ║
-- ║ une lecture VIDÉE PAR LA RLS (0 ligne) ne disent pas la même chose : les  ║
-- ║ assertions nomment donc la valeur attendue par `attendu_lecture()`, et le ║
-- ║ § 1 imprime le régime réellement mesuré.                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(29);

-- ── Trois outils ──────────────────────────────────────────────────────────
--
-- `throws_ok` est surchargée et n'a été domptée par aucune combinaison de
-- casts sur ce parc (mister-miss-koh, 05/09/2026) : on rend le SQLSTATE, ou le
-- message quand c'est LUI qui porte le sens. SECURITY INVOKER (le défaut) —
-- ces fonctions s'exécutent sous le rôle courant, ce qui est tout leur intérêt.

create function doc_t_lire(p_sql text) returns text language plpgsql as $fn$
declare v text;
begin
  execute p_sql into v;
  return coalesce(v, '(nul)');
exception when others then return sqlstate;
end
$fn$;

create function doc_t_tenter(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return 'aucune erreur';
exception when others then return sqlstate;
end
$fn$;

create function doc_t_message(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return '(aucune erreur)';
exception when others then return sqlerrm;
end
$fn$;

-- La valeur attendue d'une lecture qui ne doit RIEN rendre — ou qui doit tout
-- rendre : `42501` si le rôle n'a même pas le privilège de table, la valeur
-- nominale sinon. Ce qu'on refuse, c'est de confondre les deux.
create function attendu_lecture(p_role text, p_table text, p_valeur text)
  returns text language sql as $fn$
  select case
    when has_table_privilege(p_role, p_table, 'select') then p_valeur
    else '42501'
  end
$fn$;

grant execute on function
  doc_t_lire(text), doc_t_tenter(text), doc_t_message(text)
  to authenticated, anon;

-- ── Décor : un administrateur, un approuvé, une inscrite en attente ───────
--
-- Carol est le cas qui compte : c'est l'état de TOUT compte à sa création, et
-- celui d'un intrus qui se serait inscrit avec la clé publique du bundle.

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@exemple.test', now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@exemple.test', now(), now()),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@exemple.test', now(), now());

insert into public.doctors (id, auth_id, name, email, is_admin, approved)
values
  ('d0000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Alice', 'alice@exemple.test', true, true),
  ('d0000000-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'Bob', 'bob@exemple.test', false, true),
  ('d0000000-0000-4000-8000-000000000003',
   '33333333-3333-3333-3333-333333333333',
   'Carol', 'carol@exemple.test', false, false);

-- Le secret d'amorçage. `0001` insère la ligne avec un code NUL (le vrai est
-- injecté hors dépôt) : on en pose un ici pour pouvoir vérifier qu'il ne sort
-- pas — un `null` ne prouverait rien, il ne fuit jamais.
update public.app_config set bootstrap_code = 'CODE-AMORCAGE-DE-TEST' where id = 1;

insert into public.shifts (work_date, shift_type, doctor_id)
values
  ('2099-01-05', 'S1J', 'd0000000-0000-4000-8000-000000000001'),
  ('2099-01-05', 'S1N', 'd0000000-0000-4000-8000-000000000002');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Les faits, imprimés — ce que le journal d'Actions doit montrer.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select diag(
  'privilège de table SELECT — authenticated sur shifts : '
  || has_table_privilege('authenticated', 'public.shifts', 'select')::text
  || '   <<< LE régime. false => la RLS de 0001 n''est même pas atteinte ici,'
  || ' et une base RECONSTRUITE depuis ces seules migrations serait muette.'
);

select diag(
  'privilège de table SELECT — anon sur shifts          : '
  || has_table_privilege('anon', 'public.shifts', 'select')::text
);

select diag(
  'privilège de table SELECT — authenticated sur doctors : '
  || has_table_privilege('authenticated', 'public.doctors', 'select')::text
  || '   <<< false ATTENDU : 0015 retire le privilège de TABLE et le rend'
  || ' colonne par colonne, pour soustraire calendar_token.'
);

select diag(
  'rolbypassrls(postgres) : '
  || (select rolbypassrls::text from pg_roles where rolname = 'postgres')
  || '   |   rolsuper(postgres) : '
  || (select rolsuper::text from pg_roles where rolname = 'postgres')
);

select diag(
  'schéma de pgcrypto : '
  || coalesce(
       (select n.nspname from pg_extension e
          join pg_namespace n on n.oid = e.extnamespace
         where e.extname = 'pgcrypto'),
       '(absente)')
  || '   <<< 0018 appelle extensions.digest() en clair, 0021 compte sur'
  || ' « set search_path = public, extensions ». Le § 5 exécute les deux.'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Le code d'amorçage ne sort pas de la base.                            ║
-- ║                                                                          ║
-- ║ C'est la clé du premier compte administrateur. Le dépôt est public, la    ║
-- ║ clé anon est dans le bundle : si `app_config` était lisible, n'importe    ║
-- ║ qui deviendrait administrateur du planning de garde d'un hôpital.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select ok(
  (select relrowsecurity from pg_class where oid = 'public.app_config'::regclass),
  'app_config a la RLS active'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'app_config'),
  0,
  '... et AUCUNE politique : le verrou n''est pas un filtre, c''est une absence de porte'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.res',
  doc_t_lire($$ select coalesce(max(bootstrap_code), '(nul)') from public.app_config $$),
  true);
reset role;

select isnt(
  current_setting('doc.res'),
  'CODE-AMORCAGE-DE-TEST',
  'même l''ADMINISTRATRICE connectée n''obtient pas le code d''amorçage'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set role anon;
select set_config('doc.res',
  doc_t_lire($$ select coalesce(max(bootstrap_code), '(nul)') from public.app_config $$),
  true);
reset role;

select isnt(
  current_setting('doc.res'),
  'CODE-AMORCAGE-DE-TEST',
  '... et la clé publique du bundle non plus'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. La barrière : en attente, on ne voit que soi.                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select is(
  (select count(*)::int from public.doctors),
  3,
  'décor : trois médecins, dont une inscrite en attente d''approbation'
);

-- Carol, `approved = false`.
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.roster',
  doc_t_lire($$ select count(*)::text from public.doctors $$), true);
select set_config('doc.nom',
  doc_t_lire($$ select max(name) from public.doctors $$), true);
select set_config('doc.gardes',
  doc_t_lire($$ select count(*)::text from public.shifts $$), true);
reset role;

select is(
  current_setting('doc.roster'), '1',
  'en attente, Carol ne voit qu''UNE ligne du roster'
);

select is(
  current_setting('doc.nom'), 'Carol',
  '... et c''est la sienne : ni les noms ni les adresses des autres médecins'
);

select is(
  current_setting('doc.gardes'),
  attendu_lecture('authenticated', 'public.shifts', '0'),
  '... et le planning entier lui reste invisible'
);

-- Bob, approuvé : la barrière s'ouvre, et pas avant.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.roster',
  doc_t_lire($$ select count(*)::text from public.doctors $$), true);
select set_config('doc.gardes',
  doc_t_lire($$ select count(*)::text from public.shifts $$), true);
reset role;

select is(
  current_setting('doc.roster'), '3',
  'approuvé, Bob voit tout le roster'
);

select is(
  current_setting('doc.gardes'),
  attendu_lecture('authenticated', 'public.shifts', '2'),
  '... et le planning : l''édition est partagée entre médecins approuvés'
);

-- Le visiteur anonyme — c'est-à-dire la clé publiée dans le bundle.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set role anon;
select set_config('doc.roster',
  doc_t_lire($$ select count(*)::text from public.doctors $$), true);
select set_config('doc.gardes',
  doc_t_lire($$ select count(*)::text from public.shifts $$), true);
reset role;

select is(
  current_setting('doc.roster'), '0',
  'un visiteur anonyme ne voit aucun médecin (les politiques ne parlent qu''à authenticated)'
);

select is(
  current_setting('doc.gardes'),
  attendu_lecture('anon', 'public.shifts', '0'),
  '... ni aucune garde'
);

-- Et l'assertion qui fait la différence entre « verrouillé » et « vide » : si
-- elle tombe, les six précédentes ne prouvent plus rien de la RLS — elles ne
-- constateraient qu'une absence de GRANT, qui ne serait pas celle de l'hébergé.
select ok(
  has_table_privilege('authenticated', 'public.shifts', 'select'),
  'un médecin connecté a bien le privilège de LIRE shifts — sinon rien, ci-dessus, ne teste la RLS, et une base reconstruite depuis ces migrations serait une application morte'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Personne ne s'attribue ses propres droits.                            ║
-- ║                                                                          ║
-- ║ LE MODE D'ÉCHEC REDOUTÉ EST LE SILENCE : sans policy d'UPDATE, une        ║
-- ║ écriture refusée ne lève pas, elle ne touche AUCUNE ligne. On regarde     ║
-- ║ donc l'état APRÈS, jamais le seul fait que l'appel n'ait pas levé.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.res', doc_t_tenter(
  $$ update public.doctors set approved = true, is_admin = true
      where auth_id = auth.uid() $$), true);
reset role;

select ok(
  (select not approved and not is_admin from public.doctors
    where id = 'd0000000-0000-4000-8000-000000000003'),
  'Carol ne s''approuve pas elle-même : aucune policy d''UPDATE sur doctors, toutes les écritures passent par RPC (tentative : ' || current_setting('doc.res') || ')'
);

-- `claim_admin` vérifie l'existence d'un administrateur AVANT de comparer le
-- code. L'ordre est le fond du sujet : une fois le premier admin nommé, le
-- secret d'amorçage ne vaut plus rien, même exact. Les deux assertions
-- suivantes figent ce fait — la seconde est la seule qui compte le jour où le
-- code fuite.
set role authenticated;
select set_config('doc.faux',
  doc_t_message($$ select public.claim_admin('MAUVAIS-CODE') $$), true);
select set_config('doc.vrai',
  doc_t_message($$ select public.claim_admin('CODE-AMORCAGE-DE-TEST') $$), true);
reset role;

select is(
  current_setting('doc.faux'),
  'un administrateur existe déjà',
  'claim_admin refuse un mauvais code'
);

select is(
  current_setting('doc.vrai'),
  'un administrateur existe déjà',
  '... et refuse LE BON de la même façon : le code d''amorçage est périmé dès le premier administrateur'
);

select ok(
  (select not approved and not is_admin from public.doctors
    where id = 'd0000000-0000-4000-8000-000000000003'),
  '... Carol n''est toujours ni approuvée ni administratrice'
);

-- Bob est approuvé — mais approuvé n'est pas administrateur.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.res', doc_t_tenter(
  $$ select public.admin_set_doctor(
       'd0000000-0000-4000-8000-000000000003'::uuid, true, true) $$), true);
reset role;

select is(
  current_setting('doc.res'), 'P0001',
  'un médecin approuvé mais non administrateur ne peut approuver personne'
);

select ok(
  (select not approved from public.doctors
    where id = 'd0000000-0000-4000-8000-000000000003'),
  '... et l''appel n''a rien fait à moitié'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Le lien du calendrier reste secret — y compris entre médecins.        ║
-- ║                                                                          ║
-- ║ 0015 a trouvé une fuite HORIZONTALE : `doctors_select` laisse tout        ║
-- ║ médecin approuvé lire la table entière, donc le lien .ics des autres —    ║
-- ║ un secret qui survit à la désactivation d'un compte. La réponse n'est pas ║
-- ║ une policy mais un PRIVILÈGE DE COLONNE, et un privilège ne se relit pas  ║
-- ║ dans `pg_policies`. C'est le genre de chose qui ne s'observe qu'en la     ║
-- ║ jouant.                                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

set role authenticated;
select set_config('doc.token',
  doc_t_lire($$ select max(calendar_token) from public.doctors $$), true);
select set_config('doc.hash',
  doc_t_lire($$ select max(calendar_token_hash) from public.doctors $$), true);
select set_config('doc.nom',
  doc_t_lire($$ select max(name) from public.doctors $$), true);
reset role;

select is(
  current_setting('doc.token'), '42501',
  'un médecin approuvé ne peut pas lire la colonne calendar_token — pas même la sienne'
);

select is(
  current_setting('doc.hash'), '42501',
  '... ni calendar_token_hash, que 0018 a laissée hors du GRANT'
);

select is(
  current_setting('doc.nom'), 'Carol',
  '... alors qu''il lit les autres colonnes : c''est bien la colonne qui est fermée, pas la table'
);

-- L'assertion qui vaut pour l'AVENIR : une colonne ajoutée à `doctors` sans
-- décision explicite tombera d'un côté ou de l'autre par hasard. Ici, elle
-- fait échouer ce test, et la décision redevient consciente.
select is(
  (select string_agg(a.attname, ', ' order by a.attnum)
     from pg_attribute a
    where a.attrelid = 'public.doctors'::regclass
      and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'select')),
  'id, auth_id, name, email, color, is_admin, approved, created_at',
  '... et les colonnes lisibles sont EXACTEMENT les huit énumérées par 0015'
);

set role anon;
select set_config('doc.token',
  doc_t_lire($$ select max(calendar_token) from public.doctors $$), true);
reset role;

select is(
  current_setting('doc.token'), '42501',
  'la clé publique du bundle non plus ne lit la colonne du lien secret'
);

-- La RPC, elle, rend son PROPRE lien à son propriétaire — et seulement à un
-- médecin approuvé. Elle exécute `extensions.digest()` : c'est exactement la
-- ligne qui, sur miss-uwh, ne se résolvait pas en production (06/09/2026).
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.res',
  doc_t_tenter($$ select public.my_calendar_token() $$), true);
reset role;

select is(
  current_setting('doc.res'), 'P0001',
  'en attente d''approbation, Carol n''obtient pas de lien d''abonnement'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.token',
  doc_t_lire($$ select public.my_calendar_token() $$), true);
reset role;

select is(
  left(current_setting('doc.token'), 5), 'dcal_',
  'approuvé, Bob reçoit son lien en clair — une fois'
);

select ok(
  (select calendar_token is null
      and calendar_token_hash = encode(extensions.digest(current_setting('doc.token'), 'sha256'), 'hex')
     from public.doctors
    where id = 'd0000000-0000-4000-8000-000000000002'),
  '... et la base n''en garde que le SHA-256 : le lien n''est plus ré-affichable, ni volable par lecture'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Le journal d'audit ne se lit qu'administrateur.                       ║
-- ║                                                                          ║
-- ║ Il nomme qui a approuvé, promu ou supprimé qui. Les trois lignes lues     ║
-- ║ ici n'ont été écrites par personne : ce sont les triggers de 0017 qui     ║
-- ║ les ont posées en enregistrant le décor.                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

set role authenticated;
select set_config('doc.audit',
  doc_t_lire($$ select count(*)::text from public.audit_log $$), true);
reset role;

select is(
  current_setting('doc.audit'),
  attendu_lecture('authenticated', 'public.audit_log', '0'),
  'un médecin approuvé mais non administrateur ne lit rien du journal d''audit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('doc.audit',
  doc_t_lire($$ select count(*)::text from public.audit_log $$), true);
reset role;

select is(
  current_setting('doc.audit'),
  attendu_lecture('authenticated', 'public.audit_log', '3'),
  '... l''administratrice, si : les trois inscriptions du décor y sont'
);

select * from finish();

rollback;
