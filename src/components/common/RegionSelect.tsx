import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DIASPORA_VALUE = "Diaspora";

/** Repli statique utilisé uniquement si la table `regions` est indisponible */
const REGIONS_FALLBACK = [
  "Abidjan", "Agnéby-Tiassa", "Bafing", "Bagoué", "Bélier", "Béré", "Bounkani", "Cavally", "Folon",
  "Gbêkê", "Gbôklé", "Gôh", "Gontougo", "Grands-Ponts", "Guémon", "Hambol", "Haut-Sassandra",
  "Iffou", "Indénié-Djuablin", "Kabadougou", "La Mé", "Lôh-Djiboua", "Marahoué", "Moronou",
  "Nawa", "N'Zi", "Poro", "San-Pédro", "Sud-Comoé", "Tchologo", "Tonkpi", "Worodougou", "Yamoussoukro",
];

export function useRegions() {
  const [regions, setRegions] = useState<string[]>(REGIONS_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("v_geo_regions")
          .select("nom")
          .eq("est_active_effectif", true)
          .order("nom", { ascending: true });
        if (data && data.length > 0) setRegions(data.map((r: any) => r.nom));
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
    <Select
      value={value || undefined}
      disabled={disabled}
      onValueChange={(v) => onChange(v, v === DIASPORA_VALUE)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {withDiaspora && <SelectItem value={DIASPORA_VALUE}>Diaspora</SelectItem>}
        {regions.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
