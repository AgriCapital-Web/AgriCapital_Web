/** Source de vérité unique — rôles officiels AgriCapital CRM. */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PDG: 'pdg',
  RESPONSABLE_OPERATIONS: 'responsable_operations',
  RESPONSABLE_COMMERCIAL: 'responsable_commercial',
  COMPTABLE: 'comptable',
  COMMERCIAL: 'commercial',
  SERVICE_CLIENT: 'service_client',
  ASSISTANT_ADMIN: 'assistant_administratif',
  CHEF_EQUIPE_COMMERCIAL: 'chef_equipe_commercial',
  CHEF_EQUIPE_TECHNIQUE: 'chef_equipe_technique',
  TECHNICIEN: 'technicien',
  CHEF_EQUIPE_SERVICE_CLIENT: 'chef_equipe_service_client',
  ASSOCIE_ACTIONNAIRE: 'associe_actionnaire',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export interface RoleDefinition {
  code: AppRole;
  nom: string;
  court: string;
  description: string;
  niveau: number;
  niveauLabel: string;
  couleur: string;
}

export const OFFICIAL_ROLES: RoleDefinition[] = [
  { code: ROLES.SUPER_ADMIN, nom: 'Super Admin', court: 'Admin', description: 'Accès complet à toutes les fonctionnalités techniques et administratives', niveau: 1, niveauLabel: 'Administration', couleur: 'bg-destructive/10 text-destructive' },
  { code: ROLES.PDG, nom: 'PDG', court: 'PDG', description: 'Accès total à la plateforme au titre de la Direction Générale', niveau: 1, niveauLabel: 'Direction Générale', couleur: 'bg-primary/10 text-primary' },
  { code: ROLES.RESPONSABLE_OPERATIONS, nom: 'Responsable des Opérations', court: 'ROps', description: 'Pilotage des opérations, offres et paramétrage métier', niveau: 2, niveauLabel: 'Direction', couleur: 'bg-primary/10 text-primary' },
  { code: ROLES.RESPONSABLE_COMMERCIAL, nom: 'Responsable Commercial', court: 'RCom', description: "Pilotage commercial et gestion d'une zone", niveau: 3, niveauLabel: 'Management', couleur: 'bg-accent/20 text-accent-foreground' },
  { code: ROLES.COMPTABLE, nom: 'Comptable', court: 'Compta', description: 'Gestion financière, paiements et comptabilité', niveau: 3, niveauLabel: 'Management', couleur: 'bg-accent/20 text-accent-foreground' },
  { code: ROLES.CHEF_EQUIPE_COMMERCIAL, nom: "Chef d'Equipe Commercial", court: 'CEC', description: "Encadrement d'une équipe commerciale terrain", niveau: 4, niveauLabel: 'Encadrement', couleur: 'bg-secondary text-secondary-foreground' },
  { code: ROLES.CHEF_EQUIPE_TECHNIQUE, nom: "Chef d'Equipe Technique", court: 'CET', description: "Encadrement d'une équipe technique terrain", niveau: 4, niveauLabel: 'Encadrement', couleur: 'bg-secondary text-secondary-foreground' },
  { code: ROLES.TECHNICIEN, nom: 'Technicien', court: 'Tech', description: 'Visites, rapports et interventions techniques terrain', niveau: 5, niveauLabel: 'Opérationnel', couleur: 'bg-muted text-muted-foreground' },
  { code: ROLES.CHEF_EQUIPE_SERVICE_CLIENT, nom: "Chef d'Equipe Service Client", court: 'CESC', description: "Encadrement de l'équipe service client", niveau: 4, niveauLabel: 'Encadrement', couleur: 'bg-secondary text-secondary-foreground' },
  { code: ROLES.COMMERCIAL, nom: 'Commercial', court: 'Comm', description: 'Prospection, leads et clients', niveau: 5, niveauLabel: 'Opérationnel', couleur: 'bg-muted text-muted-foreground' },
  { code: ROLES.SERVICE_CLIENT, nom: 'Service Client', court: 'SC', description: 'Support, tickets et assistance client', niveau: 5, niveauLabel: 'Opérationnel', couleur: 'bg-muted text-muted-foreground' },
  { code: ROLES.ASSISTANT_ADMIN, nom: 'Assistant(e) Administratif(ve)', court: 'AA', description: 'Appui administratif et gestion documentaire', niveau: 5, niveauLabel: 'Opérationnel', couleur: 'bg-muted text-muted-foreground' },
  { code: ROLES.ASSOCIE_ACTIONNAIRE, nom: 'Associé / Actionnaire', court: 'A/A', description: 'Lecture seule des indicateurs, ventes, clients, plantations et finances autorisées', niveau: 2, niveauLabel: 'Gouvernance', couleur: 'bg-emerald-500/10 text-emerald-700' },
];

export const OFFICIAL_ROLE_CODES: string[] = OFFICIAL_ROLES.map((r) => r.code);

export function normalizeRole(role?: string | null): string {
  if (!role) return '';
  return OFFICIAL_ROLE_CODES.includes(role) ? role : '';
}

export function normalizeRoles(roles: string[] = []): string[] {
  return Array.from(new Set(roles.map(normalizeRole).filter(Boolean)));
}

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  OFFICIAL_ROLES.map((r) => [r.code, r.nom]),
);

export const ROLE_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  OFFICIAL_ROLES.map((r) => [r.code, r.court]),
);

export const ROLE_COLORS: Record<string, string> = Object.fromEntries(
  OFFICIAL_ROLES.map((r) => [r.code, r.couleur]),
);

export function roleLabel(role?: string | null): string {
  const code = normalizeRole(role);
  return ROLE_LABELS[code] || (code ? code.replace(/_/g, ' ') : '—');
}

/** Rôles autorisés à recevoir l'affectation d'un lead / d'un client */
export const COMMERCIAL_ASSIGNABLE_ROLES: string[] = [
  ROLES.COMMERCIAL,
  ROLES.CHEF_EQUIPE_COMMERCIAL,
  ROLES.RESPONSABLE_COMMERCIAL,
  ROLES.SUPER_ADMIN,
];

/** Rôles disposant d'une couverture territoriale (équipe / district / région) */
export const TERRITORIAL_ROLES: string[] = [
  ROLES.COMMERCIAL,
  ROLES.CHEF_EQUIPE_COMMERCIAL,
  ROLES.CHEF_EQUIPE_TECHNIQUE,
  ROLES.RESPONSABLE_COMMERCIAL,
];

/**
 * Matrice de permissions de navigation.
 * Elles sont désormais dérivées de la matrice de permissions (voir permissions.ts).
 */
export function hasPermission(userRoles: string[], permission: readonly string[]): boolean {
  const normalized = normalizeRoles(userRoles);
  return normalized.includes(ROLES.PDG) || normalized.some((role) => (permission as readonly string[]).includes(role));
}

export const PERMISSIONS = {
  VIEW_DASHBOARD: [ROLES.ASSOCIE_ACTIONNAIRE, ...OFFICIAL_ROLE_CODES],
  VIEW_CLIENTS: [ROLES.ASSOCIE_ACTIONNAIRE, ROLES.SUPER_ADMIN, ROLES.RESPONSABLE_OPERATIONS, ROLES.RESPONSABLE_COMMERCIAL, ROLES.CHEF_EQUIPE_COMMERCIAL, ROLES.COMMERCIAL, ROLES.SERVICE_CLIENT, ROLES.ASSISTANT_ADMIN],
  VIEW_LEADS: [ROLES.ASSOCIE_ACTIONNAIRE, ...OFFICIAL_ROLE_CODES],
  VIEW_PLANTATIONS: [ROLES.ASSOCIE_ACTIONNAIRE, ROLES.TECHNICIEN, ROLES.SUPER_ADMIN, ROLES.RESPONSABLE_OPERATIONS, ROLES.RESPONSABLE_COMMERCIAL, ROLES.CHEF_EQUIPE_TECHNIQUE, ROLES.CHEF_EQUIPE_COMMERCIAL, ROLES.COMMERCIAL],
  VIEW_PAIEMENTS: [ROLES.ASSOCIE_ACTIONNAIRE, ROLES.SUPER_ADMIN, ROLES.RESPONSABLE_OPERATIONS, ROLES.COMPTABLE, ROLES.SERVICE_CLIENT, ROLES.CHEF_EQUIPE_SERVICE_CLIENT, ROLES.RESPONSABLE_COMMERCIAL],
  VIEW_COMMISSIONS: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.COMPTABLE, ROLES.RESPONSABLE_OPERATIONS, ROLES.RESPONSABLE_COMMERCIAL, ROLES.CHEF_EQUIPE_COMMERCIAL, ROLES.CHEF_EQUIPE_TECHNIQUE, ROLES.TECHNICIEN, ROLES.COMMERCIAL],
  VIEW_PORTEFEUILLES: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS, ROLES.COMPTABLE, ROLES.RESPONSABLE_COMMERCIAL, ROLES.CHEF_EQUIPE_COMMERCIAL, ROLES.CHEF_EQUIPE_TECHNIQUE, ROLES.COMMERCIAL, ROLES.TECHNICIEN],
  MANAGE_PORTEFEUILLES: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.COMPTABLE, ROLES.RESPONSABLE_OPERATIONS],
  VIEW_RAPPORTS_TECHNIQUES: [ROLES.ASSOCIE_ACTIONNAIRE, ROLES.TECHNICIEN, ROLES.SUPER_ADMIN, ROLES.RESPONSABLE_OPERATIONS, ROLES.CHEF_EQUIPE_TECHNIQUE, ROLES.RESPONSABLE_COMMERCIAL],
  VIEW_RAPPORTS_FINANCIERS: [ROLES.ASSOCIE_ACTIONNAIRE, ROLES.SUPER_ADMIN, ROLES.RESPONSABLE_OPERATIONS, ROLES.COMPTABLE, ROLES.RESPONSABLE_COMMERCIAL],
  VIEW_TICKETS: [ROLES.ASSOCIE_ACTIONNAIRE, ROLES.TECHNICIEN, ROLES.SUPER_ADMIN, ROLES.RESPONSABLE_OPERATIONS, ROLES.SERVICE_CLIENT, ROLES.CHEF_EQUIPE_SERVICE_CLIENT, ROLES.CHEF_EQUIPE_TECHNIQUE],
  VIEW_PARAMETRES: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS],
  VIEW_EQUIPES: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS, ROLES.RESPONSABLE_COMMERCIAL, ROLES.CHEF_EQUIPE_COMMERCIAL, ROLES.CHEF_EQUIPE_TECHNIQUE, ROLES.CHEF_EQUIPE_SERVICE_CLIENT],
  MANAGE_USERS: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS],
  MANAGE_TEAMS: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS, ROLES.RESPONSABLE_COMMERCIAL],
  MANAGE_OFFERS: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS],
  MANAGE_GEO: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS,],
  MANAGE_ROLES: [ROLES.SUPER_ADMIN, ROLES.PDG],
  MANAGE_SYSTEM: [ROLES.SUPER_ADMIN, ROLES.PDG],
  /** Journal de traçabilité (qui a fait quoi, quand) */
  VIEW_AUDIT: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_OPERATIONS],
  VALIDATE_PAYMENTS: [ROLES.SUPER_ADMIN, ROLES.COMPTABLE, ROLES.SERVICE_CLIENT, ROLES.CHEF_EQUIPE_SERVICE_CLIENT],
  CREATE_ACQUISITION: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.RESPONSABLE_COMMERCIAL, ROLES.CHEF_EQUIPE_COMMERCIAL, ROLES.COMMERCIAL],
  CREATE_BENEFICIAIRE: [ROLES.SUPER_ADMIN, ROLES.PDG],
  MANAGE_REMUNERATION: [ROLES.SUPER_ADMIN, ROLES.PDG, ROLES.COMPTABLE],
  DELETE_DATA: [ROLES.SUPER_ADMIN],
} as const;
