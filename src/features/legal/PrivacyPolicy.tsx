import { X } from 'lucide-react';
import { Modal } from '../../components/Modal.tsx';

/**
 * Politique de confidentialité (RGPD). Les FAITS TECHNIQUES sont exacts ; les
 * mentions juridiques propres à l'établissement (responsable du traitement,
 * coordonnées, base légale, durées) sont des PLACEHOLDERS « [À compléter] » que
 * l'exploitant doit renseigner. Ne pas publier tel quel sans les compléter.
 */
export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      onClose={onClose}
      className="flex max-h-[85dvh] max-w-lg flex-col rounded-t-2xl sm:rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <h2 className="font-semibold">Politique de confidentialité</h2>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto p-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Modèle à compléter par l'exploitant : les mentions entre crochets
          <span className="font-mono"> [À compléter] </span> doivent être
          renseignées avant mise en service.
        </p>

        <Section title="Responsable du traitement">
          [À compléter : nom de l'établissement / du responsable, adresse, e-mail
          de contact, et le cas échéant délégué à la protection des données (DPO)].
        </Section>

        <Section title="Données collectées">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Identité</b> : nom affiché, adresse e-mail (pour l'authentification),
              couleur d'affichage.
            </li>
            <li>
              <b>Données de planning</b> : gardes, absences (congés / formations),
              heures non cliniques, vœux de disponibilité, notes de jour rédigées,
              échanges de gardes.
            </li>
            <li>
              <b>Données techniques</b> : session d'authentification et préférences
              (thème) stockées dans votre navigateur ; abonnement aux notifications
              push si vous l'activez.
            </li>
          </ul>
        </Section>

        <Section title="Finalités et base légale">
          Les données servent uniquement à <b>organiser et consulter le planning de
          gardes</b> de l'équipe. Base légale : [À compléter — p. ex. exécution d'une
          mission / intérêt légitime de l'établissement].
        </Section>

        <Section title="Hébergement et destinataires">
          Les données sont hébergées par <b>Supabase</b> (infrastructure dans
          l'Union européenne). Elles ne sont <b>ni vendues, ni partagées</b> avec des
          tiers, et l'application <b>n'utilise aucun traceur publicitaire ni outil
          d'analyse</b>. Seuls les membres approuvés de l'équipe et les
          administrateurs accèdent au planning.
        </Section>

        <Section title="Durée de conservation">
          [À compléter : durée de conservation des comptes et des données de planning].
          Les données sont supprimées ou anonymisées à la clôture du compte (voir
          « Vos droits »).
        </Section>

        <Section title="Sécurité">
          Accès protégé par mot de passe (8 caractères min.) et{' '}
          <b>double authentification (TOTP)</b> optionnelle ; cloisonnement par{' '}
          <b>règles RLS</b> côté serveur ; chiffrement en transit (HTTPS) ; liens
          d'abonnement calendrier <b>hashés</b> au repos ; journal d'audit des
          actions sensibles.
        </Section>

        <Section title="Vos droits">
          Conformément au RGPD, vous disposez des droits d'<b>accès</b>, de{' '}
          <b>rectification</b>, d'<b>effacement</b>, de <b>portabilité</b>,
          d'opposition et de limitation.
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <b>Accès / portabilité</b> : « Télécharger mes données » depuis votre
              profil (export JSON).
            </li>
            <li>
              <b>Rectification</b> : modifiez votre nom et votre couleur depuis votre
              profil.
            </li>
            <li>
              <b>Effacement</b> : un compte <i>en attente</i> peut supprimer lui-même
              sa demande. Pour un compte approuvé, contactez un administrateur : vos
              données d'identité sont supprimées ou anonymisées ; l'historique de
              planning peut être conservé sous forme anonymisée au titre de l'intérêt
              légitime de l'établissement.
            </li>
          </ul>
          Pour exercer ces droits ou une réclamation : [À compléter — contact].
          Vous pouvez aussi saisir la <b>CNIL</b> (www.cnil.fr).
        </Section>

        <p className="pt-2 text-xs text-slate-400">
          Dernière mise à jour : [À compléter].
        </p>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
