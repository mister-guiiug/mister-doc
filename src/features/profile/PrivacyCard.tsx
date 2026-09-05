import { useState } from 'react';
import { Download, FileText, ShieldCheck, UserX } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useI18n } from '../../i18n/index.ts';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { PrivacyDialog } from '../legal/PrivacyPolicy.tsx';
import { anonymizeDoctor } from '../../backend/doctors.ts';
import { downloadMyData, exportMyData } from '../../backend/gdpr.ts';
import type { Doctor } from '../../backend/types.ts';

/**
 * Confidentialité & données (RGPD) : politique de confidentialité, export de
 * mes données (droit d'accès / portabilité) et effacement du compte.
 */
export function PrivacyCard({ doctor }: { doctor: Doctor }) {
  const { signOut } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [privacy, setPrivacy] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * L'EFFACEMENT RGPD EST DÉFINITIF. Il anonymise le compte puis déconnecte :
   * hors connexion, l'appel échoue et l'utilisateur reste connecté sans savoir
   * si son compte a été touché. Poser la question « êtes-vous sûr ? » pour une
   * suppression qui ne peut pas avoir lieu est le contraire d'un service.
   *
   * L'EXPORT, LUI, N'EST PAS GARDÉ : il lit des données puis fabrique un
   * fichier localement. Il échoue proprement, ne détruit rien, et se refait
   * d'un clic.
   */
  const deleteGuard = useActionGuard({ online: true });

  // Effacement RGPD (droit à l'effacement) : anonymise le compte puis déconnecte.
  async function handleDeleteAccount() {
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
    <>
      <SectionCard
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
          {/* `disabled` natif : le `Button` du socle retire `aria-disabled` de
              son type (il le pilote lui-même pour l'état « occupé »). Le motif
              vit donc juste en dessous, en `role="status"`, et en infobulle. */}
          <Button
            variant="outline"
            data-tone="danger"
            className="w-full py-2.5"
            disabled={deleteGuard.disabled}
            title={deleteGuard.reason ?? undefined}
            onClick={deleteGuard.wrap(() => void handleDeleteAccount())}
          >
            <UserX className="size-4" /> {t('profile.deleteAccount')}
          </Button>
          {deleteGuard.reason && (
            <p
              role="status"
              className="text-xs text-amber-700 dark:text-amber-400"
            >
              {deleteGuard.reason}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('profile.deleteNote')}
          </p>
        </div>
      </SectionCard>
      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </>
  );
}
