import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "../EmptyState";
import { FileBarChart2, Camera } from "lucide-react";

export const RapportsTab = ({ plantation }: { plantation: any }) => {
  const rapports: any[] = plantation?.rapports_visites || plantation?.rapports || [];
  if (rapports.length === 0) {
    return <EmptyState icon={FileBarChart2} title="Aucun rapport publié pour l'instant" description="Les rapports terrain validés par AgriCapital apparaîtront ici." />;
  }

  return (
    <div className="space-y-3">
      {rapports.map((r, i) => (
        <Card key={r.id || i} className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                <FileBarChart2 className="h-5 w-5 text-gold-dark" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.titre || "Rapport terrain"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px]">Validé</Badge>
                  {r.date_visite && <span className="text-[10px] text-muted-foreground">{new Date(r.date_visite).toLocaleDateString("fr-FR")}</span>}
                </div>
              </div>
            </div>

            {r.etat_plantation && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] uppercase text-muted-foreground mb-1">État de la plantation</p>
                <p className="text-sm font-medium">{r.etat_plantation}</p>
              </div>
            )}

            {r.contenu && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Message de l'équipe technique</p>
                <p className="text-sm leading-relaxed">{r.contenu}</p>
              </div>
            )}

            {r.medias?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {r.medias.map((m:any) => (
                  <div key={m.id} className="rounded-lg border overflow-hidden">
                    {m.url && m.media_type === "photo" ? (
                      <img src={m.url} alt={m.description || "Photo terrain"} className="w-full aspect-video object-cover" />
                    ) : m.url && m.media_type === "video" ? (
                      <video src={m.url} controls className="w-full aspect-video object-cover" />
                    ) : (
                      <div className="p-3 flex items-center gap-2"><Camera className="h-4 w-4 text-primary shrink-0" /><span className="text-xs truncate">{m.description || m.nom_fichier || "Média terrain"}</span></div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {r.prochaine_intervention && (
              <p className="text-xs text-muted-foreground">Prochaine intervention prévue : {new Date(r.prochaine_intervention).toLocaleDateString("fr-FR")}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
