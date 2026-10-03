import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


/** Nom d'affichage court des utilisateurs CRM.
 * Convention: le premier élément est le nom de famille; le dernier élément est
 * le dernier prénom. Le reste n'est jamais affiché dans les vues compactes.
 */
export function formatUserShortName(fullName?: string | null): string {
  const value = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!value) return "Utilisateur";
  return value.toLocaleUpperCase("fr-FR");
}

/** Affichage détaillé du profil: tous les prénoms, puis le nom de famille. */
export function formatUserProfileName(fullName?: string | null): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Utilisateur";
  if (parts.length === 1) return parts[0].toLocaleUpperCase("fr-FR");
  return `${parts.slice(1).join(" ")} , ${parts[0]}`.replace(" , ", ", ").toLocaleUpperCase("fr-FR");
}
