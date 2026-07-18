import { useEffect, useState } from 'react';
import {
  UserRound,
  Palette,
  SunMoon,
  Sun,
  Moon,
  CalendarPlus,
  RefreshCw,
  Info,
  LogOut,
  Check,
  ShieldCheck,
  Share2,
  Copy,
  BellRing,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useToast } from '../../components/Toast.tsx';
import { useTheme } from '../../lib/theme.ts';
import { DOCTOR_COLORS } from '../../lib/colors.ts';
import { APP_BUILD, forceUpdate } from '../../lib/appVersion.ts';
import {
  currentPushEndpoint,
  disablePush,
  enablePush,
  pushConfigured,
  pushDenied,
} from '../../lib/push.ts';
import { updateMyProfile } from '../../backend/doctors.ts';
import { CalendarDialog } from '../../components/CalendarDialog.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { TwoFactorCard } from './TwoFactorCard.tsx';

/** Carte de section réutilisable (alias local du `SectionCard` du design system). */
function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <SectionCard icon={icon} title={title} desc={desc}>
      {children}
    </SectionCard>
  );
}

export function ProfilePage() {
  const { doctor, isAdmin, signOut, refreshDoctor } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [name, setName] = useState(doctor?.name ?? '');
  const [color, setColor] = useState(doctor?.color ?? DOCTOR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [copied, setCopied] = useState(false);
  const pushOn = pushConfigured();
  const [push, setPush] = useState<'loading' | 'on' | 'off' | 'denied' | 'busy'>(
    'loading'
  );

  // Lien racine de l'application (HashRouter → l'accueil), indépendant de la
  // route courante. `BASE_URL` vaut « /mister-doc/ » en prod, « / » en local.
  const appUrl = window.location.origin + import.meta.env.BASE_URL;
  const canShare = typeof navigator.share === 'function';

  // Resynchronise si la fiche change (approbation, édition admin…).
  useEffect(() => {
    if (doctor) {
      setName(doctor.name);
      setColor(doctor.color);
    }
  }, [doctor]);

  // État initial du push (abonné sur ce navigateur ? autorisation refusée ?).
  useEffect(() => {
    if (!pushOn) return;
    let alive = true;
    currentPushEndpoint()
      .then(ep => {
        if (alive) setPush(ep ? 'on' : pushDenied() ? 'denied' : 'off');
      })
      .catch(() => {
        if (alive) setPush('off');
      });
    return () => {
      alive = false;
    };
  }, [pushOn]);

  if (!doctor) return null;

  const dirty = name.trim() !== doctor.name || color !== doctor.color;

  async function handleSave() {
    if (!dirty || !name.trim()) return;
    setSaving(true);
    try {
      await updateMyProfile(name.trim(), color);
      await refreshDoctor();
      toast.success('Profil mis à jour.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function togglePush() {
    if (!doctor) return;
    if (push === 'on') {
      setPush('busy');
      try {
        await disablePush();
        setPush('off');
        toast.success('Notifications push désactivées.');
      } catch {
        setPush('on');
        toast.error('Erreur lors de la désactivation.');
      }
      return;
    }
    setPush('busy');
    try {
      const r = await enablePush(doctor.id);
      setPush(r === 'on' ? 'on' : 'denied');
      if (r === 'on') toast.success('Notifications push activées.');
      else toast.error('Autorisation refusée dans le navigateur.');
    } catch {
      setPush('off');
      toast.error('Activation impossible.');
    }
  }

  // Partage natif si disponible (mobile), sinon repli sur la copie du lien.
  async function handleShare() {
    if (canShare) {
      try {
        await navigator.share({
          title: 'mister-doc',
          text: 'Planning des gardes — mister-doc',
          url: appUrl,
        });
      } catch {
        /* partage annulé par l'utilisateur */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Lien copié.');
    } catch {
      toast.error('Copie impossible — sélectionnez le lien manuellement.');
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-3 py-4 sm:px-4">
      {/* En-tête */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: doctor.color }}
        >
          {doctor.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{doctor.name}</h1>
          {doctor.email && (
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {doctor.email}
            </p>
          )}
        </div>
        {isAdmin && (
          <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            <ShieldCheck className="size-3.5" /> Admin
          </span>
        )}
      </div>

      {/* Identité */}
      <Section
        icon={<UserRound className="size-4" />}
        title="Identité"
        desc="Votre nom et votre couleur dans le planning"
      >
        <label className="mb-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Nom affiché
          </span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom du médecin"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <div className="mb-4 flex items-center gap-2">
          <Palette className="size-4 shrink-0 text-slate-400" />
          <div className="flex flex-wrap gap-2">
            {DOCTOR_COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`grid size-7 place-items-center rounded-full transition ${
                  color === c ? 'ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-900' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Couleur ${c}`}
              >
                {color === c && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full py-2.5"
          loading={saving}
          disabled={!dirty || !name.trim()}
          onClick={() => void handleSave()}
        >
          {!saving && <Check className="size-4" />}
          {dirty ? 'Enregistrer' : 'À jour'}
        </Button>
      </Section>

      {/* Apparence */}
      <Section
        icon={<SunMoon className="size-4" />}
        title="Apparence"
        desc="Thème clair ou sombre"
      >
        <SegmentedControl
          fullWidth
          ariaLabel="Thème clair ou sombre"
          value={theme}
          onChange={setTheme}
          options={[
            {
              value: 'light',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Sun className="size-4" /> Clair
                </span>
              ),
            },
            {
              value: 'dark',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Moon className="size-4" /> Sombre
                </span>
              ),
            },
          ]}
        />
      </Section>

      {/* Sécurité — double authentification (2FA) */}
      <TwoFactorCard />

      {/* Calendrier */}
      <Section
        icon={<CalendarPlus className="size-4" />}
        title="Calendrier"
        desc="S'abonner au flux .ics (Apple, Google, Outlook)"
      >
        <Button
          variant="secondary"
          className="w-full py-2.5"
          onClick={() => setCalendar(true)}
        >
          <CalendarPlus className="size-4" /> Gérer mon abonnement
        </Button>
      </Section>

      {/* Partager */}
      <Section
        icon={<Share2 className="size-4" />}
        title="Partager"
        desc="Envoyer le lien de l'application à un collègue"
      >
        <div className="mb-3 flex items-center rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
          <span className="truncate font-mono text-slate-500 dark:text-slate-400">
            {appUrl}
          </span>
        </div>
        <Button
          variant="secondary"
          className="w-full py-2.5"
          onClick={() => void handleShare()}
        >
          {copied ? (
            <Check className="size-4 text-teal-600" />
          ) : canShare ? (
            <Share2 className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? 'Lien copié' : 'Partager l’application'}
        </Button>
      </Section>

      {/* Notifications push (masqué si non configuré côté déploiement) */}
      {pushOn && (
        <Section
          icon={<BellRing className="size-4" />}
          title="Notifications push"
          desc="Être prévenu même quand l'app est fermée"
        >
          {push === 'denied' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Les notifications sont bloquées pour ce site. Autorisez-les dans les
              réglages du navigateur pour activer le push.
            </p>
          ) : (
            <Button
              variant={push === 'on' ? 'secondary' : 'primary'}
              className="w-full py-2.5"
              loading={push === 'busy' || push === 'loading'}
              onClick={() => void togglePush()}
            >
              {push !== 'busy' && push !== 'loading' && (
                <BellRing className="size-4" />
              )}
              {push === 'on'
                ? 'Désactiver les notifications push'
                : 'Activer les notifications push'}
            </Button>
          )}
        </Section>
      )}

      {/* Application */}
      <Section
        icon={<Info className="size-4" />}
        title="Application"
        desc="Version installée et mise à jour"
      >
        <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Version</span>
          <span className="font-mono text-xs font-medium tabular-nums">
            {APP_BUILD}
          </span>
        </div>
        <Button
          variant="secondary"
          className="w-full py-2.5"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void forceUpdate();
          }}
        >
          <RefreshCw className={`size-4 ${updating ? 'animate-spin' : ''}`} />
          Forcer la mise à jour
        </Button>
      </Section>

      <Button
        variant="dangerGhost"
        className="mt-1 w-full py-2.5 font-semibold"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" /> Se déconnecter
      </Button>

      {calendar && <CalendarDialog onClose={() => setCalendar(false)} />}
    </div>
  );
}
