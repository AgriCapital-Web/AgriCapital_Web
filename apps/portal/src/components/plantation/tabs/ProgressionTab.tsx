import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Circle, Loader2 } from "lucide-react";

const ETAPES_BASE = [
  { key: "validation_parcelle", label: "Validation de la parcelle", optional: true },
  { key: "defrichage", label: "Défrichage" },
  { key: "trouaison", label: "Trouaison" },
  { key: "mise_en_terre", label: "Mise en terre" },
  { key: "remplacement", label: "Remplacement des manquants" },
  { key: "entretien", label: "Entretien" },
  { key: "fertilisation", label: "Fertilisation" },
  { key: "mise_production", label: "Mise en production" },
  { key: "remise", label: "Remise au client" },
];

export const ProgressionTab = ({ plantation, souscripteur }: { plantation: any; souscripteur: any }) => {
  const etapesFromDb: any[] = plantation?.etapes || [];
  const isPlus = (souscripteur?.offres?.code || "").endsWith("+");

  const etapes = ETAPES_BASE.map((e) => {
    const aliases = e.key === "mise_en_terre" ? ["mise_en_terre", "planting"] : [e.key];
    const matches = etapesFromDb.filter((x: any) => aliases.includes(x.type) || aliases.includes(x.key));
    const found = matches.find((x: any) => x.statut === "termine") || matches.find((x: any) => x.statut === "en_cours") || matches[0];
    return {
      ...e,
      statut: found?.statut || "pending",
      date: found?.date_realisation,
      commentaire: found?.commentaire,
    };
  });

  const requiredEtapes = etapes.filter((e:any) => !e.optional);
  const completed = requiredEtapes.filter((e) => e.statut === "termine").length;
  const pct = Math.round((completed / requiredEtapes.length) * 100);

  return (
    <div className="space-y-3">
      <Card className="card-brand rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Progression globale</span>
            <span className="text-xl font-bold text-primary">{pct} %</span>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-[11px] text-muted-foreground mt-2">
            {isPlus
              ? "Suivi long terme actif — après remise, le suivi continue jusqu'à 28 ans (Production, Récoltes, Revenus)."
              : "Suivi jusqu'à la remise au client. Vous conserverez ensuite l'accès aux documents, rapports, cartes et médias."}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Étapes techniques</p>
          <ol className="relative border-l-2 border-border/50 ml-2 space-y-4">
            {etapes.map((e, i) => {
              const done = e.statut === "termine";
              const inProgress = e.statut === "en_cours";
              return (
                <li key={e.key} className="ml-4">
                  <span
                    className={`absolute -left-[9px] flex items-center justify-center h-4 w-4 rounded-full ${
                      done ? "bg-primary" : inProgress ? "bg-gold" : "bg-muted"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3 text-white" /> : inProgress ? <Loader2 className="h-2.5 w-2.5 text-white animate-spin" /> : <Circle className="h-2 w-2 text-muted-foreground" />}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {i + 1}. {e.label}
                    </p>
                    {done && (
                      <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">Terminé</Badge>
                    )}
                    {inProgress && (
                      <Badge variant="outline" className="text-[9px] bg-gold/10 text-gold-dark border-gold/30">En cours</Badge>
                    )}
                  </div>
                  {e.date && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(e.date).toLocaleDateString("fr-FR")}</p>}
                  {e.commentaire && <p className="text-[11px] text-muted-foreground italic mt-0.5">{e.commentaire}</p>}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};
