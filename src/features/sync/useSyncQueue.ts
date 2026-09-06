import { useCallback, useEffect, useState } from 'react';
import { useOnline } from '@mister-guiiug/dev-pwa-config/react/use-online';
import type { SyncStatus } from '@mister-guiiug/dev-pwa-config/react/sync-status-badge';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useI18n } from '../../i18n/index.ts';
import {
  entityKey,
  getSyncQueue,
  setQueueObserver,
  SlotConflictError,
  type PlanningEntry,
  type PlanningOp,
} from '../../backend/syncQueue.ts';
// Import pour l'EFFET : évaluer ce module branche le transport Supabase sur la
// file. Sans lui, la file draine dans le vide et rend « Transport de
// synchronisation non branché ».
import '../../backend/planningSync.ts';

export interface SyncQueueState {
  /** Ce que le badge du socle attend. */
  status: SyncStatus;
  pending: number;
  /** Les écritures refusées définitivement — la trace, à montrer. */
  dead: PlanningEntry[];
  /** Les écritures encore en attente d'envoi. */
  waiting: PlanningEntry[];
  /** Y a-t-il quelque chose à dire ? (sinon le badge ne s'affiche pas) */
  visible: boolean;
  /** Redonne leur chance aux lettres mortes (en tête de file). */
  retryDead: () => void;
  /** Abandonne définitivement les lettres mortes. */
  forgetDead: () => void;
}

/**
 * L'état de la file d'écritures hors ligne, pour l'interface.
 *
 * À MONTER UNE SEULE FOIS dans l'application (`SyncStatus`, dans l'en-tête) :
 * `setQueueObserver` du socle n'a qu'un emplacement, un second appelant
 * remplacerait le premier — les notifications de conflit d'un écran
 * disparaîtraient en ouvrant un autre écran.
 *
 * CE QU'IL FAIT AU MONTAGE. `start()` draine ce qui attend, puis se rebranche
 * sur chaque retour du réseau. Un médecin qui a posé trois gardes en salle de
 * garde retrouve le réseau dans le couloir : les écritures partent seules,
 * sans qu'il rouvre l'application.
 *
 * CE QU'IL FAIT D'UN REFUS. Il le DIT — toast permanent (`tone: 'error'`, sans
 * minuterie) nommant l'occupant du créneau — et il le GARDE : la lettre morte
 * reste listée jusqu'à ce que le médecin réessaie ou abandonne. Jamais un
 * silence, jamais une perte.
 */
export function useSyncQueue(): SyncQueueState {
  const online = useOnline();
  const toast = useToast();
  const { t } = useI18n();
  const [pending, setPending] = useState(0);
  const [dead, setDead] = useState<PlanningEntry[]>([]);
  const [waiting, setWaiting] = useState<PlanningEntry[]>([]);

  const refresh = useCallback(() => {
    const queue = getSyncQueue();
    setWaiting(queue.list());
    setPending(queue.pending());
    setDead(queue.deadLetters());
  }, []);

  const announceRejection = useCallback(
    (op: PlanningOp, error: unknown) => {
      const conflict = error instanceof SlotConflictError;
      const reason = error instanceof Error ? error.message : t('common.error');
      toast.error(
        conflict
          ? t('sync.rejectedConflict', {
              what: describeOp(op, t),
              who: (error as SlotConflictError).holderName ?? t('sync.someone'),
            })
          : t('sync.rejected', { what: describeOp(op, t), reason }),
        // Permanent : un refus qui disparaît au bout de cinq secondes est un
        // silence déguisé. Un identifiant stable par entité évite d'empiler
        // dix fois le même message si dix écritures du même créneau échouent.
        { duration: 0, id: `sync-dead-${entityKey(op) ?? op.kind}` }
      );
    },
    [toast, t]
  );

  useEffect(() => {
    const queue = getSyncQueue();
    setQueueObserver({
      onChange: () => refresh(),
      onDead: (op, error) => announceRejection(op, error),
    });
    refresh();
    void queue.start();
    return () => {
      queue.stop();
      setQueueObserver({});
    };
  }, [refresh, announceRejection]);

  const retryDead = useCallback(() => {
    getSyncQueue().requeueDead();
    void getSyncQueue().flush();
    refresh();
  }, [refresh]);

  const forgetDead = useCallback(() => {
    getSyncQueue().clearDead();
    refresh();
  }, [refresh]);

  // Ordre de priorité : un refus se dit avant une attente, et une attente
  // avant le silence. Hors ligne sans rien en attente, le bandeau réseau de
  // l'application parle déjà — ce badge se tait.
  const status: SyncStatus =
    dead.length > 0
      ? 'error'
      : !online && pending > 0
        ? 'offline'
        : pending > 0
          ? 'pending'
          : 'synced';

  return {
    status,
    pending,
    dead,
    waiting,
    visible: pending > 0 || dead.length > 0,
    retryDead,
    forgetDead,
  };
}

/** La fonction de traduction de l'app — typée par son propre catalogue. */
export type Translate = ReturnType<typeof useI18n>['t'];

/** Une opération en une ligne, pour un toast ou une liste. */
export function describeOp(op: PlanningOp, t: Translate): string {
  switch (op.kind) {
    case 'shift.assign':
      return t('sync.opAssign', { date: op.workDate, slot: op.shiftType });
    case 'shift.clear':
      return t('sync.opClear', { date: op.workDate, slot: op.shiftType });
    case 'leave.set':
      return t('sync.opLeave', { from: op.fromISO, to: op.toISO });
    case 'leave.clear':
      return t('sync.opLeaveClear');
    case 'hnc.set':
      return t('sync.opHnc', { date: op.workDate, hours: op.hours });
    case 'hnc.clear':
      return t('sync.opHncClear');
  }
}
