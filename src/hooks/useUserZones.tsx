import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ZoneAssignment {
  zone_type: string;
  zone_id: string;
}

/**
 * Hook to get the current user's assigned zones and filter geographic data accordingly.
 * - Responsable de zone: une région
 * - Chef d'équipe: assigned départements → sees sous-préfectures of those départements
 * - Commercial: assigned sous-préfectures
 * - Admin/DTC: sees everything
 */
export function useUserZones() {
  const { user, userRoles } = useAuth();
  const [assignments, setAssignments] = useState<ZoneAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = userRoles.some(r => ["super_admin", "directeur_tc"].includes(r));

  useEffect(() => {
    if (!user?.id || isAdmin) {
      setLoading(false);
      return;
    }
    fetchAssignments();
  }, [user?.id, isAdmin]);

  const fetchAssignments = async () => {
    try {
      const { data } = await (supabase as any)
        .from("zone_assignments")
        .select("zone_type, zone_id")
        .eq("user_id", user!.id);
      setAssignments(data || []);
    } catch (e) {
      console.error("Failed to fetch zone assignments:", e);
    } finally {
      setLoading(false);
    }
  };

  const getDistrictIds = (): string[] => {
    if (isAdmin) return [];
    return assignments.filter(a => a.zone_type === "district").map(a => a.zone_id);
  };
  const getRegionIds = (): string[] => isAdmin ? [] : assignments.filter(a => a.zone_type === "region").map(a => a.zone_id);

  const getDepartementIds = (): string[] => {
    if (isAdmin) return [];
    return assignments.filter(a => a.zone_type === "departement").map(a => a.zone_id);
  };

  const getSousPrefectureIds = (): string[] => {
    if (isAdmin) return [];
    return assignments.filter(a => a.zone_type === "sous_prefecture").map(a => a.zone_id);
  };

  /**
   * Fetch districts filtered by user's zone assignments
   */
  const fetchFilteredDistricts = async () => {
    if (isAdmin) {
      const { data } = await (supabase as any).from("districts").select("*").eq("est_actif", true).order("nom");
      return data || [];
    }
    const ids = getDistrictIds();
    if (ids.length > 0) {
      const { data } = await (supabase as any).from("districts").select("*").in("id", ids).eq("est_actif", true).order("nom");
      return data || [];
    }
    // Chef d'equipe/commercial: derive districts from their assigned zones
    const deptIds = getDepartementIds();
    const spIds = getSousPrefectureIds();
    if (deptIds.length > 0) {
      const { data: depts } = await (supabase as any).from("v_geo_departements").select("region_id").in("id", deptIds).eq("est_actif_effectif", true);
      const regionIds = [...new Set((depts || []).map((d: any) => d.region_id).filter(Boolean))];
      if (regionIds.length > 0) {
        const { data: regs } = await (supabase as any).from("v_geo_regions").select("district_id").in("id", regionIds).eq("est_active_effectif", true);
        const distIds = [...new Set((regs || []).map((r: any) => r.district_id).filter(Boolean))];
        if (distIds.length > 0) {
          const { data } = await (supabase as any).from("districts").select("*").in("id", distIds).eq("est_actif", true).order("nom");
          return data || [];
        }
      }
    }
    if (spIds.length > 0) {
      const { data: sps } = await (supabase as any).from("v_geo_sous_prefectures").select("departement_id").in("id", spIds).eq("est_active_effectif", true);
      const dIds = [...new Set((sps || []).map((s: any) => s.departement_id).filter(Boolean))];
      if (dIds.length > 0) {
        const { data: depts } = await (supabase as any).from("departements").select("region_id").in("id", dIds);
        const rIds = [...new Set((depts || []).map((d: any) => d.region_id).filter(Boolean))];
        const { data: regs } = await (supabase as any).from("regions").select("district_id").in("id", rIds);
        const distIds = [...new Set((regs || []).map((r: any) => r.district_id).filter(Boolean))];
        if (distIds.length > 0) {
          const { data } = await (supabase as any).from("districts").select("*").in("id", distIds).eq("est_actif", true).order("nom");
          return data || [];
        }
      }
    }
    // Un utilisateur terrain sans affectation ne doit pas voir toutes les zones.
    // Les comptes globaux sont traités par isAdmin ; les autres restent sans zone
    // jusqu'à leur affectation explicite.
    return [];
  };

  const fetchFilteredRegions = async (districtId: string) => {
    let query = (supabase as any).from("v_geo_regions").select("*").eq("district_id", districtId).eq("est_active_effectif", true).order("nom");
    const regionIds = getRegionIds();
    if (!isAdmin && regionIds.length > 0) query = query.in("id", regionIds);
    const { data } = await query;
    return data || [];
  };

  const fetchFilteredDepartements = async (regionId: string) => {
    if (isAdmin || getDistrictIds().length > 0 || getRegionIds().length > 0) {
      const { data } = await (supabase as any).from("v_geo_departements").select("*").eq("region_id", regionId).eq("est_actif_effectif", true).order("nom");
      return data || [];
    }
    const deptIds = getDepartementIds();
    if (deptIds.length > 0) {
      const { data } = await (supabase as any).from("departements").select("*").eq("region_id", regionId).in("id", deptIds).eq("est_actif", true).order("nom");
      return data || [];
    }
    // Commercial: derive from sous-prefectures
    const spIds = getSousPrefectureIds();
    if (spIds.length > 0) {
      const { data: sps } = await (supabase as any).from("v_geo_sous_prefectures").select("departement_id").in("id", spIds).eq("est_active_effectif", true);
      const dIds = [...new Set((sps || []).map((s: any) => s.departement_id).filter(Boolean))];
      const { data } = await (supabase as any).from("departements").select("*").eq("region_id", regionId).in("id", dIds).eq("est_actif", true).order("nom");
      return data || [];
    }
    const { data } = await (supabase as any).from("departements").select("*").eq("region_id", regionId).eq("est_actif", true).order("nom");
    return data || [];
  };

  const fetchFilteredSousPrefectures = async (departementId: string) => {
    if (isAdmin || getDistrictIds().length > 0 || getDepartementIds().length > 0) {
      const { data } = await (supabase as any).from("v_geo_sous_prefectures").select("*").eq("departement_id", departementId).eq("est_active_effectif", true).order("nom");
      return data || [];
    }
    const spIds = getSousPrefectureIds();
    if (spIds.length > 0) {
      const { data } = await (supabase as any).from("sous_prefectures").select("*").eq("departement_id", departementId).in("id", spIds).eq("est_active", true).order("nom");
      return data || [];
    }
    const { data } = await (supabase as any).from("sous_prefectures").select("*").eq("departement_id", departementId).eq("est_active", true).order("nom");
    return data || [];
  };

  return {
    assignments,
    loading,
    isAdmin,
    fetchFilteredDistricts,
    fetchFilteredRegions,
    fetchFilteredDepartements,
    fetchFilteredSousPrefectures,
  };
}
