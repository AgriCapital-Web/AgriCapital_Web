import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../EmptyState";
import { Sprout, TrendingUp, RefreshCw, Ruler, Calendar, Wrench } from "lucide-react";

export const TechniqueTab = ({ plantation }: { plantation: any }) => {
  const tickets: any[] = plantation?.tickets_techniques || [];
  const stats = [
    { icon: Sprout, label: "Plants prévus", value: plantation?.nombre_plants_prevus ?? "—" },
    { icon: Sprout, label: "Plants mis en terre", value: plantation?.nombre_plants_mis_en_terre ?? "—" },
    { icon: TrendingUp, label: "Taux de réussite", value: plantation?.taux_reussite != null ? `${plantation.taux_reussite}%` : "—" },
    { icon: RefreshCw, label: "Plants remplacés", value: plantation?.nombre_plants_remplaces ?? "—" },
    { icon: Ruler, label: "Surface plantée", value: plantation?.surface_reellement_plantee != null ? `${plantation.surface_reellement_plantee} ha` : "—" },
  ];

  const hasData = stats.some((s) => s.value !== "—");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((s, i) => (
          <Card key={i} className="card-brand-subtle rounded-2xl">
            <CardContent className="p-3 text-center">
              <s.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Dernière intervention</p>
              <p className="text-sm font-semibold">{plantation?.derniere_intervention || "En attente"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Prochaine intervention prévue</p>
              <p className="text-sm font-semibold">{plantation?.prochaine_intervention || "En attente"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {!hasData && <EmptyState title="Données techniques à venir" description="Vos techniciens renseigneront ces mesures depuis le CRM AgriCapital après chaque intervention terrain." />}
      {tickets.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Suivi CRM récent</p>
            {tickets.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{ticket.titre}</p>
                  <span className="text-[10px] text-primary">{ticket.statut || "ouvert"}</span>
                </div>
                {ticket.description && <p className="mt-1 text-xs text-muted-foreground">{ticket.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
