/**
 * Heure relative en français (« à l'instant », « il y a 5 min », « il y a 3 h »,
 * « il y a 2 j »), puis la date locale au-delà d'une semaine. Formateur partagé
 * (journal d'audit, historique de créneau…).
 */
export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}
