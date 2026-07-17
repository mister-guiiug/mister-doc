/**
 * Traduit en français les messages d'erreur d'authentification renvoyés (en
 * anglais) par Supabase Auth, pour ne jamais exposer de texte technique à
 * l'utilisateur dans une interface entièrement francophone.
 *
 * On raisonne par sous-chaîne (les libellés Supabase peuvent varier légèrement
 * selon la version) et on retombe sur un message générique si rien ne matche.
 */
export function frAuthError(message: string | undefined | null): string {
  if (!message) return 'Une erreur est survenue. Réessayez.';
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials'))
    return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed'))
    return 'E-mail non confirmé : vérifiez votre boîte de réception.';
  if (
    m.includes('user already registered') ||
    m.includes('already been registered') ||
    m.includes('already exists')
  )
    return 'Un compte existe déjà avec cet e-mail.';
  if (
    m.includes('password should be at least') ||
    m.includes('password is too short') ||
    m.includes('weak password')
  )
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (
    m.includes('unable to validate email') ||
    m.includes('invalid email') ||
    (m.includes('email') && m.includes('invalid'))
  )
    return 'Adresse e-mail invalide.';
  if (
    m.includes('rate limit') ||
    m.includes('for security purposes') ||
    m.includes('too many')
  )
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'Les inscriptions sont désactivées pour le moment.';
  if (
    m.includes('failed to fetch') ||
    m.includes('network') ||
    m.includes('load failed')
  )
    return 'Erreur réseau : vérifiez votre connexion.';

  return 'Une erreur est survenue. Réessayez.';
}
