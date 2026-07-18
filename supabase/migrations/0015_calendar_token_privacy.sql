-- 0015 — Confidentialité du token calendrier (colonne doctors.calendar_token).
--
-- `calendar_token` est un SECRET : c'est le lien d'abonnement au flux .ics PUBLIC
-- (révocable, mais valable tant qu'il n'est pas régénéré — il survit même à une
-- désactivation de compte). Or la policy `doctors_select` laisse tout médecin
-- approuvé lire la table ENTIÈRE → aujourd'hui n'importe qui peut récupérer le lien
-- secret des autres via `select * from doctors` (fuite horizontale réelle).
--
-- On restreint la colonne AU NIVEAU DES PRIVILÈGES (défense en base, indépendante de
-- ce que demande le client). Sémantique Postgres : un simple REVOKE de colonne ne
-- suffit PAS si un GRANT niveau table subsiste (le grant table couvre toutes les
-- colonnes). On retire donc le SELECT niveau table, puis on ré-accorde le SELECT
-- colonne par colonne SAUF `calendar_token`.
--
-- Continuent de fonctionner (non affectés par les privilèges de authenticated/anon) :
--   • le propriétaire lit SON token via la RPC `my_calendar_token()` (SECURITY DEFINER) ;
--   • l'Edge Function `calendar` lit via `service_role` (grants séparés, intacts).
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : le front doit d'abord passer à un SELECT de colonnes
-- EXPLICITES (fait dans ce commit) ; appliquer cette migration AVANT que les clients
-- aient le nouveau bundle ferait échouer leurs `select *` (permission refusée sur
-- calendar_token) jusqu'au rechargement. Idempotent (revoke/grant ré-applicables).

revoke select on public.doctors from authenticated, anon;

grant select
  (id, auth_id, name, email, color, is_admin, approved, created_at)
  on public.doctors to authenticated, anon;

-- Recharge le cache de schéma PostgREST (prise en compte immédiate des privilèges).
notify pgrst, 'reload schema';
