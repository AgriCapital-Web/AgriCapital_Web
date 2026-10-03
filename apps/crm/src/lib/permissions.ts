/** Métadonnées UI des permissions connues. Les droits réellement attribués viennent exclusivement de public.role_permissions. */

import { ROLES, OFFICIAL_ROLE_CODES } from "@/lib/roles";

export interface PermissionDef {
  code: string;
  module: string;
  action: string;
  libelle: string;
}

const build = (module: string, moduleLabel: string, actions: [string, string][]): PermissionDef[] =>
  actions.map(([action, libelle]) => ({ code: `${module}.${action}`, module: moduleLabel, action, libelle }));

const CRUD: [string, string][] = [
  ["view", "Consulter"], ["create", "Créer"], ["update", "Modifier"], ["archive", "Archiver"], ["delete", "Supprimer"], ["restore", "Réactiver"],
];

export const PERMISSION_CATALOG: PermissionDef[] = [
  ...build("utilisateurs", "Utilisateurs", [...CRUD, ["reset_password", "Réinitialiser le mot de passe"], ["manage_roles", "Modifier les rôles d'un utilisateur"]]),
  ...build("roles", "Rôles", [...CRUD, ["manage_permissions", "Gérer les permissions"]]),
  ...build("offres", "Offres", [...CRUD, ["manage_prices", "Gérer les prix et le Paiement Initial"], ["manage_promotions", "Gérer les promotions"]]),
  ...build("promotions", "Promotions", [...CRUD, ["activate", "Activer / désactiver"], ["view_history", "Consulter l'historique"]]),
  ...build("leads", "Leads", [["view", "Consulter"], ["create", "Créer"], ["update", "Modifier"], ["assign", "Affecter"], ["archive", "Archiver"], ["delete", "Supprimer"]]),
  ...build("clients", "Clients", [["view", "Consulter"], ["view_money", "Consulter la monnaie client"], ["create", "Créer"], ["update", "Modifier"], ["archive", "Archiver"]]),
  ...build("plantations", "Plantations", [["view", "Consulter"], ["create", "Créer"], ["update", "Modifier"], ["archive", "Archiver"]]),
  ...build("paiements", "Paiements", [["view", "Consulter"], ["record", "Enregistrer"], ["execute", "Effectuer"], ["update", "Modifier"], ["cancel", "Annuler"], ["validate", "Valider"]]),
  ...build("documents", "Documents", [["view", "Consulter"], ["upload", "Téléverser"], ["validate", "Valider"]]),
  ...build("rapports", "Rapports", [["view_technique", "Voir les rapports techniques"], ["view_financier", "Voir les rapports financiers"], ["export", "Exporter les données"]]),
  ...build("commissions", "Commissions", [["view", "Consulter"], ["validate", "Valider"], ["manage_payouts", "Paramétrer et effectuer les versements"]]),
  ...build("beneficiaires", "Bénéficiaires", [["view", "Consulter"], ["create", "Créer un bénéficiaire"], ["update", "Modifier"]]),
  ...build("portefeuilles", "Portefeuilles", [["view", "Consulter"], ["manage_payouts", "Gérer les versements"]]),
  ...build("tickets", "Support", [["view", "Consulter"], ["create", "Créer"], ["update", "Traiter"]]),
  ...build("parametres", "Paramètres", [["view", "Accéder aux paramètres"], ["manage_geo", "Gérer le référentiel géographique"], ["manage_teams", "Gérer les équipes"], ["manage_system", "Gérer la configuration système"], ["view_audit", "Consulter les journaux d'audit"]]),
  ...build("finance", "Finance & Comptabilité", [["view", "Consulter"], ["manage", "Gérer"], ["expenses", "Gérer les dépenses"], ["payroll", "Gérer les salaires et la paie"], ["associates", "Gérer les mouvements des associés"], ["reports", "Consulter les rapports financiers"]]),
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((p) => p.code);
export const PERMISSIONS_BY_MODULE = PERMISSION_CATALOG.reduce<Record<string, PermissionDef[]>>((acc, p) => { (acc[p.module] ||= []).push(p); return acc; }, {});
const all = () => [...PERMISSION_CODES];
const only = (...prefixes: string[]) => PERMISSION_CODES.filter((c) => prefixes.some((p) => (p.endsWith(".") ? c.startsWith(p) : c === p)));

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: all(),
  [ROLES.PDG]: all(),
  [ROLES.DG]: all(),
  [ROLES.RESPONSABLE_OPERATIONS]: only("finance.view", "finance.reports", "clients.view_money", "utilisateurs.", "offres.", "promotions.", "leads.", "clients.", "plantations.", "documents.", "rapports.", "tickets.", "commissions.view", "paiements.view", "paiements.record", "paiements.validate", "parametres.view", "parametres.manage_geo", "parametres.manage_teams", "parametres.view_audit", "portefeuilles.view").filter((c) => !["utilisateurs.delete", "utilisateurs.manage_roles"].includes(c)),
  [ROLES.RESPONSABLE_COMMERCIAL]: only("leads.", "clients.view", "portefeuilles.view", "clients.create", "clients.update", "plantations.view", "offres.view", "promotions.view", "paiements.view", "commissions.view", "rapports.view_financier", "rapports.export", "documents.view", "tickets.view", "utilisateurs.view", "parametres.manage_teams"),
  [ROLES.COMPTABLE]: only("finance.", "clients.view_money", "paiements.", "commissions.", "commissions.manage_payouts", "portefeuilles.", "portefeuilles.manage_payouts", "rapports.view_financier", "rapports.export", "clients.view", "offres.view", "promotions.view", "documents.view", "documents.validate"),
  [ROLES.CHEF_EQUIPE_COMMERCIAL]: only("leads.view", "leads.create", "leads.update", "leads.assign", "clients.view", "clients.create", "clients.update", "beneficiaires.view", "portefeuilles.view", "commissions.view", "plantations.view", "offres.view", "promotions.view", "documents.view", "documents.upload"),
  [ROLES.TECHNICIEN]: only("leads.create", "clients.view", "plantations.view", "plantations.update", "documents.view", "documents.upload", "rapports.view_technique", "tickets.view", "tickets.create", "tickets.update", "portefeuilles.view", "commissions.view"),
  [ROLES.CHEF_EQUIPE_TECHNIQUE]: only("plantations.", "documents.view", "documents.upload", "rapports.view_technique", "tickets.view", "portefeuilles.view", "commissions.view", "tickets.create", "tickets.update", "clients.view", "leads.create"),
  [ROLES.CHEF_EQUIPE_SERVICE_CLIENT]: only("tickets.", "clients.view", "clients.update", "documents.view", "leads.view", "leads.create", "clients.create"),
  [ROLES.COMMERCIAL]: only("leads.view", "leads.create", "leads.update", "clients.view", "clients.create", "clients.update", "plantations.view", "offres.view", "promotions.view", "commissions.view", "portefeuilles.view", "documents.view", "documents.upload"),
  [ROLES.SERVICE_CLIENT]: only("tickets.view", "tickets.create", "tickets.update", "clients.view", "clients.create", "leads.view", "leads.create", "documents.view"),
  [ROLES.ASSISTANT_ADMIN]: only("clients.view", "documents.view", "documents.upload", "leads.view", "plantations.view", "tickets.view", "rapports.export"),
  [ROLES.ASSOCIE_ACTIONNAIRE]: only("finance.view", "finance.reports", "offres.view", "promotions.view", "leads.view", "clients.view", "plantations.view", "paiements.view", "documents.view", "rapports.view_technique", "rapports.view_financier", "rapports.export", "commissions.view", "tickets.view"),
};

OFFICIAL_ROLE_CODES.forEach((code) => { DEFAULT_ROLE_PERMISSIONS[code] ||= []; });
