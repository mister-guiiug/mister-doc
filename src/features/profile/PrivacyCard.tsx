import { useState } from 'react';
import { Download, FileText, ShieldCheck, UserX } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useI18n } from '../../i18n/index.ts';
import { useToast } from '../../components/Toast.tsx';
import { Button } from '../../components/ui/Button.tsx';
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
      </SectionCard>
      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </>
  );
}
