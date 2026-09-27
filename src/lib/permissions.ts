/**
 * SOURCE DE VÉRITÉ UNIQUE — Catalogue des permissions par module.
 * Ces codes correspondent 1:1 à la table `app_permissions` (voir plan.md).
 */

import { ROLES, OFFICIAL_ROLE_CODES } from "@/lib/roles";

export interface PermissionDef {
  code: string;
  module: string;
  action: string;
  libelle: string;
}

const build = (module: string, moduleLabel: string, actions: [string, string][]): PermissionDef[] =>
  actions.map(([action, libelle]) => ({
    code: `${module}.${action}`,
    module: moduleLabel,
    action,
    libelle,
  }));

const CRUD: [string, string][] = [
  ["view", "Consulter"],
  ["create", "Créer"],
  ["update", "Modifier"],
  ["archive", "Archiver"],
  ["delete", "Supprimer"],
  ["restore", "Réactiver"],
];

export const PERMISSION_CATALOG: PermissionDef[] = [
  ...build("utilisateurs", "Utilisateurs", [
    ...CRUD,
    ["reset_password", "Réinitialiser le mot de passe"],
    ["manage_roles", "Modifier les rôles d'un utilisateur"],
  ]),
  ...build("roles", "Rôles", [...CRUD, ["manage_permissions", "Gérer les permissions"]]),
  ...build("offres", "Offres", [
    ...CRUD,
    ["manage_prices", "Gérer les prix et le dépôt initial"],
    ["manage_promotions", "Gérer les promotions"],
  ]),
  ...build("promotions", "Promotions", [
    ...CRUD,
    ["activate", "Activer / désactiver"],
    ["view_history", "Consulter l'historique"],
  ]),
  ...build("leads", "Leads", [
    ["view", "Consulter"],
    ["create", "Créer"],
    ["update", "Modifier"],
    ["assign", "Affecter"],
    ["archive", "Archiver"],
    ["delete", "Supprimer"],
  ]),
  ...build("clients", "Clients / Souscripteurs", [
    ["view", "Consulter"],
    ["create", "Créer"],
    ["update", "Modifier"],
    ["archive", "Archiver"],
  ]),
  ...build("plantations", "Plantations", [
    ["view", "Consulter"],
    ["create", "Créer"],
    ["update", "Modifier"],
    ["archive", "Archiver"],
  ]),
  ...build("paiements", "Paiements", [
    ["view", "Consulter"],
    ["record", "Enregistrer"],
    ["execute", "Effectuer"],
    ["update", "Modifier"],
    ["cancel", "Annuler"],
    ["validate", "Valider"],
  ]),
  ...build("documents", "Documents", [
    ["view", "Consulter"],
    ["upload", "Téléverser"],
    ["validate", "Valider"],
  ]),
  ...build("rapports", "Rapports", [
    ["view_technique", "Voir les rapports techniques"],
    ["view_financier", "Voir les rapports financiers"],
    ["export", "Exporter les données"],
  ]),
  ...build("commissions", "Commissions", [
    ["view", "Consulter"],
    ["validate", "Valider"],
  ]),
  ...build("tickets", "Support", [
    ["view", "Consulter"],
    ["create", "Créer"],
    ["update", "Traiter"],
  ]),
  ...build("parametres", "Paramètres", [
    ["view", "Accéder aux paramètres"],
    ["manage_geo", "Gérer le référentiel géographique"],
    ["manage_teams", "Gérer les équipes"],
    ["manage_system", "Gérer la configuration système"],
    ["view_audit", "Consulter les journaux d'audit"],
  ]),
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((p) => p.code);

export const PERMISSIONS_BY_MODULE = PERMISSION_CATALOG.reduce<Record<string, PermissionDef[]>>((acc, p) => {
  (acc[p.module] ||= []).push(p);
  return acc;
}, {});

const all = () => [...PERMISSION_CODES];
const only = (...prefixes: string[]) =>
  PERMISSION_CODES.filter((c) => prefixes.some((p) => (p.endsWith(".") ? c.startsWith(p) : c === p)));

/**
 * Matrice par défaut rôle → permissions.
 * Sert de valeur de repli tant que `role_permissions` n'est pas alimentée,
 * et de jeu de données initial pour la migration SQL.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: all(),
  [ROLES.RESPONSABLE_OPERATIONS]: only(
    "utilisateurs.", "offres.", "promotions.", "leads.", "clients.", "plantations.",
    "documents.", "rapports.", "tickets.", "commissions.view",
    "paiements.view", "paiements.record", "paiements.validate",
    "parametres.view", "parametres.manage_geo", "parametres.manage_teams", "parametres.view_audit",
  ).filter((c) => !["utilisateurs.delete", "utilisateurs.manage_roles"].includes(c)),
  [ROLES.DIRECTEUR_TC]: only(
    "leads.", "clients.", "plantations.", "offres.view", "promotions.view",
    "paiements.view", "commissions.", "rapports.", "documents.", "tickets.",
    "utilisateurs.view", "roles.view", "parametres.view", "parametres.manage_teams",
  ),
  [ROLES.RESPONSABLE_COMMERCIAL]: only(
    "leads.", "clients.view", "clients.create", "clients.update",
    "plantations.view", "offres.view", "promotions.view",
    "paiements.view", "commissions.view", "rapports.view_financier", "rapports.export",
    "documents.view", "tickets.view", "utilisateurs.view", "parametres.manage_teams",
  ),
  [ROLES.COMPTABLE]: only(
    "paiements.", "commissions.", "rapports.view_financier", "rapports.export",
    "clients.view", "offres.view", "promotions.view", "documents.view", "documents.validate",
  ),
  [ROLES.CHEF_EQUIPE_COMMERCIAL]: only(
    "leads.view", "leads.create", "leads.update", "leads.assign",
    "clients.view", "clients.create", "clients.update", "plantations.view",
    "offres.view", "promotions.view", "commissions.view", "documents.view", "documents.upload",
  ),
  [ROLES.CHEF_EQUIPE_TECHNIQUE]: only(
    "plantations.", "documents.view", "documents.upload", "rapports.view_technique",
    "tickets.view", "tickets.create", "tickets.update", "clients.view",
  ),
  [ROLES.CHEF_EQUIPE_SERVICE_CLIENT]: only(
    "tickets.", "clients.view", "clients.update", "paiements.view", "paiements.record",
    "paiements.validate", "documents.view", "leads.view",
  ),
  [ROLES.COMMERCIAL]: only(
    "leads.view", "leads.create", "leads.update",
    "clients.view", "clients.create", "clients.update",
    "plantations.view", "offres.view", "promotions.view", "commissions.view",
    "documents.view", "documents.upload",
  ),
  [ROLES.SERVICE_CLIENT]: only(
    "tickets.view", "tickets.create", "tickets.update",
    "clients.view", "paiements.view", "paiements.record", "paiements.validate",
    "documents.view", "leads.view",
  ),
  [ROLES.ASSISTANT_ADMIN]: only(
    "clients.view", "documents.view", "documents.upload", "leads.view",
    "plantations.view", "tickets.view", "rapports.export",
  ),
  [ROLES.ASSOCIE_ACTIONNAIRE]: only(
    "offres.view", "promotions.view", "leads.view", "clients.view", "plantations.view",
    "paiements.view", "documents.view", "rapports.view_technique", "rapports.view_financier",
    "rapports.export", "commissions.view", "tickets.view",
  ),
};

/** Garantit une entrée pour chacun des rôles officiels */
OFFICIAL_ROLE_CODES.forEach((code) => {
  DEFAULT_ROLE_PERMISSIONS[code] ||= [];
});
