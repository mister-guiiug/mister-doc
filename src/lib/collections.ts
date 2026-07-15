/** Petites aides sur les collections, sans dépendance. */

/**
 * Regroupe `items` par clé et renvoie une `Map` clé → tableau (l'ordre
 * d'insertion des items et des clés est préservé). Remplace l'idiome
 * `(m.get(k) ?? m.set(k, []).get(k)!).push(item)`.
 */
export function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}
