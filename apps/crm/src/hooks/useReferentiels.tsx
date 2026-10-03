import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleDefinition } from "@/lib/roles";

export interface DepartementEntreprise {
  id: string;
  code: string;
  nom: string;
  requiert_couverture: boolean;
  actif: boolean;
}

/** Départements de l'entreprise — source unique en base de données. */
export function useDepartementsEntreprise() {
  const [departements, setDepartements] = useState<DepartementEntreprise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("departements_entreprise")
          .select("*")
          .eq("actif", true)
          .order("ordre", { ascending: true });
        setDepartements((data || []) as DepartementEntreprise[]);
      } catch {
        setDepartements([]);
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

/** Rôles officiels — source unique en base de données. */
export function useAppRoles() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
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
      setRoles(
        (data || []).map((r: any) => ({
            code: r.code,
            nom: r.nom,
            court: r.court || r.nom,
            description: r.description || "",
            niveau: r.niveau ?? 5,
            niveauLabel: r.niveau_label || "",
            couleur: r.couleur || "",
        })),
      );
      setFromDatabase(true);
    } catch {
      setRoles([]);
      setFromDatabase(false);
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
      const { data } = await (supabase as any).from("v_geo_districts").select("id, nom").eq("est_actif_effectif", true).order("nom");
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
