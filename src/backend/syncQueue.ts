/**
 * FILE D'ÉCRITURES HORS LIGNE — le chemin montant du planning.
 *
 * CE QUE L'APPLICATION N'AVAIT PAS. mister-doc était en lecture seule hors
 * ligne : un cliché IndexedDB (`lib/idbCache.ts`) et deux bandeaux qui
 * l'annoncent. Un médecin en salle de garde sans réseau pouvait CONSULTER son
 * planning et rien d'autre — le geste échouait, la mise à jour optimiste était
 * annulée, un toast rouge passait. Ici, le geste est ENFILÉ et repart au retour
 * du réseau.
 *
 * INSTANCE APP DE LA FILE DU SOCLE (`dev-pwa-config/sync-queue`), sur le motif
 * de `miss-uwh/src/backend/syncQueue.ts` : persistance, drain sérialisé (ordre
 * préservé), retrait exponentiel dispersé, lettres mortes rejouables, fusion
 * par entité, plafond. Ne vit ici que ce qui est PROPRE à mister-doc — les
 * opérations, leur clé d'entité, la classification des échecs, et le conflit
 * d'occupant.
 *
 * LE CONFLIT D'OCCUPANT, LA DIFFICULTÉ PROPRE À CETTE APP. Un créneau clinique
 * a UN occupant (`unique (work_date, shift_type)`). Deux médecins hors ligne
 * peuvent viser le même. Chaque opération de garde emporte donc
 * `expectedDoctorId` — l'occupant que le médecin avait SOUS LES YEUX au moment
 * du geste — et le rejeu passe par un compare-and-set côté serveur
 * (`assign_shift_if_unchanged`, migration 0027) : c'est la base qui tranche,
 * dans une seule instruction SQL. Un refus lève une `SlotConflictError`, qui
 * n'est PAS réessayable : l'écriture part en lettre morte (la trace) et
 * l'observateur la dit (la notification). L'affectation de l'autre n'est
 * jamais écrasée.
 *
 * AUCUN RÉSEAU ICI. Le transport est injecté (`setQueueTransport`) : ce module
 * ignore Supabase, ce qui le rend éprouvable sans client ni variables d'env, et
 * garde la doctrine anti-écran-blanc (rien ne s'exécute à l'import).
 */
import {
  createSyncQueue,
  type SyncQueue,
  type SyncQueueEntry,
} from '@mister-guiiug/dev-pwa-config/sync-queue';
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';
import type { LeaveKind } from '../lib/leaves.ts';
import type { ShiftType } from '../lib/shifts.ts';
// Type SEUL (effacé à la compilation) : ce module ne doit rien importer qui
// touche au réseau, sinon il devient inéprouvable sans variables d'env.
import type { ShiftWriteResult } from './planning.ts';

/**
 * Les gestes du planning qui peuvent attendre le réseau. Volontairement
 * restreint aux écritures IDEMPOTENTES et à effet local : la copie de mois
 * (~90 lignes, une transaction) et le verrou de mois (geste d'administration,
 * qui doit être vu de tous immédiatement) restent en ligne seulement.
 */
export type PlanningOp =
  | {
      kind: 'shift.assign';
      workDate: string;
      shiftType: ShiftType;
      doctorId: string;
      /** L'occupant vu à l'écran au moment du geste. `null` = créneau libre. */
      expectedDoctorId: string | null;
    }
  | {
      kind: 'shift.clear';
      workDate: string;
      shiftType: ShiftType;
      /** L'occupant qu'on croyait retirer. Jamais `null` : on ne libère pas à l'aveugle. */
      expectedDoctorId: string;
    }
  | {
      kind: 'leave.set';
      doctorId: string;
      fromISO: string;
      toISO: string;
      leaveKind: LeaveKind;
      hours: number | null;
      createdBy: string | null;
    }
  | { kind: 'leave.clear'; id: string }
  | {
      kind: 'hnc.set';
      doctorId: string;
      workDate: string;
      hours: number;
      createdBy: string | null;
    }
  | { kind: 'hnc.clear'; id: string };

/** Entrée de file (contrat du socle) portant une opération de planning. */
export type PlanningEntry = SyncQueueEntry<PlanningOp>;

/**
 * Le serveur a refusé l'écriture parce que le créneau n'est plus dans l'état
 * qu'on avait sous les yeux. Ce n'est PAS un échec transitoire : réessayer ne
 * changerait rien, et insister finirait par écraser l'autre. Porte le nom de
 * l'occupant, seule information qui permette de le dire au médecin.
 */
export class SlotConflictError extends Error {
  readonly holderId: string | null;
  readonly holderName: string | null;

  constructor(
    message: string,
    holderId: string | null,
    holderName: string | null
  ) {
    super(message);
    this.name = 'SlotConflictError';
    this.holderId = holderId;
    this.holderName = holderName;
  }
}

/** Message de conflit, court et nominatif : c'est lui que le médecin lira. */
export function conflictMessage(holderName: string | null): string {
  return holderName
    ? `Créneau déjà pris par ${holderName}`
    : 'Créneau déjà pris ou libéré par quelqu’un d’autre';
}

/**
 * Traduit le verdict du serveur (migration 0027) en exception. Vit ICI, et non
 * dans le transport, pour que les tests éprouvent la MÊME traduction que la
 * production sans avoir besoin d'un client Supabase.
 */
export function assertApplied(result: ShiftWriteResult): void {
  if (!result.applied)
    throw new SlotConflictError(
      conflictMessage(result.holderName),
      result.holderId,
      result.holderName
    );
}

/**
 * Un échec transitoire (réseau coupé, service indisponible, jeton à
 * rafraîchir) vaut rejeu ; tout le reste est un refus du serveur — RLS, mois
 * verrouillé (`assert_month_unlocked`), conflit d'occupant — et part en lettre
 * morte. Le motif vient de miss-uwh et couvre les messages des principaux
 * navigateurs : « Failed to fetch » (Chrome), « Load failed » (Safari),
 * « NetworkError… » (Firefox).
 */
export function isTransient(message: string): boolean {
  return /fetch|network|load failed|timeout|timed?\s?out|offline|connexion|connection|econn|enotfound|socket|abort|too many requests|jwt expired|token.{0,10}expired|service unavailable|bad gateway|gateway time/i.test(
    message
  );
}

/**
 * Au-delà de ce nombre d'échecs, même « transitoire » est requalifié en refus
 * durable : sinon une erreur mal classée bloquerait la file pour toujours, en
 * silence. Jamais atteint hors ligne — le drain du socle s'interrompt sans
 * consommer de tentative quand le réseau est coupé.
 */
export const MAX_TRANSIENT_ATTEMPTS = 10;

/**
 * Clé d'entité pour la FUSION : deux gestes en attente sur le même créneau (ou
 * la même absence, ou les mêmes heures non cliniques) ne partent pas tous les
 * deux — seul le dernier compte. Un médecin qui hésite hors ligne entre trois
 * collègues n'envoie pas trois écritures au retour du réseau.
 *
 * `shift.assign` et `shift.clear` partagent la MÊME clé : poser puis retirer,
 * c'est retirer. Les identifiants de ligne (`leave.clear`, `hnc.clear`) ont
 * leur propre espace : une suppression ne fusionne pas avec une pose.
 */
export function entityKey(op: PlanningOp): string | null {
  switch (op.kind) {
    case 'shift.assign':
    case 'shift.clear':
      return `shift:${op.workDate}|${op.shiftType}`;
    case 'leave.set':
      return `leave:${op.doctorId}|${op.fromISO}|${op.toISO}`;
    case 'leave.clear':
      return `leave-row:${op.id}`;
    case 'hnc.set':
      return `hnc:${op.doctorId}|${op.workDate}`;
    case 'hnc.clear':
      return `hnc-row:${op.id}`;
  }
}

// ── Branchements tardifs (par planningSync.ts et par l'interface) ─────

/** Pousse une opération vers Supabase. Injecté : la file ignore le réseau. */
export type QueueTransport = (op: PlanningOp) => Promise<void>;

export interface QueueObserver {
  /** Après chaque évolution de la file — alimente le badge d'état. */
  onChange?: (status: { pending: number; dead: number }) => void;
  /** Quand une écriture est refusée définitivement — à DIRE, jamais à taire. */
  onDead?: (op: PlanningOp, error: unknown) => void;
}

let transport: QueueTransport | null = null;
let observer: QueueObserver = {};

export function setQueueTransport(t: QueueTransport | null): void {
  transport = t;
}

export function setQueueObserver(o: QueueObserver): void {
  observer = o;
}

/**
 * Le magasin de la file. Avec les clés par défaut du socle (`queue` / `dead`),
 * les clés réelles sont `misterdoc_sync_queue` et `misterdoc_sync_dead` — le
 * préfixe évite que deux apps de la famille servies depuis `*.github.io` se
 * marchent dessus. C'est du `localStorage` : la file survit à un rechargement,
 * à la fermeture de l'onglet et au redémarrage de l'appareil.
 */
const store = createStore('misterdoc_sync_');

let queue: SyncQueue<PlanningOp> | null = null;

/**
 * La file, créée au premier usage. Rien ne s'exécute à l'import de ce module —
 * doctrine anti-écran-blanc : une erreur au niveau module rend l'application
 * irrendable avant même le premier pixel.
 */
export function getSyncQueue(): SyncQueue<PlanningOp> {
  if (!queue) {
    queue = createSyncQueue<PlanningOp>({
      store,
      process: op => {
        if (!transport)
          throw new Error('Transport de synchronisation non branché.');
        return transport(op);
      },
      keyOf: entityKey,
      shouldRetry: error => {
        // Un conflit d'occupant ne se réessaie pas : le créneau est pris, et
        // insister reviendrait à déloger celui qui l'occupe.
        if (error instanceof SlotConflictError) return false;
        return isTransient(
          error instanceof Error ? error.message : String(error)
        );
      },
      maxAttempts: MAX_TRANSIENT_ATTEMPTS,
      // 1 s → 60 s, dispersion ±20 % (le socle disperse de ± jitter/2).
      backoff: { baseDelayMs: 1000, maxDelayMs: 60_000, jitter: 0.4 },
      onDead: (entry, error) => observer.onDead?.(entry.payload, error),
      onChange: status => observer.onChange?.(status),
      // Minuteurs résolus à CHAQUE appel : les fausses horloges des tests
      // restent effectives même si la file a été créée sous une autre.
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: id => clearTimeout(id),
    });
  }
  return queue;
}

/**
 * Enfile une écriture. Rend `false` quand le plafond du socle est atteint (200
 * écritures en attente) : refuser visiblement vaut mieux que jeter en silence,
 * et l'appelant peut alors annuler sa mise à jour optimiste.
 */
export function enqueuePlanningOp(op: PlanningOp): boolean {
  return getSyncQueue().enqueue(op) !== null;
}

/** Les écritures refusées définitivement — à montrer, pas à cacher. */
export function deadPlanningOps(): PlanningEntry[] {
  return getSyncQueue().deadLetters();
}

/**
 * Ce qui serait perdu si on vidait la file maintenant : les écritures en
 * attente ET les refusées (elles restent rejouables). Lu à la déconnexion, qui
 * est le seul geste capable de les jeter.
 */
export function unsentPlanningOps(): number {
  const queue = getSyncQueue();
  return queue.pending() + queue.deadLetters().length;
}

/** Purge complète — file ET lettres mortes (déconnexion, appareil partagé). */
export function clearAll(): void {
  getSyncQueue().clear();
}

/**
 * Oublie l'instance en mémoire SANS toucher au stockage — exactement ce que
 * fait un rechargement de page. Sert aux tests (une file neuve par cas, et la
 * preuve que la file survit à un rechargement) ; en production, seule la
 * déconnexion l'appelle (`AuthContext.signOut`), juste après `clearAll()`.
 */
export function resetSyncQueue(): void {
  queue?.stop();
  queue = null;
}
