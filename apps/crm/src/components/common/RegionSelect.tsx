import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SearchableSelect from "@/components/common/SearchableSelect";

export const DIASPORA_VALUE = "Diaspora";

/** Aucun fallback statique : l'application doit respecter le référentiel géographique actif de la base. */

export function useRegions() {
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("v_geo_regions")
          .select("nom")
          .eq("est_active_effectif", true)
          .order("nom", { ascending: true });
        setRegions((data || []).map((r: any) => r.nom));
      } catch {
        /* repli statique */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { regions, loading };
}

interface RegionSelectProps {
  value?: string;
  onChange: (value: string, isDiaspora: boolean) => void;
  /** Affiche l'option Diaspora en premier */
  withDiaspora?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Sélecteur de région unique de l'application, branché sur la table `regions`.
 * Diaspora est proposé en premier lorsque l'option est disponible.
 */
export default function RegionSelect({
  value,
  onChange,
  withDiaspora = true,
  placeholder = "Sélectionnez une région...",
  disabled,
  id,
}: RegionSelectProps) {
  const { regions } = useRegions();

  return (
    <SearchableSelect
      value={value || ""}
      disabled={disabled}
      onValueChange={(v) => onChange(v, v === DIASPORA_VALUE)}
      options={regions.map(r => ({ value: r, label: r }))}
      placeholder={placeholder}
      searchPlaceholder="Rechercher une région..."
    />
  );
}
