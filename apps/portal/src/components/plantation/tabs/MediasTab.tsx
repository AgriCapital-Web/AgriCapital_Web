import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../EmptyState";
import { Camera, Play } from "lucide-react";

export const MediasTab = ({ plantation }: { plantation: any }) => {
  const medias: any[] = plantation?.medias || [];
  if (medias.length === 0) {
    return <EmptyState icon={Camera} title="Aucune photo ni vidéo pour l'instant" description="Vos techniciens terrain publieront ici les photos et vidéos de chaque opération (défrichage, planting, entretien...)." />;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {medias.map((m, i) => (
        <Card key={i} className="overflow-hidden rounded-xl group cursor-pointer">
          <CardContent className="p-0 relative aspect-square bg-muted">
            {m.type === "video" ? (
              <div className="w-full h-full flex items-center justify-center bg-black/60">
                <Play className="h-8 w-8 text-white" />
              </div>
            ) : (
              <img src={m.url} alt={m.commentaire || "media"} className="w-full h-full object-cover group-hover:scale-105 transition" />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
              <p className="text-[9px] text-white truncate">{m.operation || m.commentaire || ""}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
