-- 0016 — Étend le verrou de mois aux HNC, notes de jour et vœux.
--
-- Le verrou de mois (table `locked_months`, migration 0005) empêchait déjà toute
-- écriture de gardes (`shifts`) et d'absences (`leaves`) sur un mois verrouillé,
-- via le trigger générique `assert_month_unlocked()` (qui lit `new/old.work_date`).
-- Mais `hnc_hours`, `day_notes` et `wishes` n'étaient PAS protégés : on pouvait
-- encore modifier heures non cliniques, notes et vœux sur un mois figé.
--
-- Les trois tables ont une colonne `work_date` → on réutilise TEL QUEL le même
-- trigger. (Le mode restauration `session_replication_role = replica` désactive ces
-- triggers, comme pour shifts/leaves : `admin_restore` n'est pas gêné.) Idempotent.

drop trigger if exists hnc_lock_guard on public.hnc_hours;
create trigger hnc_lock_guard
  before insert or update or delete on public.hnc_hours
  for each row execute function public.assert_month_unlocked();

drop trigger if exists day_notes_lock_guard on public.day_notes;
create trigger day_notes_lock_guard
  before insert or update or delete on public.day_notes
  for each row execute function public.assert_month_unlocked();

drop trigger if exists wishes_lock_guard on public.wishes;
create trigger wishes_lock_guard
  before insert or update or delete on public.wishes
  for each row execute function public.assert_month_unlocked();
