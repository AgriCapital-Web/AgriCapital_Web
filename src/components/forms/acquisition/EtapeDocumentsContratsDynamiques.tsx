import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const conditionActive = (doc: any, formData: any) => {
  const condition = doc.condition || {};
  if (condition.when === "representant_active") return Boolean(formData.has_representant);
  if (condition.when === "offre_plus") return String(formData.offre_code || "").endsWith("-plus");
  if (condition.when === "necessaire") return Boolean(formData.document_securisation_necessaire);
  if (condition.when === "client_land") return Boolean(formData.offre?.necessite_foncier_client);
  if (condition.when === "acquisition") return Boolean(formData.offre?.contrat_acquisition_requis);
  if (condition.relation === "mandataire") return formData.representant_type === "mandataire";
  return true;
};

export const EtapeDocumentsContratsDynamiques = ({ formData, updateFormData }: Props) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!formData.offre_id) return;
      setLoading(true);
      const [{ data: docs }, { data: ctrs }] = await Promise.all([
        (supabase as any).from("offre_formulaire_documents").select("*").eq("offre_id", formData.offre_id).eq("actif", true).order("ordre"),
        (supabase as any).from("offre_formulaire_contrats").select("*").eq("offre_id", formData.offre_id).eq("actif", true),
      ]);
      if (mounted) {
        setDocuments(docs || []);
        setContracts(ctrs || []);
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [formData.offre_id]);

  const visibleDocuments = useMemo(
    () => documents.filter((doc) => conditionActive(doc, formData)),
    [documents, formData.has_representant, formData.offre_code, formData.document_securisation_necessaire]
  );

  const handleFileChange = (code: string, file: File | null, preview: string) => {
    updateFormData({
      ["doc_" + code + "_file"]: file,
      ["doc_" + code + "_preview"]: preview,
    });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement des pièces requises…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Documents du Client</CardTitle>
          <CardDescription>
            Les pièces affichées sont déterminées par l’offre choisie et les documents contractuels applicables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleDocuments.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune pièce supplémentaire à téléverser à cette étape.</p>
          )}

          {visibleDocuments.map((doc) => {
            const required = Boolean(doc.obligatoire);
            return (
              <div key={doc.code} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{doc.libelle}</p>
                    {doc.source_contractuelle && (
                      <p className="text-xs text-muted-foreground">{doc.source_contractuelle}</p>
                    )}
                  </div>
                  <Badge variant={required ? "default" : "outline"}>
                    {required ? "Obligatoire" : "Conditionnel"}
                  </Badge>
                </div>

                <FileUploadVisual
                  label={required ? "Téléverser le fichier *" : "Téléverser le fichier"}
                  field={doc.code}
                  accept=".pdf,image/jpeg,image/png"
                  required={required}
                  currentFile={formData["doc_" + doc.code + "_file"] || null}
                  currentPreview={formData["doc_" + doc.code + "_preview"] || ""}
                  onFileChange={(field, file, preview) => handleFileChange(doc.code, file, preview)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {contracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contrats applicables</CardTitle>
            <CardDescription>
              Le CRM conserve la terminologie « Client ». Les termes « acquéreur » et « acquisition » restent ceux des documents officiels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {contracts.map((contract) => (
              <div key={contract.id} className="rounded-lg border p-3">
                <p className="font-medium">
                  {contract.type_contrat === "acquisition_client"
                    ? "Contrat d’acquisition de plantation agricole"
                    : "Contrat d’accompagnement agricole"}
                </p>
                <p className="text-xs text-muted-foreground">{contract.source_document}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
