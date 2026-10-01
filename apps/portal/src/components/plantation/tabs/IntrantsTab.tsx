import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../EmptyState";
import { Package } from "lucide-react";

export const IntrantsTab = ({ plantation }: { plantation: any }) => {
  const intrants: any[] = plantation?.intrants || [];
  if (intrants.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Aucun intrant enregistré"
        description="Recommandations, quantités, coûts estimatifs, statut d'approvisionnement et d'application apparaîtront ici. Vous pourrez ensuite régler comptant, échelonné ou par retenue sur revenus."
      />
    );
  }
  return (
    <div className="space-y-2">
      {intrants.map((it, i) => (
        <Card key={i} className="rounded-xl">
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{it.nom}</p>
                <p className="text-[11px] text-muted-foreground">{it.quantite} · {it.statut}</p>
              </div>
              <p className="font-bold text-sm text-gold-dark">{it.cout}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
