import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertApplied,
  entityKey,
  enqueuePlanningOp,
  getSyncQueue,
  isTransient,
  resetSyncQueue,
  setQueueObserver,
  setQueueTransport,
  SlotConflictError,
  type PlanningOp,
} from './syncQueue.ts';
import type { ShiftWriteResult } from './planning.ts';

/**
 * CE QUE CES TESTS VERROUILLENT : qu'un médecin en salle de garde SANS RÉSEAU
 * puisse poser une garde, et que cette garde parte plus tard — sans jamais
 * effacer celle d'un collègue, et sans jamais disparaître en silence.
 *
 * L'application était en LECTURE SEULE hors ligne : un cliché IndexedDB, deux
 * bandeaux, et un toast rouge à chaque geste. La file change cela ; la
 * difficulté propre à mister-doc est qu'un créneau clinique a UN occupant
 * (`unique (work_date, shift_type)`), et que deux médecins hors ligne peuvent
 * viser le même.
 *
 * LE SERVEUR SIMULÉ CI-DESSOUS N'EST PAS UN BOUCHON. Il reproduit à la lettre
 * `assign_shift_if_unchanged` / `clear_shift_if_unchanged` (migration 0027) :
 * compare-and-set, idempotence du rejeu, refus sur mois verrouillé. Un bouchon
 * qui dirait toujours « oui » laisserait passer exactement le défaut qu'on
 * cherche à empêcher. La traduction du verdict en exception (`assertApplied`)
 * est, elle, le code de production — pas une copie.
 *
 * `navigator.onLine` est redéfini plutôt qu'injecté : c'est ce que la file du
 * socle lit réellement, et c'est le seul moyen d'éprouver le vrai chemin.
 */

// ── Un serveur de créneaux minimal, fidèle à la migration 0027 ────────

interface FakeServer {
  /** `date|type` → identifiant du médecin affecté. */
  slots: Map<string, string>;
  /** Mois verrouillés, au format `YYYY-MM` — le trigger `assert_month_unlocked`. */
  locked: Set<string>;
  /** Noms, pour le message de conflit. */
  names: Map<string, string>;
  /** Les opérations reçues, dans l'ordre — de quoi compter les envois. */
  received: PlanningOp[];
  /** Erreur à lever au prochain appel (panne réseau simulée). */
  failNextWith: Error | null;
}

function createServer(): FakeServer {
  return {
    slots: new Map(),
    locked: new Set(),
    names: new Map([
      ['doc-a', 'Dr Alice'],
      ['doc-b', 'Dr Bruno'],
    ]),
    received: [],
    failNextWith: null,
  };
}

function verdict(server: FakeServer, key: string, applied: boolean) {
  const holderId = server.slots.get(key) ?? null;
  return {
    applied,
    holderId,
    holderName: holderId ? (server.names.get(holderId) ?? null) : null,
  } satisfies ShiftWriteResult;
}

/**
 * Le transport : la même chaîne qu'en production — appel serveur, puis
 * `assertApplied` (code de production) qui transforme un refus en
 * `SlotConflictError`.
 */
function transportOf(server: FakeServer) {
  return async (op: PlanningOp): Promise<void> => {
    server.received.push(op);
    if (server.failNextWith) {
      const error = server.failNextWith;
      server.failNextWith = null;
      throw error;
    }
    if (op.kind !== 'shift.assign' && op.kind !== 'shift.clear') return;

    const key = `${op.workDate}|${op.shiftType}`;
    if (server.locked.has(op.workDate.slice(0, 7))) {
      // Ce que lève `assert_month_unlocked` (migration 0005).
      throw new Error('Mois verrouillé : modification refusée.');
    }
    const current = server.slots.get(key) ?? null;

    if (op.kind === 'shift.clear') {
      if (current === op.expectedDoctorId) {
        server.slots.delete(key);
        return assertApplied(verdict(server, key, true));
      }
      // Déjà libre = le geste a abouti (rejeu), pas un conflit.
      return assertApplied(verdict(server, key, current === null));
    }

    if (op.expectedDoctorId === null) {
      // « Je voyais le créneau libre » → insert ... on conflict do nothing.
      if (current === null) {
        server.slots.set(key, op.doctorId);
        return assertApplied(verdict(server, key, true));
      }
    } else if (current === op.expectedDoctorId) {
      // Réaffectation : on ne remplace QUE l'occupant qu'on avait sous les yeux.
      server.slots.set(key, op.doctorId);
      return assertApplied(verdict(server, key, true));
    }
    // Idempotence : déjà dans l'état voulu → appliqué, pas un conflit.
    return assertApplied(
      verdict(server, key, server.slots.get(key) === op.doctorId)
    );
  };
}

// ── Réseau ───────────────────────────────────────────────────────────

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

/** Retour du réseau : l'état ET l'évènement, comme le navigateur les livre. */
async function goOnline() {
  setOnline(true);
  window.dispatchEvent(new Event('online'));
  // Le rappel `online` du socle rend une promesse que `dispatchEvent` ignore :
  // on laisse la micro-file s'épuiser plutôt que d'attendre un délai arbitraire.
  await vi.waitFor(() => expect(getSyncQueue().pending()).toBe(0));
}

const POSER: Extract<PlanningOp, { kind: 'shift.assign' }> = {
  kind: 'shift.assign',
  workDate: '2026-09-15',
  shiftType: 'S1J',
  doctorId: 'doc-a',
  expectedDoctorId: null,
};

let server: FakeServer;

beforeEach(() => {
  localStorage.clear();
  resetSyncQueue();
  server = createServer();
  setQueueTransport(transportOf(server));
  setQueueObserver({});
  setOnline(true);
});

afterEach(() => {
  resetSyncQueue();
  setQueueTransport(null);
  setQueueObserver({});
  localStorage.clear();
  setOnline(true);
});

describe('affectation hors ligne puis reconnexion', () => {
  it('la garde est posée au retour du réseau', async () => {
    setOnline(false);
    void getSyncQueue().start();

    expect(enqueuePlanningOp(POSER)).toBe(true);
    // Hors ligne, RIEN ne part : le drain s'interrompt sans consommer de
    // tentative — un réseau coupé n'est pas un échec de l'opération.
    await getSyncQueue().flush();
    expect(server.received).toEqual([]);
    expect(getSyncQueue().pending()).toBe(1);

    await goOnline();

    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-a');
    expect(getSyncQueue().pending()).toBe(0);
    expect(getSyncQueue().deadLetters()).toEqual([]);
  });

  it('rejoue les écritures dans l’ordre où elles ont été faites', async () => {
    setOnline(false);
    void getSyncQueue().start();
    enqueuePlanningOp({ ...POSER, workDate: '2026-09-15' });
    enqueuePlanningOp({ ...POSER, workDate: '2026-09-16' });
    enqueuePlanningOp({ ...POSER, workDate: '2026-09-17' });

    await goOnline();

    expect(
      server.received.map(op => (op.kind === 'shift.assign' ? op.workDate : ''))
    ).toEqual(['2026-09-15', '2026-09-16', '2026-09-17']);
  });

  it('deux gestes sur le MÊME créneau ne partent qu’une fois — le dernier', async () => {
    setOnline(false);
    void getSyncQueue().start();
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-a' });
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-b' });

    await goOnline();

    expect(server.received).toHaveLength(1);
    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-b');
  });
});

describe('deux médecins hors ligne sur le même créneau', () => {
  /**
   * DEUX APPAREILS, DEUX FILES, UN SEUL CRÉNEAU. Chacun a vu le créneau libre
   * et l'a pris. C'est le scénario que le chantier existe pour traiter.
   */
  it('une seule gagne ; l’autre est NOTIFIÉE et rien n’est perdu', async () => {
    const refus: { op: PlanningOp; error: unknown }[] = [];
    setQueueObserver({ onDead: (op, error) => refus.push({ op, error }) });

    // Appareil A — hors ligne, il pose sa garde et revient en ligne le premier.
    setOnline(false);
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-a', expectedDoctorId: null });
    void getSyncQueue().start();
    await goOnline();
    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-a');

    // Appareil B — sa file a été écrite pendant qu'il était hors ligne, LUI
    // AUSSI sur un créneau vu libre. On simule l'autre appareil par une file
    // neuve sur un stockage neuf.
    resetSyncQueue();
    localStorage.clear();
    setOnline(false);
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-b', expectedDoctorId: null });
    void getSyncQueue().start();
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(getSyncQueue().deadLetters()).toHaveLength(1)
    );

    // 1. L'affectation de l'autre n'est PAS écrasée.
    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-a');

    // 2. Le refus est DIT — et il nomme l'occupant.
    expect(refus).toHaveLength(1);
    expect(refus[0]?.error).toBeInstanceOf(SlotConflictError);
    expect((refus[0]?.error as SlotConflictError).holderName).toBe('Dr Alice');
    expect((refus[0]?.error as SlotConflictError).message).toContain(
      'Dr Alice'
    );

    // 3. Rien n'est perdu : l'écriture refusée reste consultable, avec sa
    //    raison, et rejouable — elle n'est pas silencieusement jetée.
    const mortes = getSyncQueue().deadLetters();
    expect(mortes).toHaveLength(1);
    expect(mortes[0]?.payload).toMatchObject({
      kind: 'shift.assign',
      doctorId: 'doc-b',
      workDate: '2026-09-15',
    });
    expect(mortes[0]?.lastError).toContain('Dr Alice');

    // 4. Et la file continue de vivre : rien ne reste coincé en tête.
    expect(getSyncQueue().pending()).toBe(0);
  });

  it('un conflit n’est JAMAIS réessayé : un seul envoi, pas dix', async () => {
    server.slots.set('2026-09-15|S1J', 'doc-a');
    setOnline(false);
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-b', expectedDoctorId: null });
    void getSyncQueue().start();
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(getSyncQueue().deadLetters()).toHaveLength(1)
    );

    // Insister reviendrait à déloger celui qui occupe le créneau.
    expect(server.received).toHaveLength(1);
  });

  it('une réaffectation ne remplace que l’occupant qu’on avait sous les yeux', async () => {
    // Le médecin voyait « doc-a » et voulait mettre « doc-b » ; entre-temps
    // quelqu'un d'autre a mis « doc-c ».
    server.slots.set('2026-09-15|S1J', 'doc-c');
    server.names.set('doc-c', 'Dr Camille');
    const refus: unknown[] = [];
    setQueueObserver({ onDead: (_op, error) => refus.push(error) });

    setOnline(false);
    enqueuePlanningOp({
      ...POSER,
      doctorId: 'doc-b',
      expectedDoctorId: 'doc-a',
    });
    void getSyncQueue().start();
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(getSyncQueue().deadLetters()).toHaveLength(1)
    );

    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-c');
    expect((refus[0] as SlotConflictError).holderName).toBe('Dr Camille');
  });

  it('un rejeu déjà appliqué n’est PAS un conflit (accusé de réception perdu)', async () => {
    // Le serveur a bien écrit, mais la réponse s'est perdue : la file
    // réessaie. Sans l'idempotence, chaque coupure réseau produirait une
    // fausse alerte de conflit.
    server.slots.set('2026-09-15|S1J', 'doc-a');
    setOnline(false);
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-a', expectedDoctorId: null });
    void getSyncQueue().start();

    await goOnline();

    expect(getSyncQueue().deadLetters()).toEqual([]);
    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-a');
  });
});

describe('la file survit à un rechargement', () => {
  it('les écritures en attente repartent après un redémarrage complet', async () => {
    setOnline(false);
    enqueuePlanningOp({ ...POSER, workDate: '2026-09-20' });
    enqueuePlanningOp({
      kind: 'hnc.set',
      doctorId: 'doc-a',
      workDate: '2026-09-21',
      hours: 4,
      createdBy: 'doc-a',
    });
    expect(getSyncQueue().pending()).toBe(2);

    // Rechargement : l'instance en mémoire disparaît, le `localStorage` reste
    // — exactement ce que fait F5, la fermeture de l'onglet, l'extinction du
    // téléphone. Rien d'autre n'est touché.
    resetSyncQueue();
    setQueueTransport(transportOf(server));

    expect(getSyncQueue().pending()).toBe(2);
    expect(getSyncQueue().list()[0]?.payload).toMatchObject({
      kind: 'shift.assign',
      workDate: '2026-09-20',
    });

    void getSyncQueue().start();
    await goOnline();

    expect(server.slots.get('2026-09-20|S1J')).toBe('doc-a');
    expect(server.received).toHaveLength(2);
  });

  it('les lettres mortes survivent aussi : la trace ne s’efface pas toute seule', async () => {
    server.slots.set('2026-09-15|S1J', 'doc-a');
    setOnline(false);
    enqueuePlanningOp({ ...POSER, doctorId: 'doc-b' });
    void getSyncQueue().start();
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(getSyncQueue().deadLetters()).toHaveLength(1)
    );

    resetSyncQueue();
    setQueueTransport(transportOf(server));

    expect(getSyncQueue().deadLetters()).toHaveLength(1);
  });
});

describe('un refus du serveur ne se rejoue pas indéfiniment', () => {
  it('mois verrouillé : lettre morte du premier coup', async () => {
    server.locked.add('2026-09');
    const refus: unknown[] = [];
    setQueueObserver({ onDead: (_op, error) => refus.push(error) });

    setOnline(false);
    enqueuePlanningOp(POSER);
    void getSyncQueue().start();
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(getSyncQueue().deadLetters()).toHaveLength(1)
    );

    expect(server.received).toHaveLength(1);
    expect((refus[0] as Error).message).toContain('Mois verrouillé');
    expect(getSyncQueue().pending()).toBe(0);
  });

  it('une panne réseau, elle, se réessaie — et finit par passer', async () => {
    setOnline(false);
    enqueuePlanningOp(POSER);
    void getSyncQueue().start();

    // Le premier envoi échoue sur une vraie panne transitoire.
    server.failNextWith = new Error('Failed to fetch');
    setOnline(true);
    await getSyncQueue().flush();

    expect(getSyncQueue().pending()).toBe(1); // gardée, pas jetée
    expect(getSyncQueue().deadLetters()).toEqual([]); // et pas condamnée

    await getSyncQueue().flush();

    expect(server.slots.get('2026-09-15|S1J')).toBe('doc-a');
    expect(getSyncQueue().pending()).toBe(0);
  });

  it('classe correctement les deux familles d’échec', () => {
    expect(isTransient('Failed to fetch')).toBe(true);
    expect(isTransient('Load failed')).toBe(true);
    expect(isTransient('NetworkError when attempting to fetch resource')).toBe(
      true
    );
    expect(
      isTransient('new row violates row-level security policy for table')
    ).toBe(false);
    expect(isTransient('Mois verrouillé : modification refusée.')).toBe(false);
  });
});

describe('la clé de fusion', () => {
  it('confond poser et retirer sur le même créneau — retirer gagne', () => {
    expect(
      entityKey({
        kind: 'shift.clear',
        workDate: '2026-09-15',
        shiftType: 'S1J',
        expectedDoctorId: 'doc-a',
      })
    ).toBe(entityKey(POSER));
  });

  it('sépare deux créneaux du même jour', () => {
    expect(entityKey({ ...POSER, shiftType: 'S1N' })).not.toBe(
      entityKey(POSER)
    );
  });

  it('ne confond pas une pose d’absence avec la suppression d’une ligne', () => {
    expect(
      entityKey({
        kind: 'leave.set',
        doctorId: 'doc-a',
        fromISO: '2026-09-01',
        toISO: '2026-09-05',
        leaveKind: 'annual',
        hours: null,
        createdBy: 'doc-a',
      })
    ).not.toBe(entityKey({ kind: 'leave.clear', id: 'doc-a' }));
  });
});
