/**
 * Message d'erreur d'un écran ou d'une carte. Le même bloc rouge était recopié
 * à l'identique dans sept fichiers : une seule définition évite que les
 * variantes divergent (teinte, espacement, mode sombre).
 *
 * `role="alert"` : l'erreur apparaît APRÈS une action de l'utilisateur (échec
 * d'enregistrement, de chargement…) ; sans ce rôle, un lecteur d'écran ne
 * l'annonce pas et l'échec passe inaperçu. Rendu visuel inchangé.
 */
export function ErrorMessage({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={`rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 ${className}`}
    >
      {children}
    </p>
  );
}
