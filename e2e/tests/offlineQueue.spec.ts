import { test, expect } from '@playwright/test';
import { setupAuthenticated, waitForMonthCache } from './mockSupabase.ts';

/**
 * LE PARCOURS QUI JUSTIFIE TOUT LE CHANTIER : un médecin en salle de garde,
 * sans réseau, pose une garde — et la retrouve partie quand le réseau revient.
 * Avant, ce geste échouait : l'application était en lecture seule hors ligne.
 *
 * Le premier test est marqué `@critical` : c'est le chemin nominal de la file
 * d'écritures. Le lancer seul : `npx playwright test --grep @critical` dans
 * `e2e/`.
 *
 * CE QUE CES QUATRE TESTS COUVRENT, ET CE QU'ILS LAISSENT AUX TESTS UNITAIRES.
 * Ici, la chaîne complète telle qu'un médecin la vit : le geste enfilé, la
 * charge utile réellement envoyée, le refus annoncé à l'écran, la file jetée à
 * la déconnexion. La MÉCANIQUE de la file — ordre de rejeu, fusion, retrait
 * exponentiel, idempotence, mois verrouillé, deux appareils concurrents — est
 * dans `src/backend/syncQueue.test.ts`, où l'on peut faire tourner deux files
 * sur un même serveur sans piloter deux navigateurs.
 */
test.describe('File d’écritures hors ligne', () => {
  test('garde posée hors ligne, envoyée au retour du réseau @critical', async ({
    page,
  }) => {
    const { goOfflineHard, goOnlineHard, rpcCalls } =
      await setupAuthenticated(page);
    await page.goto('/#/?m=2026-07');
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeVisible();
    await waitForMonthCache(page);

    // ── Le réseau tombe ────────────────────────────────────────────────
    await goOfflineHard();

    // Rien ne s'est encore passé : le badge de synchronisation se tait quand
    // la file est vide. Sans cette assertion, l'assertion suivante passerait
    // aussi avec un badge affiché en permanence — elle ne prouverait rien.
    await expect(
      page.getByRole('button', { name: 'État de la synchronisation' })
    ).toHaveCount(0);

    // ── Le médecin s'assigne le premier créneau S1N libre du mois ──────
    // C'est le 01/07 : la grille commence au 1er (juillet 2026 n'a pas de case
    // de débordement AVANT le 1er) et tous les S1N du mois sont libres dans la
    // fixture. Les boutons de créneau n'ont pas la date dans leur nom
    // accessible — `.first()` est donc le seul repère déterministe, et la date
    // est vérifiée plus bas sur la charge utile réellement envoyée.
    await page
      .getByRole('button', { name: /^S1N\b/ })
      .first()
      .click();
    await page.getByRole('button', { name: "M'assigner ce créneau" }).click();

    // Le geste est PRIS EN CHARGE, pas refusé : c'est tout le changement.
    await expect(
      page.getByText('Hors ligne — enregistré, partira au retour du réseau.')
    ).toBeVisible();

    // Et il se VOIT : le badge d'état annonce une écriture en attente.
    const badge = page.getByRole('button', {
      name: 'État de la synchronisation',
    });
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('1 en attente');

    // La garde est déjà à l'écran (écriture optimiste) : le médecin voit ce
    // qu'il a fait, il n'attend pas le réseau pour le savoir.
    await expect(
      page.getByRole('button', { name: /S1N[\s\S]*DR E2E/ }).first()
    ).toBeVisible();

    // Elle survit à un RECHARGEMENT — la file est persistée, pas en mémoire.
    await page.reload();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event('offline'));
    });
    await expect(badge).toContainText('1 en attente');

    // ── Le réseau revient ──────────────────────────────────────────────
    await goOnlineHard();

    // Le badge se tait : plus rien en attente, aucune écriture refusée.
    await expect(badge).toHaveCount(0);

    // ET la garde est réellement partie — par l'écriture CONDITIONNELLE, avec
    // l'occupant vu à l'écran (aucun : le créneau était libre). Un badge qui
    // disparaît ne prouverait rien tout seul.
    expect(rpcCalls.map(c => c.name)).toContain('assign_shift_if_unchanged');
    const appel = rpcCalls.find(c => c.name === 'assign_shift_if_unchanged');
    expect(appel?.body).toMatchObject({
      p_work_date: '2026-07-01',
      p_shift_type: 'S1N',
      p_doctor_id: 'doc-self',
      p_expected_doctor_id: null,
    });
  });

  test('l’occupant vu à l’écran part avec l’écriture différée', async ({
    page,
  }) => {
    const { goOfflineHard, goOnlineHard, rpcCalls } =
      await setupAuthenticated(page);
    await page.goto('/#/?m=2026-07');
    await expect(
      page.getByRole('button', { name: 'S1J MARTIN' })
    ).toBeVisible();
    await waitForMonthCache(page);
    await goOfflineHard();

    // Le S1J du 07/07 est OCCUPÉ par MARTIN (nom accessible unique dans la
    // grille) : le médecin le reprend, hors ligne, en connaissance de cause.
    await page.getByRole('button', { name: 'S1J MARTIN' }).click();
    await page.getByRole('button', { name: "M'assigner ce créneau" }).click();
    await expect(
      page.getByRole('button', { name: 'État de la synchronisation' })
    ).toContainText('1 en attente');

    await goOnlineHard();

    // CE QUE CE TEST PROUVE, et qu'aucun autre ne prouve : la valeur envoyée
    // au serveur est l'occupant qui était SOUS LES YEUX du médecin au moment du
    // geste — pas `null`, pas l'état d'aujourd'hui. C'est cette valeur qui
    // empêche le rejeu de déloger un collègue arrivé entre-temps ; sans elle,
    // le compare-and-set de la migration 0027 ne compare rien.
    await expect
      .poll(() => rpcCalls.find(c => c.name === 'assign_shift_if_unchanged'))
      .toBeTruthy();
    expect(
      rpcCalls.find(c => c.name === 'assign_shift_if_unchanged')?.body
    ).toMatchObject({
      p_work_date: '2026-07-07',
      p_shift_type: 'S1J',
      p_doctor_id: 'doc-self',
      p_expected_doctor_id: 'doc-martin',
    });
  });

  test('créneau pris pendant la coupure : le refus est DIT, et rien n’est perdu', async ({
    page,
  }) => {
    const { goOfflineHard, goOnlineHard, slotTakenBy } =
      await setupAuthenticated(page);
    await page.goto('/#/?m=2026-07');
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeVisible();
    await waitForMonthCache(page);
    await goOfflineHard();

    await page
      .getByRole('button', { name: /^S1N\b/ })
      .first()
      .click();
    await page.getByRole('button', { name: "M'assigner ce créneau" }).click();
    const badge = page.getByRole('button', {
      name: 'État de la synchronisation',
    });
    await expect(badge).toContainText('1 en attente');

    // Pendant la coupure, un collègue a pris le créneau. Le serveur tranchera.
    slotTakenBy();
    await goOnlineHard();

    // 1. Le refus est DIT, et il NOMME l'occupant — pas un « échec » anonyme.
    await expect(page.getByText(/pris par MARTIN/)).toBeVisible();

    // 2. Le badge passe au rouge et reste : ce n'est pas un message qui passe.
    await expect(badge).toContainText('1 refusée(s)');

    // 3. Rien n'est perdu : l'écriture refusée est listée, avec sa raison, et
    //    reste rejouable. C'est la différence entre « refusé » et « effacé ».
    await badge.click();
    const panneau = page.getByRole('dialog');
    await expect(panneau).toContainText('1 écriture(s) refusée(s)');
    await expect(panneau).toContainText('Garde S1N du 2026-07-01');
    await expect(
      panneau.getByRole('button', { name: 'Réessayer' })
    ).toBeVisible();
  });

  test('la déconnexion jette la file — mais jamais sans le dire', async ({
    page,
  }) => {
    const { goOfflineHard } = await setupAuthenticated(page);
    await page.goto('/#/?m=2026-07');
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeVisible();
    await waitForMonthCache(page);
    await goOfflineHard();

    await page
      .getByRole('button', { name: /^S1N\b/ })
      .first()
      .click();
    await page.getByRole('button', { name: "M'assigner ce créneau" }).click();
    const badge = page.getByRole('button', {
      name: 'État de la synchronisation',
    });
    await expect(badge).toContainText('1 en attente');

    /** Ce que la file laisse dans le stockage de l'appareil, listes vides ôtées. */
    const resteEnStockage = () =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter(k => k.startsWith('misterdoc_sync_'))
          .map(k => localStorage.getItem(k))
          .join('')
          .replace(/\[\]/g, '')
      );

    // Non vide AVANT : sans cette ligne, l'assertion finale passerait aussi si
    // la file n'avait jamais rien écrit — elle ne prouverait pas la purge.
    expect(await resteEnStockage()).not.toBe('');

    // La file vit dans le stockage de l'APPAREIL : la laisser, c'est la faire
    // repartir sous la session du médecin suivant (poste partagé de salle de
    // garde). La déconnexion doit donc la jeter — et prévenir avant.
    await page.getByRole('link', { name: /DR E2E/ }).click();
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    const boite = page.getByRole('alertdialog');
    await expect(boite).toContainText('ne sont pas encore parties au serveur');

    // On renonce : rien n'est perdu, et on est toujours connecté.
    await page.keyboard.press('Escape');
    await expect(badge).toContainText('1 en attente');

    // On confirme en connaissance de cause : la file part avec la session.
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page
      .getByRole('button', { name: 'Se déconnecter et les perdre' })
      .click();
    await expect(badge).toHaveCount(0);
    await expect.poll(resteEnStockage).toBe('');
  });
});
