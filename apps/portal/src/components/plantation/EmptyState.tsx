import { LucideIcon, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}

export const EmptyState = ({
  icon: Icon = Info,
  title = "En attente de mise à jour",
  description = "Votre équipe technique AgriCapital publiera ces informations depuis le CRM dès qu'elles seront disponibles.",
}: EmptyStateProps) => (
  <Card className="border-dashed border-2 border-border/60 bg-muted/30 rounded-2xl">
    <CardContent className="py-10 flex flex-col items-center text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <p className="font-semibold text-sm mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
    </CardContent>
  </Card>
);
