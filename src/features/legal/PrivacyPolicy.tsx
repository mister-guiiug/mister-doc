import { X } from 'lucide-react';
import { Modal } from '../../components/Modal.tsx';
import { useI18n } from '../../i18n/index.ts';

/**
 * Politique de confidentialité (RGPD). Les FAITS TECHNIQUES sont exacts ; les
 * mentions juridiques propres à l'établissement (responsable du traitement,
 * coordonnées, base légale, durées) sont des PLACEHOLDERS « [À compléter] » que
 * l'exploitant doit renseigner. Ne pas publier tel quel sans les compléter.
 */
export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal
      onClose={onClose}
      className="flex max-h-[85dvh] max-w-lg flex-col rounded-t-2xl sm:rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <h2 className="font-semibold">{t('privacy.title')}</h2>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* tabIndex : région scrollable atteignable au clavier (axe serious). */}
      <div
        tabIndex={0}
        className="space-y-4 overflow-y-auto p-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
      >
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {t('privacy.templateWarningBefore')}
          <span className="font-mono">{t('privacy.templatePlaceholder')}</span>
          {t('privacy.templateWarningAfter')}
        </p>

        <Section title={t('privacy.controllerTitle')}>
          {t('privacy.controllerBody')}
        </Section>

        <Section title={t('privacy.collectedTitle')}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>{t('privacy.collectedIdentity')}</b>
              {t('privacy.collectedIdentityBody')}
            </li>
            <li>
              <b>{t('privacy.collectedPlanning')}</b>
              {t('privacy.collectedPlanningBody')}
            </li>
            <li>
              <b>{t('privacy.collectedTechnical')}</b>
              {t('privacy.collectedTechnicalBody')}
            </li>
          </ul>
        </Section>

        <Section title={t('privacy.purposeTitle')}>
          {t('privacy.purposeBody1')}
          <b>{t('privacy.purposeBold')}</b>
          {t('privacy.purposeBody2')}
        </Section>

        <Section title={t('privacy.hostingTitle')}>
          {t('privacy.hostingBody1')}
          <b>{t('privacy.hostingSupabase')}</b>
          {t('privacy.hostingBody2')}
          <b>{t('privacy.hostingBold1')}</b>
          {t('privacy.hostingBody3')}
          <b>{t('privacy.hostingBold2')}</b>
          {t('privacy.hostingBody4')}
        </Section>

        <Section title={t('privacy.retentionTitle')}>
          {t('privacy.retentionBody')}
        </Section>

        <Section title={t('privacy.securityTitle')}>
          {t('privacy.securityBody1')}
          <b>{t('privacy.securityBold1')}</b>
          {t('privacy.securityBody2')}
          <b>{t('privacy.securityBold2')}</b>
          {t('privacy.securityBody3')}
          <b>{t('privacy.securityBold3')}</b>
          {t('privacy.securityBody4')}
        </Section>

        <Section title={t('privacy.rightsTitle')}>
          {t('privacy.rightsIntro')}
          <b>{t('privacy.rightsAccess')}</b>,{' '}
          <b>{t('privacy.rightsRectify')}</b>, <b>{t('privacy.rightsErase')}</b>
          , <b>{t('privacy.rightsPortability')}</b>
          {t('privacy.rightsIntroEnd')}
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <b>{t('privacy.rightsAccessItem')}</b>
              {t('privacy.rightsAccessBody')}
            </li>
            <li>
              <b>{t('privacy.rightsRectifyItem')}</b>
              {t('privacy.rightsRectifyBody')}
            </li>
            <li>
              <b>{t('privacy.rightsEraseItem')}</b>
              {t('privacy.rightsEraseBody1')}
              <i>{t('privacy.rightsEraseItalic')}</i>
              {t('privacy.rightsEraseBody2')}
            </li>
          </ul>
          {t('privacy.rightsContact')}
          <b>{t('privacy.rightsCnil')}</b>
          {t('privacy.rightsCnilUrl')}
        </Section>

        <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('privacy.lastUpdate')}
        </p>
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
