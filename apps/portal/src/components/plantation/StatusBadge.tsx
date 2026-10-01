import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  preparation: { label: "En préparation", className: "bg-slate-100 text-slate-700 border-slate-200" },
  amenagement: { label: "En cours d'aménagement", className: "bg-amber-100 text-amber-700 border-amber-200" },
  en_attente_da: { label: "En attente Dépôt Initial", className: "bg-amber-100 text-amber-700 border-amber-200" },
  plantation: { label: "En plantation", className: "bg-lime-100 text-lime-700 border-lime-200" },
  croissance: { label: "En croissance", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  active: { label: "En croissance", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  production: { label: "En production", className: "bg-green-600 text-white border-green-700" },
  remise: { label: "Remise au client", className: "bg-gold/20 text-gold-dark border-gold/30" },
};

export const StatusBadge = ({ statut }: { statut?: string | null }) => {
  const key = (statut || "preparation").toLowerCase();
  const info = STATUS_MAP[key] || STATUS_MAP.preparation;
  return <Badge variant="outline" className={`text-[10px] font-semibold ${info.className}`}>{info.label}</Badge>;
};
