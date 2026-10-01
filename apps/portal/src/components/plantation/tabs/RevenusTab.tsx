import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../EmptyState";
import { PieChart } from "lucide-react";
import { formatCFA } from "@/utils/pricing";

export const RevenusTab = ({ plantation }: { plantation: any }) => {
  const rev = plantation?.revenus || {};
  const total = rev.total_genere || 0;
  const client = total * 0.7;
  const agri = total * 0.3;
  if (!total) {
    return <EmptyState icon={PieChart} title="Aucun revenu enregistré" description="La répartition 70% client / 30% AgriCapital et l'historique des versements s'afficheront ici après la première récolte." />;
  }
  return (
    <div className="space-y-3">
      <Card className="card-brand-gold rounded-2xl">
        <CardContent className="p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenus générés</p>
          <p className="text-2xl font-black text-gold-dark">{formatCFA(total)}</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Card className="card-brand rounded-2xl">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase text-white/70">Part client (70%)</p>
            <p className="text-lg font-bold text-white">{formatCFA(client)}</p>
          </CardContent>
        </Card>
        <Card className="card-brand-subtle rounded-2xl">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Part AgriCapital (30%)</p>
            <p className="text-lg font-bold">{formatCFA(agri)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
