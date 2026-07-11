import { useCallback, useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Shield,
  ShieldOff,
  Trash2,
  Clock,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import type { Doctor } from '../../backend/types.ts';
import {
  adminAddRoster,
  adminDeleteDoctor,
  adminSetDoctor,
  listDoctors,
} from '../../backend/doctors.ts';
import { FullScreenSpinner } from '../../components/Spinner.tsx';

const COLORS = [
  '#2563eb',
  '#0f766e',
  '#db2777',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#059669',
  '#0891b2',
];

export function AdminPanel() {
  const { doctor: self, refreshDoctor } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[1]);

  const reload = useCallback(async () => {
    try {
      setDoctors(await listDoctors());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
      await refreshDoctor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await act('new', async () => {
      await adminAddRoster(newName.trim(), newColor);
      setNewName('');
    });
  }

  if (loading) return <FullScreenSpinner label="Chargement…" />;

  const pending = doctors.filter(d => d.auth_id && !d.approved);
  const members = doctors.filter(d => d.approved);
  const roster = doctors.filter(d => !d.auth_id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Comptes en attente */}
      <Card
        title="Comptes en attente"
        icon={<Clock className="size-5 text-amber-500" />}
        count={pending.length}
      >
        {pending.length === 0 ? (
          <Empty>Aucune demande en attente.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map(d => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
              >
                <Dot color={d.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="truncate text-xs text-slate-400">{d.email}</p>
                </div>
                <button
                  disabled={busyId === d.id}
                  onClick={() => void act(d.id, () => adminSetDoctor(d.id, true, null))}
                  className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === d.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserCheck className="size-4" />
                  )}
                  Approuver
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Ajouter au roster */}
      <Card
        title="Ajouter un médecin au roster"
        icon={<UserPlus className="size-5 text-teal-600" />}
      >
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nom du médecin (ex. GUERIN)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
          />
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setNewColor(c)}
                className={`size-6 rounded-full transition ${
                  newColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
            <button
              type="submit"
              disabled={busyId === 'new' || !newName.trim()}
              className="ml-auto flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busyId === 'new' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              Ajouter
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Une entrée de roster est assignable au planning même sans compte. Le
            médecin pourra ensuite créer son compte pour voir ses compteurs.
          </p>
        </form>
      </Card>

      {/* Membres */}
      <Card
        title="Médecins"
        icon={<Shield className="size-5 text-slate-500" />}
        count={members.length + roster.length}
      >
        <ul className="flex flex-col gap-2">
          {[...members, ...roster.filter(r => !r.approved)].map(d => {
            const isSelf = d.id === self?.id;
            const hasAccount = !!d.auth_id;
            return (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
              >
                <Dot color={d.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.name}
                    {d.is_admin && (
                      <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                        admin
                      </span>
                    )}
                    {!hasAccount && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700">
                        roster
                      </span>
                    )}
                  </p>
                  {d.email && (
                    <p className="truncate text-xs text-slate-400">{d.email}</p>
                  )}
                </div>

                {hasAccount && !isSelf && (
                  <button
                    disabled={busyId === d.id}
                    onClick={() =>
                      void act(d.id, () =>
                        adminSetDoctor(d.id, null, !d.is_admin)
                      )
                    }
                    title={d.is_admin ? 'Retirer admin' : 'Nommer admin'}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {d.is_admin ? (
                      <ShieldOff className="size-4" />
                    ) : (
                      <Shield className="size-4" />
                    )}
                  </button>
                )}

                {!hasAccount && (
                  <button
                    disabled={busyId === d.id}
                    onClick={() => void act(d.id, () => adminDeleteDoctor(d.id))}
                    title="Supprimer du roster"
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {busyId === d.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Card({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-4 text-center text-sm text-slate-400">{children}</p>
  );
}
