import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../EmptyState";
import { FileText, Download } from "lucide-react";

export const DocumentsTab = ({ plantation, souscripteur }: { plantation: any; souscripteur: any }) => {
  const docs: any[] = [
    ...(souscripteur?.documents || []),
    ...(plantation?.documents || []),
  ];
  if (docs.length === 0) {
    return <EmptyState icon={FileText} title="Aucun document disponible" description="Votre contrat, les annexes, plans topographiques et plans de plantation apparaîtront ici dès leur mise en ligne." />;
  }
  return (
    <div className="space-y-2">
      {docs.map((d, i) => (
        <Card key={i} className="rounded-xl">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{d.nom || d.type_document || "Document"}</p>
              <p className="text-[10px] text-muted-foreground">{d.categorie || d.type || ""}</p>
            </div>
            {d.url && (
              <Button asChild size="sm" variant="outline" className="h-8">
                <a href={d.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
