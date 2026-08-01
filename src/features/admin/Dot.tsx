/**
 * Pastille de couleur d'un médecin, partagée par les listes de l'admin
 * (comptes en attente et membres).
 */
export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}
