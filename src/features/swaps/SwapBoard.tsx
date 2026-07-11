import { useCallback, useEffect, useMemo, useState } from 'react';
import { Repeat, Check, X, Loader2, ArrowRight, Inbox } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useToast } from '../../components/Toast.tsx';
import { fromISODate, WEEKDAY_LABELS, mondayIndex } from '../../lib/dates.ts';
import { SHIFT_LABEL } from '../../lib/shifts.ts';
import type { Doctor, SwapRequest } from '../../backend/types.ts';
import { listDoctors } from '../../backend/doctors.ts';
import {
  acceptSwap,
  cancelSwap,
  declineSwap,
  listSwaps,
  subscribeSwaps,
} from '../../backend/swaps.ts';
import { FullScreenSpinner } from '../../components/Spinner.tsx';

function dayLabel(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function SwapBoard() {
  const { doctor } = useAuth();
  const toast = useToast();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => listSwaps().then(setSwaps).catch(() => {}), []);
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
  const pending = swaps.filter(s => s.status === 'pending');
  const forMe = pending.filter(s => s.to_doctor === me && s.from_doctor !== me);
  const open = pending.filter(s => s.to_doctor == null && s.from_doctor !== me);
  const mine = pending.filter(s => s.from_doctor === me);

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
    <button
      disabled={busy === s.id}
      onClick={() => void act(s.id, () => acceptSwap(s.id), 'Garde reprise.')}
      className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
    >
      {busy === s.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      Accepter
    </button>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-3 py-4 sm:px-4">
      <h1 className="flex items-center gap-2 text-lg font-bold">
        <Repeat className="size-5 text-teal-600" /> Échanges de gardes
      </h1>

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
                    <button
                      disabled={busy === s.id}
                      onClick={() => void act(s.id, () => declineSwap(s.id), 'Proposition déclinée.')}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-500 disabled:opacity-50 dark:border-slate-600"
                    >
                      <X className="size-4" />
                    </button>
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
                  <button
                    disabled={busy === s.id}
                    onClick={() => void act(s.id, () => cancelSwap(s.id), 'Proposition annulée.')}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900/60"
                  >
                    Annuler
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <p className="text-xs text-slate-400">
        Proposez un échange depuis le planning : ouvrez votre garde puis « Proposer
        un échange ».
      </p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Inbox className="size-4 text-slate-400" />
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
  return <p className="py-3 text-center text-sm text-slate-400">{children}</p>;
}
