import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface HistoriqueRecentProps {
  souscripteurId: string;
}

const HistoriqueRecent = ({ souscripteurId }: HistoriqueRecentProps) => {
  const [historique, setHistorique] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistoriqueRecent();
  }, [souscripteurId]);

  const fetchHistoriqueRecent = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("historique_actions")
        .select(`
          *,
          user:profiles!historique_actions_user_id_fkey(nom_complet)
        `)
        .eq("souscripteur_id", souscripteurId)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;
      setHistorique(data || []);
    } catch (error) {
      console.error("Erreur chargement historique:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>Historique Récent</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/planteur/${souscripteurId}/historique`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Voir l'historique complet
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : historique.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune action enregistrée</p>
        ) : (
          <div className="space-y-4">
            {historique.map((action) => (
              <div key={action.id} className="flex gap-4 border-b pb-3 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{action.type_action}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(action.created_at), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                  {action.user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Par: {action.user.nom_complet}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoriqueRecent;
