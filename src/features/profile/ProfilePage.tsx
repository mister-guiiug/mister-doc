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
  FileText,
  Download,
  UserX,
  LayoutGrid,
  Languages,
} from 'lucide-react';
import { FamilyApps } from '@mister-guiiug/dev-wpa-config/react';
import { useAuth } from '../../auth/useAuth.ts';
import { useI18n } from '../../i18n/index.ts';
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
import { anonymizeDoctor, updateMyProfile } from '../../backend/doctors.ts';
import { CalendarDialog } from '../../components/CalendarDialog.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { TwoFactorCard } from './TwoFactorCard.tsx';
import { PasskeyCard } from './PasskeyCard.tsx';
import { PrivacyDialog } from '../legal/PrivacyPolicy.tsx';
import { exportMyData, downloadMyData } from '../../backend/gdpr.ts';

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
  const { t, locale, setLocale, locales } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(doctor?.name ?? '');
  const [color, setColor] = useState(doctor?.color ?? DOCTOR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pushOn = pushConfigured();
  const [push, setPush] = useState<
    'loading' | 'on' | 'off' | 'denied' | 'busy'
  >('loading');

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
      toast.success(t('profile.profileUpdated'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
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
        toast.success(t('profile.pushDisabled'));
      } catch {
        setPush('on');
        toast.error(t('profile.pushDisableError'));
      }
      return;
    }
    setPush('busy');
    try {
      const r = await enablePush(doctor.id);
      setPush(r === 'on' ? 'on' : 'denied');
      if (r === 'on') toast.success(t('profile.pushEnabled'));
      else toast.error(t('profile.pushDenied'));
    } catch {
      setPush('off');
      toast.error(t('profile.pushEnableError'));
    }
  }

  // Partage natif si disponible (mobile), sinon repli sur la copie du lien.
  async function handleShare() {
    if (canShare) {
      try {
        await navigator.share({
          title: 'mister-doc',
          text: t('profile.shareText'),
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
      toast.success(t('profile.linkCopiedToast'));
    } catch {
      toast.error(t('profile.copyImpossible'));
    }
  }

  // Effacement RGPD (droit à l'effacement) : anonymise le compte puis déconnecte.
  async function handleDeleteAccount() {
    if (!doctor) return;
    const ok = await confirm({
      title: t('profile.deleteConfirmTitle'),
      message: t('profile.deleteConfirmMsg'),
      danger: true,
      confirmLabel: t('profile.deleteConfirmLabel'),
    });
    if (!ok) return;
    try {
      await anonymizeDoctor(doctor.id);
      await signOut();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('profile.deleteError'));
    }
  }

  // Export RGPD (droit d'accès / portabilité) : télécharge mes données en JSON.
  async function handleExport() {
    if (!doctor) return;
    setExporting(true);
    try {
      downloadMyData(await exportMyData(doctor));
      toast.success(t('profile.dataDownloaded'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('profile.exportError'));
    } finally {
      setExporting(false);
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
            <ShieldCheck className="size-3.5" /> {t('profile.admin')}
          </span>
        )}
      </div>

      {/* Identité */}
      <Section
        icon={<UserRound className="size-4" />}
        title={t('profile.identityTitle')}
        desc={t('profile.identityDesc')}
      >
        <label className="mb-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {t('profile.displayName')}
          </span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('profile.namePlaceholder')}
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
                  color === c
                    ? 'ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-900'
                    : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={t('profile.colorAria', { color: c })}
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
          {dirty ? t('common.save') : t('common.saved')}
        </Button>
      </Section>

      {/* Apparence */}
      <Section
        icon={<SunMoon className="size-4" />}
        title={t('profile.appearanceTitle')}
        desc={t('profile.appearanceDesc')}
      >
        <SegmentedControl
          fullWidth
          ariaLabel={t('profile.themeAria')}
          value={theme}
          onChange={setTheme}
          options={[
            {
              value: 'light',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Sun className="size-4" /> {t('profile.light')}
                </span>
              ),
            },
            {
              value: 'dark',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Moon className="size-4" /> {t('profile.dark')}
                </span>
              ),
            },
          ]}
        />
      </Section>

      {/* Langue */}
      <Section
        icon={<Languages className="size-4" />}
        title={t('settings.languageTitle')}
        desc={t('settings.languageDesc')}
      >
        <SegmentedControl
          fullWidth
          ariaLabel={t('settings.languageAria')}
          value={locale}
          onChange={setLocale}
          options={locales.map(l => ({
            value: l,
            label: l === 'fr' ? t('settings.french') : t('settings.english'),
          }))}
        />
      </Section>

      {/* Sécurité — double authentification (2FA) */}
      <TwoFactorCard />

      {/* Sécurité — connexion par empreinte (passkeys / WebAuthn) */}
      <PasskeyCard />

      {/* Calendrier */}
      <Section
        icon={<CalendarPlus className="size-4" />}
        title={t('profile.calendarTitle')}
        desc={t('profile.calendarDesc')}
      >
        <Button
          variant="secondary"
          className="w-full py-2.5"
          onClick={() => setCalendar(true)}
        >
          <CalendarPlus className="size-4" /> {t('profile.manageSubscription')}
        </Button>
      </Section>

      {/* Partager */}
      <Section
        icon={<Share2 className="size-4" />}
        title={t('profile.shareTitle')}
        desc={t('profile.shareDesc')}
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
          {copied ? t('profile.linkCopied') : t('profile.shareApp')}
        </Button>
      </Section>

      {/* Notifications push (masqué si non configuré côté déploiement) */}
      {pushOn && (
        <Section
          icon={<BellRing className="size-4" />}
          title={t('profile.pushTitle')}
          desc={t('profile.pushDesc')}
        >
          {push === 'denied' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {t('profile.pushBlocked')}
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
                ? t('profile.pushDisable')
                : t('profile.pushEnable')}
            </Button>
          )}
        </Section>
      )}

      {/* Confidentialité & données (RGPD) */}
      <Section
        icon={<ShieldCheck className="size-4" />}
        title={t('profile.privacyTitle')}
        desc={t('profile.privacyDesc')}
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            className="w-full py-2.5"
            onClick={() => setPrivacy(true)}
          >
            <FileText className="size-4" /> {t('profile.privacyPolicy')}
          </Button>
          <Button
            variant="secondary"
            className="w-full py-2.5"
            loading={exporting}
            onClick={() => void handleExport()}
          >
            {!exporting && <Download className="size-4" />}{' '}
            {t('profile.downloadData')}
          </Button>
          <Button
            variant="dangerGhost"
            className="w-full py-2.5"
            onClick={() => void handleDeleteAccount()}
          >
            <UserX className="size-4" /> {t('profile.deleteAccount')}
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('profile.deleteNote')}
          </p>
        </div>
      </Section>

      {/* Application */}
      <Section
        icon={<Info className="size-4" />}
        title={t('profile.appTitle')}
        desc={t('profile.appDesc')}
      >
        <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {t('profile.version')}
          </span>
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
          {t('profile.forceUpdate')}
        </Button>
      </Section>

      {/* Autres applications de la famille (composant partagé, catalogue) */}
      <Section
        icon={<LayoutGrid className="size-4" />}
        title={t('profile.otherAppsTitle')}
        desc={t('profile.otherAppsDesc')}
      >
        <div className="family-apps">
          <FamilyApps currentAppId="mister-doc" showSponsor={false} />
        </div>
      </Section>

      <Button
        variant="dangerGhost"
        className="mt-1 w-full py-2.5 font-semibold"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" /> {t('profile.signOut')}
      </Button>

      {calendar && <CalendarDialog onClose={() => setCalendar(false)} />}
      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </div>
  );
}
