// Stockage local de session AgriCapital.
// Aucun pont d'authentification externe n'est utilisé.
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return localStorage;
}
