import { useState } from 'react';
import { CalendarDays, Fingerprint } from 'lucide-react';
import { useAuth } from './useAuth.ts';
import { useI18n } from '../i18n/index.ts';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { SegmentedControl } from '../components/ui/SegmentedControl.tsx';
import { PrivacyDialog } from '../features/legal/PrivacyPolicy.tsx';
import { passkeysSupported } from '../backend/passkey.ts';

/**
 * LE LIEN D'ABORD, LE MOT DE PASSE EN OPTION. En mode connexion, l'écran ne
 * demande qu'une adresse et envoie un lien à usage unique : rien à retenir,
 * rien à voler, rien à réinitialiser. Le mot de passe reste à un clic, la
 * passkey aussi — c'est la règle de la famille depuis l'étape 5
 * d'AMELIORATIONS.md. La création de compte, elle, demande un nom et un mot
 * de passe, puis l'approbation d'un administrateur : elle ne change pas.
 */
export function LoginPage() {
  const { signIn, signUp, signInWithLink, signInWithPasskey } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [withPassword, setWithPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  // Proposé seulement si le navigateur expose WebAuthn (sinon on masque).
  const canPasskey = passkeysSupported();
  // Le mot de passe est demandé pour créer un compte, et pour qui le préfère.
  const askPassword = mode === 'signup' || withPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === 'signup'
        ? await signUp(email.trim(), password, name)
        : withPassword
          ? await signIn(email.trim(), password)
          : await signInWithLink(email.trim());
    setBusy(false);
    if (res.error) setError(res.error);
    else if (mode === 'signin' && !withPassword) setSentTo(email.trim());
  }

  async function handlePasskey() {
    setError(null);
    setPkBusy(true);
    const res = await signInWithPasskey();
    setPkBusy(false);
    if (res.error) setError(res.error);
  }

  const submitLabel =
    mode === 'signup'
      ? t('login.submitSignup')
      : withPassword
        ? t('login.submitSignin')
        : t('login.sendLink');

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-teal-600 text-white">
            <CalendarDays className="size-6" />
          </div>
          <h1 className="text-xl font-bold">{t('login.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('login.subtitle')}
          </p>
        </div>

        {sentTo ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">
              {t('login.linkSentTitle')}
            </h2>
            <p
              role="status"
              className="text-sm text-slate-600 dark:text-slate-300"
            >
              {t('login.linkSent', { email: sentTo })}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full py-2.5"
              onClick={() => setSentTo(null)}
            >
              {t('login.linkAgain')}
            </Button>
          </div>
        ) : (
          <>
            <SegmentedControl
              className="mb-4"
              fullWidth
              ariaLabel={t('login.modeAria')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'signin', label: t('login.signin') },
                { value: 'signup', label: t('login.signup') },
              ]}
            />

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <TextField
                  label={t('login.displayName')}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('login.displayNamePlaceholder')}
                  required
                  autoComplete="name"
                />
              )}
              <TextField
                label={t('login.email')}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                required
                autoComplete="email"
              />
              {askPassword && (
                <TextField
                  label={t('login.password')}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                />
              )}
              {mode === 'signup' && (
                <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('login.minChars')}
                </p>
              )}
              {mode === 'signin' && !withPassword && (
                <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('login.linkIntro')}
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

              <Button
                type="submit"
                loading={busy}
                className="mt-1 w-full py-2.5"
              >
                {submitLabel}
              </Button>
            </form>

            {mode === 'signin' && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  {t('login.or')}
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full py-2.5"
                    onClick={() => {
                      setWithPassword(v => !v);
                      setError(null);
                    }}
                  >
                    {withPassword ? t('login.useLink') : t('login.usePassword')}
                  </Button>
                  {canPasskey && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full py-2.5"
                      loading={pkBusy}
                      onClick={() => void handlePasskey()}
                    >
                      {!pkBusy && <Fingerprint className="size-4" />}
                      {t('login.passkey')}
                    </Button>
                  )}
                </div>
              </>
            )}

            {mode === 'signup' && (
              <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                {t('login.signupPending')}
              </p>
            )}
          </>
        )}

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setPrivacy(true)}
            className="underline hover:text-slate-700 dark:hover:text-slate-200"
          >
            {t('login.privacyLink')}
          </button>
        </p>
      </div>

      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </div>
  );
}
