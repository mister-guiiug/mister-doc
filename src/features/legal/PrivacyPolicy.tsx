import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { useI18n } from '../../i18n/index.ts';
import {
  mentions as mentionsExploitant,
  mentionsIncompletes,
  type MentionsExploitant,
} from './exploitant.ts';

/**
 * Politique de confidentialité (RGPD). Les FAITS TECHNIQUES sont exacts et
 * vivent ici ; les quatre mentions propres à l'établissement (responsable du
 * traitement, base légale, durée de conservation, contact) et la date de
 * publication viennent de `exploitant.ts` — un seul fichier à remplir, au lieu
 * de placeholders semés dans le catalogue i18n, dont cinq étaient partis en
 * production.
 *
 * Tant qu'une mention manque, un bandeau le dit et la NOMME ; il disparaît de
 * lui-même quand `exploitant.ts` est rempli. `exploitant.test.tsx` refuse le
 * marqueur dans tout ce qui est servi.
 */
export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('privacy.title')}
      closeLabel={t('common.close')}
    >
      <PrivacyBody mentions={mentionsExploitant} />
    </Sheet>
  );
}

/**
 * Le corps du texte, séparé du `Sheet` et paramétré par les mentions. Le
 * paramètre n'existe QUE pour que le test puisse rendre la page avec un jeu de
 * mentions complet sans truquer un module : `PrivacyDialog` lui passe toujours
 * celles de `exploitant.ts`, et c'est le seul appelant en production.
 */
export function PrivacyBody({ mentions }: { mentions: MentionsExploitant }) {
  const { t, locale } = useI18n();
  const manquantes = mentionsIncompletes(mentions);
  const labels: Record<string, string> = {
    responsable: t('privacy.mentionResponsable'),
    baseLegale: t('privacy.mentionBaseLegale'),
    conservation: t('privacy.mentionConservation'),
    contact: t('privacy.mentionContact'),
    derniereMiseAJour: t('privacy.mentionDerniereMiseAJour'),
  };
  return (
    <>
      {/* tabIndex : la zone qui défile (`sheet-body`) doit rester atteignable
          au clavier. Elle ne contient aucun élément focusable — que du texte —
          et c'est exactement le cas que la règle axe `scrollable-region-
          focusable` (WCAG 2.1.1) signale. Le conteneur porte donc le focus à
          sa place, comme le faisait la version locale. */}
      <div
        tabIndex={0}
        className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
      >
        {manquantes.length > 0 && (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {t('privacy.templateWarning', {
              mentions: manquantes.map(nom => labels[nom] ?? nom).join(', '),
            })}
          </p>
        )}

        <Section title={t('privacy.controllerTitle')}>
          {phrase(mentions.responsable[locale])}
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
          {phrase(mentions.baseLegale[locale])}
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
          {phrase(mentions.conservation[locale])}
          {t('privacy.retentionAfter')}
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
          {t('privacy.rightsContactBefore')}
          {phrase(mentions.contact[locale])}
          {t('privacy.rightsContactAfter')}
          <b>{t('privacy.rightsCnil')}</b>
          {t('privacy.rightsCnilUrl')}
        </Section>

        <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('privacy.lastUpdateLabel')}
          {mentions.derniereMiseAJour}
        </p>
      </div>
    </>
  );
}

/**
 * Ajoute le point final si l'exploitant ne l'a pas écrit : ses valeurs
 * s'intercalent au milieu de phrases (« Base légale : … »), et une ponctuation
 * oubliée y serait visible.
 */
function phrase(valeur: string): string {
  return /[.!?]$/.test(valeur.trimEnd()) ? valeur : `${valeur}.`;
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
