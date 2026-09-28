import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Props { formData: any; updateFormData: (data: any) => void; }

export const EtapeParcelleDynamique = ({ formData, updateFormData }: Props) => {
  const [conventions, setConventions] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const code = String(formData.offre_code || "").toLowerCase();
  const external = code === "palm-invest" || code === "palm-invest-plus";
  const plus = code.endsWith("-plus");

  useEffect(() => {
    updateFormData({ type_client_foncier: external ? "EXT" : "OWN" });
  }, [external]);

  useEffect(() => {
    if (!external) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("conventions_foncieres")
        .select("id,reference,code_sp,code_dom,code_parc,statut,surface_totale_ha,proprietaire:proprietaires_terres(id,nom_complet)")
        .eq("statut","active")
        .order("date_signature",{ascending:false});
      setConventions(data || []);
    })();
  }, [external]);

  useEffect(() => {
    if (!formData.convention_id) { setLots([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("lots_hectares")
        .select("id,reference,numero_h,surface_ha,statut,certifie_geometre")
        .eq("convention_id",formData.convention_id)
        .eq("statut","disponible")
        .order("numero_h");
      setLots(data || []);
    })();
  }, [formData.convention_id]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{external ? "Parcelle affectée au Client" : "Parcelle du Client"}</CardTitle>
          <CardDescription>
            {external
              ? "Le foncier est mis à disposition dans le cadre de la formule sélectionnée."
              : "La parcelle reste sous la responsabilité du Client, conformément au contrat applicable."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Superficie (ha) *</Label><Input type="number" min="1" step="0.1" value={formData.superficie_prevue || ""} onChange={(e) => updateFormData({superficie_prevue:e.target.value, surface_propre_ha:e.target.value})} /></div>
            <div><Label>Référence de parcelle</Label><Input value={formData.reference_cadastrale || ""} onChange={(e) => updateFormData({reference_cadastrale:e.target.value})} placeholder="Référence si connue" /></div>
            <div><Label>Région</Label><Input value={formData.parcelle_region || ""} onChange={(e) => updateFormData({parcelle_region:e.target.value})} /></div>
            <div><Label>Département</Label><Input value={formData.parcelle_departement || ""} onChange={(e) => updateFormData({parcelle_departement:e.target.value})} /></div>
            <div><Label>Sous-préfecture</Label><Input value={formData.parcelle_sous_prefecture || ""} onChange={(e) => updateFormData({parcelle_sous_prefecture:e.target.value})} /></div>
            <div><Label>Village / localité *</Label><Input value={formData.village_propre || ""} onChange={(e) => updateFormData({village_propre:e.target.value})} /></div>
            <div><Label>Latitude GPS</Label><Input type="number" step="any" value={formData.parcelle_latitude || ""} onChange={(e) => updateFormData({parcelle_latitude:e.target.value})} /></div>
            <div><Label>Longitude GPS</Label><Input type="number" step="any" value={formData.parcelle_longitude || ""} onChange={(e) => updateFormData({parcelle_longitude:e.target.value})} /></div>
          </div>

          {external && <div className="space-y-4 rounded-xl border p-4">
            <div><Label>Convention foncière active *</Label><Select value={formData.convention_id || ""} onValueChange={(v) => updateFormData({convention_id:v,lot_id:null})}><SelectTrigger><SelectValue placeholder="Sélectionner une convention" /></SelectTrigger><SelectContent>{conventions.map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.proprietaire?.nom_complet || "Propriétaire non renseigné"}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Lot disponible *</Label><Select value={formData.lot_id || ""} onValueChange={(v) => updateFormData({lot_id:v})} disabled={!formData.convention_id}><SelectTrigger><SelectValue placeholder="Sélectionner un lot" /></SelectTrigger><SelectContent>{lots.map(l => <SelectItem key={l.id} value={l.id}>H{String(l.numero_h).padStart(2,"0")} — {l.surface_ha} ha {l.certifie_geometre ? "· certifié" : ""}</SelectItem>)}</SelectContent></Select></div>
            {formData.lot_id && (
              <>
                <Badge variant="outline">Lot sélectionné : {lots.find(l => l.id === formData.lot_id)?.reference || formData.lot_id}</Badge>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Activation Planté-Partagé</p>
                  <p className="text-muted-foreground mt-1">
                    Pour un lot client de {lots.find(l => l.id === formData.lot_id)?.surface_ha || formData.superficie_prevue || 1} ha, AgriCapital active la plantation correspondante avec une quote-part équivalente pour le propriétaire foncier.
                  </p>
                  <p className="mt-1 font-medium">Exemple : 1 ha client = 2 ha de plantation activée (1 ha bénéficiaire + 1 ha propriétaire).</p>
                </div>
              </>
            )}
          </div>}

          {!external && <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Statut foncier</Label><Select value={formData.statut_foncier || ""} onValueChange={(v) => updateFormData({statut_foncier:v})}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="coutumier">Coutumier</SelectItem><SelectItem value="certificat">Certificat foncier</SelectItem><SelectItem value="titre">Titre foncier</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
            <div><Label>Propriétaire foncier</Label><Input value={formData.proprietaire_foncier_nom || ""} onChange={(e) => updateFormData({proprietaire_foncier_nom:e.target.value})} /></div>
          </div>}

          {plus && <p className="text-xs text-muted-foreground">La formule « + » conserve ici les informations foncières nécessaires au dossier ; les modalités de gestion sont déterminées par le contrat applicable.</p>}
        </CardContent>
      </Card>
    </div>
  );
};
