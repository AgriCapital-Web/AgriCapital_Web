import { useEffect, useState } from "react";

/**
 * Hook pour détecter si l'application est accédée via pay.agricapital.ci
 * et doit afficher le portail client plutôt que l'interface de gestion
 */
export const useClientPortal = () => {
  const [isClientPortal, setIsClientPortal] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    // Vérifier si c'est le sous-domaine pay, client ou abonne UNIQUEMENT
    const isPayDomain = 
      hostname === 'pay.agricapital.ci' || 
      hostname === 'client.agricapital.ci' ||
      hostname === 'abonne.agricapital.ci' ||
      hostname.startsWith('pay.') ||
      hostname.startsWith('client.') ||
      hostname.startsWith('abonne.');
    
    setIsClientPortal(isPayDomain);
  }, []);

  return { isClientPortal };
};

/**
 * Fonction utilitaire pour vérifier si on est sur le portail client
 */
export const isOnClientPortal = (): boolean => {
  const hostname = window.location.hostname;
  return (
    hostname === 'pay.agricapital.ci' || 
    hostname === 'client.agricapital.ci' ||
    hostname === 'abonne.agricapital.ci' ||
    hostname.startsWith('pay.') ||
    hostname.startsWith('client.') ||
    hostname.startsWith('abonne.')
  );
};
