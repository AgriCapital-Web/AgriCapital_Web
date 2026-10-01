import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PromotionActive {
  id: string;
  nom: string;
  pourcentage_reduction: number;
  date_debut: string;
  date_fin: string;
  applique_toutes_offres: boolean;
}

export const usePromotionActive = () => {
  return useQuery({
    queryKey: ['promotion-active'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .lte('date_debut', now)
        .gte('date_fin', now)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      return data && data.length > 0 ? (data[0] as PromotionActive) : null;
    },
    refetchInterval: 60000, // Refresh every minute
  });
};

export const calculerMontantDA = (
  superficieHa: number,
  montantUnitaireOffre: number,
  promotionActive: PromotionActive | null
): {
  montantUnitaire: number;
  montantTotal: number;
  economie: number;
  promotionAppliquee: boolean;
  pourcentageReduction: number;
} => {
  const montantNormal = montantUnitaireOffre || 30000;
  
  let montantUnitaire = montantNormal;
  let pourcentageReduction = 0;
  
  if (promotionActive) {
    pourcentageReduction = promotionActive.pourcentage_reduction;
    montantUnitaire = montantNormal - (montantNormal * pourcentageReduction / 100);
  }
  
  const montantTotal = superficieHa * montantUnitaire;
  const montantSansPromo = superficieHa * montantNormal;
  const economie = montantSansPromo - montantTotal;
  
  return {
    montantUnitaire,
    montantTotal,
    economie,
    promotionAppliquee: promotionActive !== null,
    pourcentageReduction,
  };
};