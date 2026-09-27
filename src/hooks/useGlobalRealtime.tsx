import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global realtime sync — listens to every business-critical table
 * and invalidates React-Query caches so all pages stay in sync.
 */
const TABLES = [
  'paiements',
  'clients',
  'plantations',
  'commissions',
  'portefeuilles',
  'notifications',
  'documents_acquisition',
  'parcelles',
  'proprietaires_terres',
  'offres',
  'promotions',
  'leads',
];

export const useGlobalRealtime = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const channels = TABLES.map((table) =>
      supabase
        .channel(`global-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => {
            qc.invalidateQueries({ queryKey: [table] });
            // Common derived keys
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['synthese'] });
          }
        )
        .subscribe()
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [qc]);
};
