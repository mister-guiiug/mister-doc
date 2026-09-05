import { Check, Copy, Download, KeyRound } from 'lucide-react';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useI18n } from '../../i18n/index.ts';

type Props = {
  /** Codes fraîchement générés : affichés UNE fois, jamais réaffichables. */
  codes: string[];
  /** Le médecin confirme les avoir mis en lieu sûr (la carte les oublie alors). */
  onSaved: () => void;
};

/**
 * Bloc « codes de secours » : liste, copie presse-papiers et téléchargement.
 * Purement présentationnel — la liste reste la propriété de la carte parente,
 * seule responsable de son effacement en mémoire ; ce bloc ne fait que la
 * rendre et proposer de la sauvegarder avant qu'elle ne disparaisse.
 */
export function TwoFactorRecoveryCodes({ codes, onSaved }: Props) {
  const toast = useToast();
  const { t } = useI18n();

  function copyCodes() {
    void navigator.clipboard
      .writeText(codes.join('\n'))
      .then(() => toast.success(t('twoFactor.codesCopied')))
      .catch(() => toast.error(t('twoFactor.copyError')));
  }

  function downloadCodes() {
    const blob = new Blob(
      [t('twoFactor.backupFileHeader') + codes.join('\n') + '\n'],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codes-secours-mister-doc.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <KeyRound className="mt-0.5 size-4 shrink-0" />
        <span>{t('twoFactor.backupIntro')}</span>
      </p>
      <ul className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 p-3 font-mono text-sm dark:bg-slate-800">
        {codes.map(c => (
          <li key={c} className="text-center tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={copyCodes}>
          <Copy className="size-4" /> {t('twoFactor.copy')}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={downloadCodes}>
          <Download className="size-4" /> {t('twoFactor.download')}
        </Button>
      </div>
      <Button className="w-full py-2.5" onClick={onSaved}>
        <Check className="size-4" /> {t('twoFactor.savedCodes')}
      </Button>
    </div>
  );
}
