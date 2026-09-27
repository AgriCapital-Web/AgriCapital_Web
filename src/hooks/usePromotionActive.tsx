import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meilleurePromotion, PromotionBase, OffreBase } from "@/lib/pricing";

/**
 * Retourne la meilleure promotion active applicable à l'offre demandée.
 * Sans offreId, retourne la meilleure promotion active globale.
 */
export const usePromotionActive = (offreId?: string | null) => {
  return useQuery({
    queryKey: ["promotion-active", offreId || "global"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("active", true)
        .lte("date_debut", now)
        .gte("date_fin", now)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const promotions = (data || []) as PromotionBase[];
      if (!offreId) return promotions[0] || null;

      const offre = { id: offreId } as OffreBase;
      return meilleurePromotion(offre, promotions);
    },
    staleTime: 30_000,
  });
};
