import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../EmptyState";
import { TrendingUp, Weight, DollarSign, LineChart } from "lucide-react";
import { formatCFA } from "@/utils/pricing";

export const ProductionTab = ({ plantation }: { plantation: any }) => {
  const prod = plantation?.production || {};
  const stats = [
    { icon: Weight, label: "Production annuelle", value: prod.annuelle_tonnes != null ? `${prod.annuelle_tonnes} t` : "—" },
    { icon: TrendingUp, label: "Production cumulée", value: prod.cumulee_tonnes != null ? `${prod.cumulee_tonnes} t` : "—" },
    { icon: DollarSign, label: "Prix bord champ (FCFA/kg)", value: prod.prix_bord_champ != null ? formatCFA(prod.prix_bord_champ) : "—" },
    { icon: LineChart, label: "Valeur brute", value: prod.valeur_brute != null ? formatCFA(prod.valeur_brute) : "—" },
  ];
  const hasData = stats.some((s) => s.value !== "—");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s, i) => (
          <Card key={i} className="card-brand-subtle rounded-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase truncate">{s.label}</span>
              </div>
              <p className="text-base font-bold truncate">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {!hasData && <EmptyState title="Suivi production à venir" description="Les données de récoltes, tonnages et prix bord champ seront synchronisées depuis le CRM AgriCapital." />}
    </div>
  );
};
