import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, ROLES } from "@/lib/roles";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * Charge la matrice rôle → permissions depuis la base (`role_permissions`).
 * Tant que la migration SQL n'est pas exécutée, la matrice par défaut sert de repli
 * afin que l'interface reste fonctionnelle et cohérente.
 */
export function useRolePermissionMatrix() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [fromDatabase, setFromDatabase] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("role_permissions")
        .select("role_code, permission_code");
      if (error || !data || data.length === 0) {
        setMatrix(DEFAULT_ROLE_PERMISSIONS);
        setFromDatabase(false);
      } else {
        const next: Record<string, string[]> = {};
        for (const row of data as any[]) {
          (next[row.role_code] ||= []).push(row.permission_code);
        }
        setMatrix(next);
        setFromDatabase(true);
      }
    } catch {
      setMatrix(DEFAULT_ROLE_PERMISSIONS);
      setFromDatabase(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { matrix, loading, fromDatabase, reload: load };
}

/** Permissions effectives de l'utilisateur connecté */
export function usePermissions() {
  const { userRoles } = useAuth();
  const { matrix, loading, fromDatabase, reload } = useRolePermissionMatrix();

  const roles = useMemo(() => normalizeRoles(userRoles || []), [userRoles]);
  const isSuperAdmin = roles.includes(ROLES.SUPER_ADMIN);
  const isPdg = roles.includes(ROLES.PDG);
  const isDg = roles.includes(ROLES.DG);

  const granted = useMemo(() => {
    const set = new Set<string>();
    roles.forEach((role) => (matrix[role] || []).forEach((p) => set.add(p)));
    return set;
  }, [roles, matrix]);

  const can = (permission: string) => isSuperAdmin || isPdg || isDg || granted.has(permission);
  const canAny = (...permissions: string[]) => permissions.some(can);
  const canAll = (...permissions: string[]) => permissions.every(can);

  return { can, canAny, canAll, roles, isSuperAdmin, isPdg, isDg, permissions: granted, loading, fromDatabase, reload };
}
