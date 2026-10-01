import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout } from "lucide-react";

interface Props {
  plantations: any[];
  selectedId: string;
  onChange: (id: string) => void;
}

export const PlantationSelector = ({ plantations, selectedId, onChange }: Props) => {
  if (plantations.length <= 1) {
    const p = plantations[0];
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl text-white">
        <Sprout className="h-4 w-4 text-gold" />
        <span className="text-sm font-semibold truncate">{p?.nom_plantation || p?.id_unique || "Ma plantation"}</span>
      </div>
    );
  }
  return (
    <Select value={selectedId} onValueChange={onChange}>
      <SelectTrigger className="bg-white/10 border-white/20 text-white h-10">
        <SelectValue placeholder="Choisir une plantation" />
      </SelectTrigger>
      <SelectContent>
        {plantations.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.nom_plantation || p.id_unique} · {p.superficie_ha}ha
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
