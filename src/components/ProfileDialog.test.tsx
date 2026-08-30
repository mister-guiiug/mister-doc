import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/index.ts';
import { ProfileDialog } from './ProfileDialog.tsx';

/**
 * LE BOUTON D'ENVOI EST-IL ENCORE RATTACHÉ À SON FORMULAIRE ?
 *
 * La barre d'actions de `Sheet` est ÉPINGLÉE : elle vit hors des `children`,
 * donc hors du `<form>`. Un `<button type="submit">` qui n'a plus de formulaire
 * ancêtre ne soumet plus rien — et c'est un défaut parfaitement silencieux, que
 * ni le compilateur ni un test d'existence ne voient. L'attribut `form` le
 * rattache ; ce test le verrouille.
 *
 * Trois dialogues partagent ce montage : celui-ci, `HncDialog` et
 * `LeaveDialog`.
 */

function renderDialog(onSave = vi.fn().mockResolvedValue(undefined)) {
  localStorage.setItem('misterdoc_locale', 'fr');
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <ProfileDialog
        title="Mon profil"
        initialName="Dr Test"
        initialColor="#0f766e"
        onSave={onSave}
        onClose={onClose}
      />
    </I18nProvider>
  );
  return { onSave, onClose };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ProfileDialog', () => {
  it('expose un dialogue nommé par son titre visible', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Mon profil' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Étiqueté PAR le titre affiché, pas par une copie du texte.
    expect(
      screen.getByRole('heading', { name: 'Mon profil' })
    ).toBeInTheDocument();
  });

  it('soumet le formulaire depuis le bouton épinglé du pied', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderDialog();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Dr Nouveau');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith('Dr Nouveau', '#0f766e');
    expect(onClose).toHaveBeenCalled();
  });

  it('valide encore le nom vide sans rien enregistrer', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Le nom ne peut pas être vide.'
    );
  });

  it('se ferme par Échap et par le bouton de fermeture', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
