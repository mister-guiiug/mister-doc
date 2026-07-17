import { useCallback, useEffect, useMemo, useState } from 'react';
import { Repeat, X, ArrowRight, Inbox, Plus, History } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useToast } from '../../components/Toast.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { fromISODate, WEEKDAY_LABELS, mondayIndex } from '../../lib/dates.ts';
import { SHIFT_LABEL, type ShiftType } from '../../lib/shifts.ts';
import { logError } from '../../lib/logger.ts';
import type { Doctor, SwapRequest } from '../../backend/types.ts';
import { listDoctors } from '../../backend/doctors.ts';
import {
  acceptSwap,
  cancelSwap,
  declineSwap,
  listSwaps,
  proposeSwap,
  subscribeSwaps,
} from '../../backend/swaps.ts';
import { FullScreenSpinner } from '../../components/Spinner.tsx';
import { ProposeSwapDialog } from './ProposeSwapDialog.tsx';

function dayLabel(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** « aujourd'hui » / « demain » / « dans N j » / « passé » relatif à aujourd'hui. */
function relativeDay(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((fromISODate(iso).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'passé';
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} j`;
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Acceptée',
  declined: 'Déclinée',
  cancelled: 'Annulée',
};

export function SwapBoard() {
  const { doctor } = useAuth();
  const toast = useToast();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const load = useCallback(
    () => listSwaps().then(setSwaps).catch(e => logError('listSwaps', e)),
    []
  );
  useEffect(() => {
    Promise.all([listSwaps(), listDoctors()])
      .then(([s, d]) => {
        setSwaps(s);
        setDoctors(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return subscribeSwaps(load);
  }, [load]);

  const nameById = useMemo(
    () => new Map(doctors.map(d => [d.id, d.name])),
    [doctors]
  );

  const me = doctor?.id;
  const byDate = (a: SwapRequest, b: SwapRequest) =>
    a.work_date.localeCompare(b.work_date);
  const pending = swaps.filter(s => s.status === 'pending');
  const forMe = pending
    .filter(s => s.to_doctor === me && s.from_doctor !== me)
    .sort(byDate);
  const open = pending
    .filter(s => s.to_doctor == null && s.from_doctor !== me)
    .sort(byDate);
  const mine = pending.filter(s => s.from_doctor === me).sort(byDate);
  const resolved = swaps.filter(s => s.status !== 'pending').slice(0, 15);

  // Clés de mes gardes déjà proposées : à exclure du dialogue de proposition.
  const alreadyProposed = useMemo(
    () =>
      new Set(
        swaps
          .filter(s => s.status === 'pending' && s.from_doctor === me)
          .map(s => `${s.work_date}|${s.shift_type}`)
      ),
    [swaps, me]
  );

  async function act(id: string, fn: () => Promise<void>, msg: string) {
    setBusy(id);
    try {
      await fn();
      await load();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  }

  // Envoie une proposition (les erreurs remontent au dialogue pour affichage).
  async function handlePropose(
    workDate: string,
    shiftType: ShiftType,
    toDoctor: string | null,
    message: string
  ) {
    await proposeSwap(workDate, shiftType, toDoctor, message);
    await load();
    toast.success('Proposition envoyée.');
  }

  if (loading) return <FullScreenSpinner label="Chargement…" />;

  const Item = ({
    s,
    actions,
  }: {
    s: SwapRequest;
    actions: React.ReactNode;
  }) => (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {SHIFT_LABEL[s.shift_type]} · <span className="capitalize">{dayLabel(s.work_date)}</span>
          <span className="ml-1 font-normal text-slate-400">
            · {relativeDay(s.work_date)}
          </span>
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          {nameById.get(s.from_doctor) ?? '?'}
          <ArrowRight className="size-3" />
          {s.to_doctor ? (nameById.get(s.to_doctor) ?? '?') : 'ouvert à tous'}
        </p>
        {s.message && (
          <p className="mt-0.5 truncate text-xs italic text-slate-400">
            « {s.message} »
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">{actions}</div>
    </li>
  );

  const AcceptBtn = ({ s }: { s: SwapRequest }) => (
    <Button
      size="sm"
      loading={busy === s.id}
      onClick={() => void act(s.id, () => acceptSwap(s.id), 'Garde reprise.')}
    >
      Accepter
    </Button>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Repeat className="size-5 text-teal-600" /> Bourse aux gardes
        </h1>
        <Button className="ml-auto" onClick={() => setProposing(true)}>
          <Plus className="size-4" /> Proposer une garde
        </Button>
      </div>

      <Section title="Pour moi" count={forMe.length}>
        {forMe.length === 0 ? (
          <Empty>Aucune proposition en attente pour vous.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {forMe.map(s => (
              <Item
                key={s.id}
                s={s}
                actions={
                  <>
                    <AcceptBtn s={s} />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === s.id}
                      onClick={() => void act(s.id, () => declineSwap(s.id), 'Proposition déclinée.')}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Ouverts à tous" count={open.length}>
        {open.length === 0 ? (
          <Empty>Aucune garde proposée à l'ensemble de l'équipe.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map(s => (
              <Item key={s.id} s={s} actions={<AcceptBtn s={s} />} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Mes propositions" count={mine.length}>
        {mine.length === 0 ? (
          <Empty>Vous n'avez aucune proposition en cours.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map(s => (
              <Item
                key={s.id}
                s={s}
                actions={
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    disabled={busy === s.id}
                    onClick={() => void act(s.id, () => cancelSwap(s.id), 'Proposition annulée.')}
                  >
                    Annuler
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      {resolved.length > 0 && (
        <Section title="Historique" count={resolved.length} icon={<History className="size-4 text-slate-400" />}>
          <ul className="flex flex-col gap-1.5">
            {resolved.map(s => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-800/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="capitalize">{dayLabel(s.work_date)}</span> ·{' '}
                  {SHIFT_LABEL[s.shift_type]}
                  <span className="text-xs text-slate-400">
                    {' '}
                    — {nameById.get(s.from_doctor) ?? '?'} →{' '}
                    {s.to_doctor ? (nameById.get(s.to_doctor) ?? '?') : 'tous'}
                  </span>
                </span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-xs text-slate-400">
        Proposez une garde via « Proposer une garde » (ou depuis le planning).
        Accepter une garde ouverte la <strong>réaffecte automatiquement</strong> ;
        les autres propositions en cours sur le même créneau sont annulées.
      </p>

      {proposing && doctor && (
        <ProposeSwapDialog
          doctors={doctors}
          selfDoctorId={doctor.id}
          alreadyProposed={alreadyProposed}
          onSubmit={handlePropose}
          onClose={() => setProposing(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'accepted'
      ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300'
      : status === 'declined'
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400';
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {icon ?? <Inbox className="size-4 text-slate-400" />}
        <h2 className="font-semibold">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <EmptyState className="py-3">{children}</EmptyState>;
}
