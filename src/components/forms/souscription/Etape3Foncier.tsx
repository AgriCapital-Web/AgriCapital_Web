import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

/**
 * Identification de la plantation — Contrat V1, article 4.
 * - type_souscripteur_foncier : EXT (souscripteur externe — terre AgriCapital) | OWN (propriétaire foncier)
 * - Sélection de la convention PP active et d'un lot Hxx disponible.
 * - La référence finale du contrat est construite côté DB (AGC-SUB-YYYY-SPxxx-NNNN).
 */
interface Props {
  formData: any;
  updateFormData: (data: any) => void;
}

export const Etape3Foncier = ({ formData, updateFormData }: Props) => {
  const [conventions, setConventions] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const typeFoncier: "EXT" | "OWN" =
    formData.type_souscripteur_foncier ||
    (formData.type_souscripteur === "avec_terre" ? "OWN" : "EXT");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("conventions_foncieres")
        .select("id, reference, code_sp, code_dom, code_parc, statut, surface_totale_ha, date_signature")
        .eq("statut", "active")
        .order("date_signature", { ascending: false })
        .limit(100);
      setConventions(data || []);
      setLoading(false);
    };
    if (typeFoncier === "EXT") load();
  }, [typeFoncier]);

  useEffect(() => {
    const load = async () => {
      if (!formData.convention_id) {
        setLots([]);
        return;
      }
      const { data } = await (supabase as any)
        .from("lots_hectares")
        .select("id, reference, numero_h, surface_ha, statut, certifie_geometre")
        .eq("convention_id", formData.convention_id)
        .eq("statut", "disponible")
        .order("numero_h");
      setLots(data || []);
    };
    load();
  }, [formData.convention_id]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identification foncière — Contrat V1</CardTitle>
          <CardDescription>
            Le client est-il externe (terre fournie par AgriCapital) ou propriétaire de la terre ?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateFormData({ type_souscripteur_foncier: "EXT", proprietaire_id: null })}
              className={`p-4 rounded-lg border-2 text-left transition ${
                typeFoncier === "EXT" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold">EXT — Client externe</div>
              <p className="text-xs text-muted-foreground mt-1">
                AgriCapital fournit la terre via une convention Planter-Partager. Sélection d'un lot Hxx.
              </p>
            </button>
            <button
              type="button"
              onClick={() => updateFormData({ type_souscripteur_foncier: "OWN", convention_id: null, lot_id: null })}
              className={`p-4 rounded-lg border-2 text-left transition ${
                typeFoncier === "OWN" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold">OWN — Propriétaire foncier</div>
              <p className="text-xs text-muted-foreground mt-1">
                Le client apporte sa propre terre, enregistrée comme parcelle client.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {typeFoncier === "EXT" && (
        <Card>
          <CardHeader>
            <CardTitle>Convention Planter-Partager & Lot Hxx</CardTitle>
            <CardDescription>
              Référence : AC-PP-SPxxx-DOMxxx-PARCxxx-Hxx
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Convention foncière active *</Label>
              <Select
                value={formData.convention_id || ""}
                onValueChange={(v) => updateFormData({ convention_id: v, lot_id: null })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Chargement..." : "Sélectionner une convention"} />
                </SelectTrigger>
                <SelectContent>
                  {conventions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.reference} — {c.surface_totale_ha} ha
                    </SelectItem>
                  ))}
                  {conventions.length === 0 && !loading && (
                    <div className="p-2 text-sm text-muted-foreground text-center">Aucune convention active</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Lot Hxx disponible *</Label>
              <Select
                value={formData.lot_id || ""}
                onValueChange={(v) => updateFormData({ lot_id: v })}
                disabled={!formData.convention_id || lots.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.convention_id ? "Sélectionner d'abord une convention" : "Sélectionner un lot"} />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      H{String(l.numero_h).padStart(2, "0")} — {l.surface_ha} ha {l.certifie_geometre ? "✓ certifié" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.lot_id && (
                <Badge variant="outline" className="mt-2">
                  Référence : {lots.find((l) => l.id === formData.lot_id)?.reference}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {typeFoncier === "OWN" && (
        <Card>
          <CardHeader>
            <CardTitle>Identification du propriétaire foncier</CardTitle>
            <CardDescription>
              Le client est lui-même propriétaire — saisie minimale du foncier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Référence cadastrale (si connue)</Label>
                <Input
                  value={formData.reference_cadastrale || ""}
                  onChange={(e) => updateFormData({ reference_cadastrale: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Statut foncier</Label>
                <Select
                  value={formData.statut_foncier || "coutumier"}
                  onValueChange={(v) => updateFormData({ statut_foncier: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coutumier">Coutumier</SelectItem>
                    <SelectItem value="certificat">Certificat foncier</SelectItem>
                    <SelectItem value="titre">Titre foncier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Surface (ha)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.surface_propre_ha || ""}
                  onChange={(e) => updateFormData({ surface_propre_ha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Village / Localité</Label>
                <Input
                  value={formData.village_propre || ""}
                  onChange={(e) => updateFormData({ village_propre: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
