import { useCallback, useEffect, useMemo, useState } from 'react';
import { Repeat, X, Plus } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useToast } from '../../components/Toast.tsx';
import { Button } from '../../components/ui/Button.tsx';
import type { ShiftType } from '../../lib/shifts.ts';
import { logError } from '../../lib/logger.ts';
import { useI18n } from '../../i18n/index.ts';
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
import { SwapItem } from './SwapItem.tsx';
import { SwapEmpty, SwapSection } from './SwapSection.tsx';
import { SwapHistory } from './SwapHistory.tsx';

export function SwapBoard() {
  const { doctor } = useAuth();
  const toast = useToast();
  const { t } = useI18n();

  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const load = useCallback(
    () =>
      listSwaps()
        .then(setSwaps)
        .catch(e => logError('listSwaps', e)),
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
      toast.error(e instanceof Error ? e.message : t('common.error'));
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
    toast.success(t('swaps.sent'));
  }

  if (loading) return <FullScreenSpinner label={t('common.loading')} />;

  const AcceptBtn = ({ s }: { s: SwapRequest }) => (
    <Button
      size="sm"
      loading={busy === s.id}
      onClick={() =>
        void act(s.id, () => acceptSwap(s.id), t('swaps.shiftTaken'))
      }
    >
      {t('swaps.accept')}
    </Button>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Repeat className="size-5 text-teal-600" /> {t('swaps.title')}
        </h1>
        <Button className="ml-auto" onClick={() => setProposing(true)}>
          <Plus className="size-4" /> {t('swaps.propose')}
        </Button>
      </div>

      <SwapSection title={t('swaps.forMe')} count={forMe.length}>
        {forMe.length === 0 ? (
          <SwapEmpty>{t('swaps.noneForMe')}</SwapEmpty>
        ) : (
          <ul className="flex flex-col gap-2">
            {forMe.map(s => (
              <SwapItem
                key={s.id}
                swap={s}
                nameById={nameById}
                actions={
                  <>
                    <AcceptBtn s={s} />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === s.id}
                      onClick={() =>
                        void act(
                          s.id,
                          () => declineSwap(s.id),
                          t('swaps.declined')
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </SwapSection>

      <SwapSection title={t('swaps.openToAll')} count={open.length}>
        {open.length === 0 ? (
          <SwapEmpty>{t('swaps.noneOpen')}</SwapEmpty>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map(s => (
              <SwapItem
                key={s.id}
                swap={s}
                nameById={nameById}
                actions={<AcceptBtn s={s} />}
              />
            ))}
          </ul>
        )}
      </SwapSection>

      <SwapSection title={t('swaps.myProposals')} count={mine.length}>
        {mine.length === 0 ? (
          <SwapEmpty>{t('swaps.noneMine')}</SwapEmpty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map(s => (
              <SwapItem
                key={s.id}
                swap={s}
                nameById={nameById}
                actions={
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    disabled={busy === s.id}
                    onClick={() =>
                      void act(
                        s.id,
                        () => cancelSwap(s.id),
                        t('swaps.cancelled')
                      )
                    }
                  >
                    {t('common.cancel')}
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </SwapSection>

      {resolved.length > 0 && (
        <SwapHistory resolved={resolved} nameById={nameById} />
      )}

      <p className="text-xs text-slate-400">{t('swaps.footer')}</p>

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
