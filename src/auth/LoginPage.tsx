import { useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { useAuth } from './useAuth.ts';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, name);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-teal-600 text-white">
            <CalendarDays className="size-6" />
          </div>
          <h1 className="text-xl font-bold">mister-doc</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Planning de gardes des médecins d'un hôpital
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium dark:bg-slate-700/50">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`rounded-md py-1.5 transition ${
              mode === 'signin'
                ? 'bg-white shadow-sm dark:bg-slate-800'
                : 'text-slate-500'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-md py-1.5 transition ${
              mode === 'signup'
                ? 'bg-white shadow-sm dark:bg-slate-800'
                : 'text-slate-500'
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <Field
              label="Nom affiché"
              value={name}
              onChange={setName}
              type="text"
              placeholder="Dr Dupont"
              required
              autoComplete="name"
            />
          )}
          <Field
            label="E-mail"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="prenom.nom@exemple.fr"
            required
            autoComplete="email"
          />
          <Field
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Un nouveau compte est « en attente » jusqu'à validation par un
            administrateur.
          </p>
        )}
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">
        {props.label}
      </span>
      <input
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
        type={props.type}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        minLength={props.minLength}
        autoComplete={props.autoComplete}
      />
    </label>
  );
}
