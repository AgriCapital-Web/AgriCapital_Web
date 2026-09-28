import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OFFICIAL_ROLES, RoleDefinition } from "@/lib/roles";

export interface DepartementEntreprise {
  id: string;
  code: string;
  nom: string;
  requiert_couverture: boolean;
  actif: boolean;
}

/** Départements de l'entreprise (source unique, repli statique avant migration) */
export const DEFAULT_DEPARTEMENTS: DepartementEntreprise[] = [
  { id: "direction_generale", code: "direction_generale", nom: "Direction Générale", requiert_couverture: false, actif: true },
  { id: "commercial", code: "commercial", nom: "Commercial", requiert_couverture: true, actif: true },
  { id: "technique", code: "technique", nom: "Technique", requiert_couverture: true, actif: true },
  { id: "finance_comptabilite", code: "finance_comptabilite", nom: "Finance & Comptabilité", requiert_couverture: false, actif: true },
  { id: "operations", code: "operations", nom: "Opérations", requiert_couverture: false, actif: true },
  { id: "service_client", code: "service_client", nom: "Service Client", requiert_couverture: false, actif: true },
  { id: "ressources_humaines", code: "ressources_humaines", nom: "Ressources Humaines", requiert_couverture: false, actif: true },
];

export function useDepartementsEntreprise() {
  const [departements, setDepartements] = useState<DepartementEntreprise[]>(DEFAULT_DEPARTEMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("departements_entreprise")
          .select("*")
          .eq("actif", true)
          .order("ordre", { ascending: true });
        if (data && data.length > 0) setDepartements(data as DepartementEntreprise[]);
      } catch {
        /* repli statique */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requiresCoverage = (nomOuCode?: string | null) => {
    if (!nomOuCode) return false;
    const d = departements.find((x) => x.nom === nomOuCode || x.code === nomOuCode);
    return !!d?.requiert_couverture;
  };

  return { departements, loading, requiresCoverage };
}

/** Rôles officiels : base de données si disponible, sinon catalogue statique */
export function useAppRoles() {
  const [roles, setRoles] = useState<RoleDefinition[]>(OFFICIAL_ROLES);
  const [loading, setLoading] = useState(true);
  const [fromDatabase, setFromDatabase] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("app_roles")
        .select("*")
        .eq("actif", true)
        .order("niveau", { ascending: true });
      if (data && data.length > 0) {
        setRoles(
          (data as any[]).map((r) => ({
            code: r.code,
            nom: r.nom,
            court: r.court || r.nom,
            description: r.description || "",
            niveau: r.niveau ?? 5,
            niveauLabel: r.niveau_label || "",
            couleur: OFFICIAL_ROLES.find((o) => o.code === r.code)?.couleur || "bg-muted text-muted-foreground",
          })),
        );
        setFromDatabase(true);
      }
    } catch {
      /* repli statique */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { roles, loading, fromDatabase, reload: load };
}

/** Référentiel géographique hiérarchique : District > Région > Département > S/Préfecture > Village */
export function useGeoHierarchy(initial?: {
  districtId?: string | null;
  regionId?: string | null;
  departementId?: string | null;
  sousPrefectureId?: string | null;
}) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("districts").select("id, nom").eq("est_actif", true).order("nom");
      setDistricts(data || []);
    })();
  }, []);

  const loadRegions = async (districtId?: string | null) => {
    if (!districtId) return setRegions([]);
    const { data } = await (supabase as any)
      .from("v_geo_regions").select("id, nom").eq("district_id", districtId).eq("est_active_effectif", true).order("nom");
    setRegions(data || []);
  };

  const loadDepartements = async (regionId?: string | null) => {
    if (!regionId) return setDepartements([]);
    const { data } = await (supabase as any)
      .from("v_geo_departements").select("id, nom").eq("region_id", regionId).eq("est_actif_effectif", true).order("nom");
    setDepartements(data || []);
  };

  const loadSousPrefectures = async (departementId?: string | null) => {
    if (!departementId) return setSousPrefectures([]);
    const { data } = await (supabase as any)
      .from("v_geo_sous_prefectures").select("id, nom").eq("departement_id", departementId).eq("est_active_effectif", true).order("nom");
    setSousPrefectures(data || []);
  };

  const loadVillages = async (sousPrefectureId?: string | null) => {
    if (!sousPrefectureId) return setVillages([]);
    const { data } = await (supabase as any)
      .from("v_geo_villages").select("id, nom").eq("sous_prefecture_id", sousPrefectureId).eq("est_actif_effectif", true).order("nom");
    setVillages(data || []);
  };

  useEffect(() => {
    if (initial?.districtId) loadRegions(initial.districtId);
    if (initial?.regionId) loadDepartements(initial.regionId);
    if (initial?.departementId) loadSousPrefectures(initial.departementId);
    if (initial?.sousPrefectureId) loadVillages(initial.sousPrefectureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.districtId, initial?.regionId, initial?.departementId, initial?.sousPrefectureId]);

  return {
    districts, regions, departements, sousPrefectures, villages,
    loadRegions, loadDepartements, loadSousPrefectures, loadVillages,
  };
}

/** Toutes les régions (liste plate) — utilisée par les formulaires sans district préalable */
export function useAllRegions() {
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("v_geo_regions").select("id, nom, district_id").eq("est_active_effectif", true).order("nom");
      setRegions(data || []);
      setLoading(false);
    })();
  }, []);

  return { regions, loading };
}
