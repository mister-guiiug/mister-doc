import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useAuth } from './useAuth.ts';
import { Button } from '../components/ui/Button.tsx';
import { Field } from '../components/ui/Field.tsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.tsx';
import { PrivacyDialog } from '../features/legal/PrivacyPolicy.tsx';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);

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

        <SegmentedControl
          className="mb-4"
          fullWidth
          ariaLabel="Connexion ou création de compte"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'signin', label: 'Connexion' },
            { value: 'signup', label: 'Créer un compte' },
          ]}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <Field
              label="Nom affiché"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Dr Dupont"
              required
              autoComplete="name"
            />
          )}
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="prenom.nom@exemple.fr"
            required
            autoComplete="email"
          />
          <Field
            label="Mot de passe"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
          {mode === 'signup' && (
            <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
              8 caractères minimum.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} className="mt-1 w-full py-2.5">
            {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </Button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Un nouveau compte est « en attente » jusqu'à validation par un
            administrateur.
          </p>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          <button
            type="button"
            onClick={() => setPrivacy(true)}
            className="underline hover:text-slate-600 dark:hover:text-slate-300"
          >
            Politique de confidentialité
          </button>
        </p>
      </div>

      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </div>
  );
}
