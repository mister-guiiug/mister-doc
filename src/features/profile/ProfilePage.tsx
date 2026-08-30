import { LogOut } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useI18n } from '../../i18n/index.ts';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { ProfileHeader } from './ProfileHeader.tsx';
import { IdentityCard } from './IdentityCard.tsx';
import { AppearanceCard } from './AppearanceCard.tsx';
import { LanguageCard } from './LanguageCard.tsx';
import { TwoFactorCard } from './TwoFactorCard.tsx';
import { PasskeyCard } from './PasskeyCard.tsx';
import { CalendarCard } from './CalendarCard.tsx';
import { ShareCard } from './ShareCard.tsx';
import { PushCard } from './PushCard.tsx';
import { PrivacyCard } from './PrivacyCard.tsx';
import { AppInfoCard } from './AppInfoCard.tsx';
import { OtherAppsCard } from './OtherAppsCard.tsx';

/**
 * Écran « Profil » : assemblage des cartes de réglages. Chaque carte est
 * autonome (son état et ses appels backend lui appartiennent) ; cette page ne
 * fait que garder l'ordre d'affichage et la déconnexion.
 */
export function ProfilePage() {
  const { doctor, isAdmin, signOut } = useAuth();
  const { t } = useI18n();

  if (!doctor) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-3 py-4 sm:px-4">
      {/* En-tête */}
      <ProfileHeader doctor={doctor} isAdmin={isAdmin} />

      {/* Identité */}
      <IdentityCard doctor={doctor} />

      {/* Apparence */}
      <AppearanceCard />

      {/* Langue */}
      <LanguageCard />

      {/* Sécurité — double authentification (2FA) */}
      <TwoFactorCard />

      {/* Sécurité — connexion par empreinte (passkeys / WebAuthn) */}
      <PasskeyCard />

      {/* Calendrier */}
      <CalendarCard />

      {/* Partager */}
      <ShareCard />

      {/* Notifications push (masqué si non configuré côté déploiement) */}
      <PushCard doctorId={doctor.id} />

      {/* Confidentialité & données (RGPD) */}
      <PrivacyCard doctor={doctor} />

      {/* Application */}
      <AppInfoCard />

      {/* Autres applications de la famille (composant partagé, catalogue) */}
      <OtherAppsCard />

      <Button
        variant="outline"
        data-tone="danger"
        className="mt-1 w-full py-2.5 font-semibold"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" /> {t('profile.signOut')}
      </Button>
    </div>
  );
}
