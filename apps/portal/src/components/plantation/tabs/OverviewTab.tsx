import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "../StatusBadge";
import { MapPin, Sprout, Ruler, Calendar, Leaf, Package } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const OverviewTab = ({ plantation, souscripteur }: { plantation: any; souscripteur: any }) => {
  const offreNom = souscripteur?.offres?.nom || "—";
  const dateDemarrage = plantation?.date_activation || plantation?.created_at;

  const items = [
    { icon: Package, label: "Formule", value: offreNom },
    { icon: Leaf, label: "Culture", value: "Palmier à huile" },
    { icon: Ruler, label: "Superficie", value: `${plantation?.superficie_ha || 0} ha` },
    { icon: MapPin, label: "Localisation", value: plantation?.village_nom || plantation?.village || plantation?.localite || "—" },
    { icon: Calendar, label: "Date de démarrage", value: dateDemarrage ? format(new Date(dateDemarrage), "dd MMM yyyy", { locale: fr }) : "En attente" },
    { icon: Sprout, label: "Identifiant", value: plantation?.id_unique || "—" },
  ];

  return (
    <div className="space-y-3">
      <Card className="card-brand-subtle rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Client</p>
              <h2 className="font-bold truncate">{souscripteur?.nom_complet}</h2>
              <p className="text-xs text-muted-foreground">{souscripteur?.numero_contrat || souscripteur?.id_unique}</p>
            </div>
            <StatusBadge statut={plantation?.statut_global} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {items.map((it, i) => (
              <div key={i} className="bg-muted/40 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <it.icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase">{it.label}</span>
                </div>
                <p className="text-sm font-bold truncate">{it.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
