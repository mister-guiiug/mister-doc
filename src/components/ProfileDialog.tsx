import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { DOCTOR_COLORS } from '../lib/colors.ts';
import { Modal } from './Modal.tsx';
import { Button } from './ui/Button.tsx';

/**
 * Dialogue d'édition du nom (et de la couleur) d'un médecin. Réutilisé pour
 * l'auto-édition de profil et pour le renommage par un admin.
 */
export function ProfileDialog({
  title,
  initialName,
  initialColor,
  onSave,
  onClose,
}: {
  title: string;
  initialName: string;
  initialColor: string;
  onSave: (name: string, color: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom ne peut pas être vide.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave(trimmed, color);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-sm rounded-t-2xl p-5 sm:rounded-2xl">
      <form onSubmit={handleSubmit}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-5" />
          </button>
        </div>

        <label className="mb-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Nom affiché
          </span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom du médecin"
            autoFocus
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Couleur
          </span>
          <div className="flex flex-wrap gap-2">
            {DOCTOR_COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`grid size-7 place-items-center rounded-full transition ${
                  color === c ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Couleur ${c}`}
              >
                {color === c && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button type="submit" loading={busy} className="flex-1">
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
