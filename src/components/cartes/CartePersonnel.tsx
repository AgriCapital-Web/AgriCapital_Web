import { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import logo from "@/assets/logo-agricapital-v2.png";
import symbole from "@/assets/symbole-agricapital.png";
import signature from "@/assets/signature-direction.png";
import cachet from "@/assets/cachet-agricapital.png";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { CARTE_BUCKET } from "@/lib/photoCarte";
import { roleLabel } from "@/lib/roles";

/**
 * Carte professionnelle AgriCapital — reproduction fidèle des maquettes
 * officielles recto / verso.
 *
 * Toute la mise en page est exprimée en pixels sur une grille fixe de
 * 480 × 678 px, calée sur le ratio de la maquette officielle fournie. Les unités mm/pt et les
 * troncatures CSS (truncate, line-clamp) sont volontairement évitées : elles
 * sont mal converties par html2canvas et provoquaient chevauchements et textes
 * coupés à l'export / impression. Les valeurs trop longues sont raccourcies en
 * JavaScript, ce qui donne un rendu identique à l'écran, au téléchargement et
 * à l'impression.
 */

const W = 480;
const H = 678;

const VERT = "#0B4A2E";
const VERT_CLAIR = "#137A45";
const ORANGE = "#E97A11";
const GRIS = "#3B3B3B";
const GRIS_LIGNE = "#C9C9C9";

export interface CarteData {
  id?: string;
  matricule: string;
  code_verification: string;
  nom_complet: string;
  poste?: string | null;
  departement?: string | null;
  role_code?: string | null;
  type_contrat?: string | null;
  statut_agent?: string | null;
  mission?: string | null;
  zone_intervention?: string | null;
  photo_url?: string | null;
  photo_bucket?: string | null;
  date_delivrance?: string | null;
  date_expiration?: string | null;
  statut?: string | null;
  telephone?: string | null;
  email?: string | null;
}

export const CONTRATS = [
  { v: "cdi", l: "CDI" },
  { v: "cdd", l: "CDD" },
  { v: "prestataire", l: "Prestataire" },
  { v: "stage", l: "Stage" },
];

export const STATUTS_AGENT = [
  { v: "employe", l: "EMPLOYÉ" },
  { v: "cadre", l: "CADRE" },
  { v: "prestataire", l: "PRESTATAIRE" },
  { v: "stagiaire", l: "STAGIAIRE" },
  { v: "partenaire", l: "PARTENAIRE" },
];

export const contratLabel = (v?: string | null) => CONTRATS.find((c) => c.v === v)?.l || "CDI";
export const statutAgentLabel = (v?: string | null) =>
  STATUTS_AGENT.find((s) => s.v === v)?.l || "EMPLOYÉ";

/** Mission courte générée automatiquement selon le rôle / poste de l'agent. */
const MISSIONS_PAR_ROLE: Record<string, string> = {
  super_admin: "Direction générale",
  admin: "Administration plateforme",
  responsable_operations: "Pilotage des opérations",
  directeur_tc: "Direction technico-commerciale",
  responsable_commercial: "Pilotage de portefeuille",
  responsable_zone: "Supervision de zone",
  comptable: "Gestion financière",
  chef_equipe_commercial: "Encadrement commercial",
  chef_equipe_technique: "Encadrement technique",
  chef_equipe_service_client: "Encadrement service client",
  commercial: "Acquisition clients",
  technicien: "Suivi des plantations",
  service_client: "Assistance souscripteurs",
  assistant_administratif: "Appui administratif",
};

/** Raccourcit proprement une valeur trop longue pour sa zone. */
const coupe = (valeur: string, max: number) =>
  valeur.length <= max ? valeur : `${valeur.slice(0, Math.max(1, max - 1)).trimEnd()}…`;

export const missionAuto = (carte: CarteData) =>
  carte.mission ||
  MISSIONS_PAR_ROLE[carte.role_code || ""] ||
  carte.poste ||
  "Missions AgriCapital";

const fdate = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy", { locale: fr }) : "—");

/** Validité : indéterminée en CDI, sinon jusqu'à la date de fin de contrat. */
export const validiteTexte = (carte: CarteData) => {
  if (carte.type_contrat === "cdi") return "Indéterminée";
  const debut = carte.date_delivrance ? `Du ${fdate(carte.date_delivrance)} ` : "";
  return carte.date_expiration ? `${debut}au ${fdate(carte.date_expiration)}` : "Indéterminée";
};

export const verificationUrl = (code: string) =>
  `${typeof window !== "undefined" ? window.location.origin : "https://app.agricapital.ci"}/verifier-carte/${code}`;

const initiales = (nom: string) =>
  nom
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

/** Courbes officielles, maintenues hors des zones de contenu. */
const DecorHaut = () => (
  <>
    <svg
      width={104}
      height={168}
      viewBox="0 0 104 168"
      style={{ position: "absolute", left: 0, top: 0 }}
      aria-hidden
    >
      <path d="M0 0H104C55 22 22 72 0 146Z" fill={VERT} />
    </svg>
    <svg
      width={118}
      height={108}
      viewBox="0 0 118 108"
      style={{ position: "absolute", right: 0, top: 74 }}
      aria-hidden
    >
      <path d="M118 0V66C88 86 53 98 0 106C52 82 92 48 118 0Z" fill={ORANGE} />
    </svg>
  </>
);

const DecorBas = () => (
  <svg
    width={W}
    height={78}
    viewBox="0 0 480 78"
    preserveAspectRatio="none"
    style={{ position: "absolute", left: 0, bottom: 0 }}
    aria-hidden
  >
    <path d="M0 22C150 68 340 70 480 12V78H0Z" fill="#E7E7E7" />
    <path d="M0 34C148 74 338 74 480 20V78H0Z" fill={ORANGE} />
    <path d="M0 47C158 80 350 78 480 33V78H0Z" fill={VERT} />
  </svg>
);

type IconeCarte = "mission" | "pays" | "validite" | "identifiant";

/** Pictogrammes officiels de la maquette (cible, localisation, calendrier, badge). */
const PICTOS: Record<IconeCarte, string> = {
  mission:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.2A6.8 6.8 0 1 1 5.2 12 6.8 6.8 0 0 1 12 5.2Zm0 3.4A3.4 3.4 0 1 0 12 15.4 3.4 3.4 0 0 0 12 8.6Zm0 2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z",
  pays: "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z",
  validite:
    "M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2V2Zm13 8H4v10h16V10ZM6 12h4v3H6v-3Z",
  identifiant:
    "M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 3v10h6V7H5Zm3 1.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM5.9 15.6c.3-1.2 1.1-1.9 2.1-1.9s1.8.7 2.1 1.9H5.9ZM13 8h6v1.6h-6V8Zm0 3.2h6v1.6h-6v-1.6Zm0 3.2h4v1.6h-4v-1.6Z",
};

const Ligne = ({ label, valeur, icone }: { label: string; valeur: string; icone: IconeCarte }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      height: 34,
      borderBottom: `1px solid ${GRIS_LIGNE}`,
    }}
  >
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: VERT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width={15} height={15} fill="#FFFFFF" aria-hidden>
        <path d={PICTOS[icone]} />
      </svg>
    </span>
    <span style={{ width: 3, height: 20, backgroundColor: ORANGE, margin: "0 7px", flexShrink: 0 }} />
    <span
      style={{
        color: VERT,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.2,
        textTransform: "uppercase",
        lineHeight: "12px",
        width: 96,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <span style={{ color: GRIS, fontSize: 10, lineHeight: "12px", margin: "0 5px", flexShrink: 0 }}>:</span>
    <span style={{ color: GRIS, fontSize: 10.5, lineHeight: "12px", whiteSpace: "nowrap", overflow: "hidden" }}>
      {valeur}
    </span>
  </div>
);

const CardShell = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: "relative",
      width: W,
      height: H,
      flexShrink: 0,
      overflow: "hidden",
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      border: `3px solid ${VERT}`,
      color: GRIS,
      fontFamily: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      boxSizing: "border-box",
    }}
  >
    <div style={{ position: "relative", width: W, height: H }}>
      {children}
    </div>
  </div>
);

const QR = ({ code, taille }: { code: string; taille: number }) => (
  <div
    style={{
      width: taille,
      height: taille,
      padding: 5,
      backgroundColor: "#FFFFFF",
      border: "1px solid #CFCFCF",
      borderRadius: 6,
      boxSizing: "border-box",
      flexShrink: 0,
    }}
  >
    <QRCodeCanvas
      value={verificationUrl(code)}
      size={1024}
      level="H"
      includeMargin={false}
      style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
    />
  </div>
);

/** Recto — grille fixe conforme à la maquette officielle. */
export const CarteRecto = forwardRef<HTMLDivElement, { carte: CarteData }>(({ carte }, ref) => {
  const photo = useSignedUrl(carte.photo_bucket || CARTE_BUCKET, carte.photo_url);
  const fonction = coupe(carte.poste || roleLabel(carte.role_code) || "—", 52);
  return (
    <div ref={ref}>
      <CardShell>
        <DecorHaut />
        <div style={{ position: "relative", zIndex: 10, padding: "22px 26px 0" }}>
          <img
            src={logo}
            alt="AgriCapital — Investir la terre. Cultiver l'avenir."
            style={{ display: "block", margin: "0 auto", height: 72, width: 210, objectFit: "contain" }}
          />

          <div style={{ display: "flex", gap: 22, marginTop: 56 }}>
            <div
              style={{
                width: 136,
                height: 180,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: 10,
                border: `2px solid ${VERT}`,
                backgroundColor: "#E7E7E7",
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={carte.nom_complet}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  aria-label="Emplacement photo"
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: "#F2F2F2",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 26,
                    left: "50%",
                    width: 58,
                    height: 58,
                    transform: "translateX(-50%)",
                    borderRadius: "50%",
                    backgroundColor: "#8A8A8A",
                  }} />
                  <div style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -8,
                    width: 138,
                    height: 112,
                    transform: "translateX(-50%)",
                    borderRadius: "70px 70px 0 0",
                    backgroundColor: "#777777",
                  }} />
                  <div style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 42,
                    width: 34,
                    height: 42,
                    transform: "translateX(-50%)",
                    backgroundColor: "#EEEEEE",
                    clipPath: "polygon(0 0, 100% 0, 72% 100%, 28% 100%)",
                  }} />
                  <div style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 0,
                    width: 20,
                    height: 72,
                    transform: "translateX(-50%) rotate(0deg)",
                    backgroundColor: "#4F4F4F",
                    clipPath: "polygon(50% 0, 100% 22%, 72% 100%, 28% 100%, 0 22%)",
                  }} />
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <p
                style={{
                  margin: 0,
                  color: VERT,
                  fontSize: carte.nom_complet.length > 24 ? 15 : 18,
                  fontWeight: 800,
                  lineHeight: "19px",
                  textTransform: "uppercase",
                  height: 40,
                  overflow: "hidden",
                }}
              >
                {coupe(carte.nom_complet, 44)}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "8px 0 10px" }}>
                <span style={{ height: 1, flex: 1, backgroundColor: GRIS_LIGNE }} />
                <img src={symbole} alt="" style={{ height: 14, objectFit: "contain" }} />
                <span style={{ height: 1, flex: 1, backgroundColor: GRIS_LIGNE }} />
              </div>

              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: "uppercase", lineHeight: "15px" }}>
                Fonction
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: "14px", height: 28, overflow: "hidden" }}>
                {fonction}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <span
                  style={{
                    backgroundColor: VERT,
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "4px 9px",
                    borderRadius: 5,
                    lineHeight: "12px",
                  }}
                >
                  Statut
                </span>
                <span style={{ width: 1, height: 16, backgroundColor: GRIS_LIGNE }} />
                <span
                  style={{
                    color: VERT_CLAIR,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    lineHeight: "13px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {statutAgentLabel(carte.statut_agent)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <Ligne label="Mission" valeur={coupe(missionAuto(carte), 34)} icone="mission" />
            <Ligne label="Zone d’intervention" valeur={coupe(carte.zone_intervention || carte.departement || "Côte d’Ivoire", 28)} icone="pays" />
            <Ligne label="Période de validité" valeur={coupe(validiteTexte(carte), 34)} icone="validite" />
            <Ligne label="Identifiant officiel" valeur={coupe(carte.matricule, 34)} icone="identifiant" />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 20 }}>
            <QR code={carte.code_verification} taille={84} />

            <div style={{ width: 118, flexShrink: 0 }}>
              <p
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: VERT,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  lineHeight: "12px",
                }}
              >
                <svg viewBox="0 0 24 24" width={13} height={13} fill={VERT} aria-hidden>
                  <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Zm-1 12.4-3-3 1.4-1.4L11 11.6l3.6-3.6L16 9.4l-5 5Z" />
                </svg>
                Vérification
              </p>
              <p style={{ margin: "5px 0 0", fontSize: 8.5, lineHeight: "11px", color: GRIS }}>
                Scannez ce QR code pour vérifier l'authenticité et la validité de ce badge.
              </p>
            </div>

            <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
              <div style={{ position: "relative", height: 62 }}>
                <img
                  src={signature}
                  alt="Signature de la direction"
                  style={{
                    position: "absolute",
                    right: 22,
                    bottom: 4,
                    height: 44,
                    width: 112,
                    objectFit: "contain",
                    zIndex: 10,
                  }}
                />
                <img
                  src={cachet}
                  alt="Cachet AgriCapital"
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: -10,
                    height: 74,
                    width: 74,
                    objectFit: "contain",
                    zIndex: 12,
                  }}
                />
              </div>
              <span style={{ display: "block", height: 1, width: "100%", backgroundColor: "#8E8E8E" }} />
              <p style={{ margin: "5px 0 0", color: VERT, fontSize: 9, fontWeight: 700, textTransform: "uppercase", lineHeight: "11px" }}>
                Signature direction
              </p>
            </div>
          </div>
        </div>
        <DecorBas />
      </CardShell>
    </div>
  );
});
CarteRecto.displayName = "CarteRecto";

const CONTACTS = (carte: CarteData) => [
  {
    d: "M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2 4.6 1v3.4A2 2 0 0 1 18 21.6 18 18 0 0 1 2.4 6 2 2 0 0 1 4.4 4h3.4l1 4.6-2.2 2.2Z",
    t: carte.telephone || "+225 07 50 56 60 87",
  },
  { d: "M2 5h20v14H2V5Zm10 8L3.5 6.6 12 12l8.5-5.4L12 13Z", t: "contact@agricapital.ci" },
  {
    d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.6 2 2.4 4 2.4 6s-.8 4-2.4 6c-1.6-2-2.4-4-2.4-6s.8-4 2.4-6ZM4.3 9h3.3a16 16 0 0 0 0 6H4.3a8 8 0 0 1 0-6Zm12.1 0h3.3a8 8 0 0 1 0 6h-3.3a16 16 0 0 0 0-6Z",
    t: "www.agricapital.ci",
  },
  {
    d: "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z",
    t: "Daloa-Gonaté, Côte d'Ivoire",
  },
];

/** Verso — grille fixe conforme à la maquette officielle. */
export const CarteVerso = forwardRef<HTMLDivElement, { carte: CarteData }>(({ carte }, ref) => (
  <div ref={ref}>
    <CardShell>
      <DecorBas />
      <div style={{ position: "relative", zIndex: 10, padding: "20px 28px 0" }}>
        <img
          src={logo}
          alt="AgriCapital — Investir la terre. Cultiver l'avenir."
          style={{ display: "block", margin: "0 auto", height: 62, width: 236, objectFit: "contain" }}
        />
        <span style={{ display: "block", margin: "8px auto 0", height: 2, width: 52, backgroundColor: VERT }} />

        <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 10, lineHeight: "14px", color: GRIS }}>
          Cette carte est une pièce d'identification professionnelle délivrée par AgriCapital SARL.
          Elle atteste de l'appartenance ou de la collaboration de son titulaire avec l'entreprise
          dans le cadre de ses activités professionnelles.
        </p>

        <div style={{ marginTop: 16, border: `2px solid ${VERT}`, borderRadius: 12, padding: "12px 12px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <svg viewBox="0 0 24 24" width={34} height={34} fill={VERT} aria-hidden style={{ flexShrink: 0 }}>
              <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Zm0 7a2 2 0 0 1 2 2v1h-4v-1a2 2 0 0 1 2-2Zm-3 4h6v4H9v-4Z" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  color: VERT,
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  lineHeight: "13px",
                  whiteSpace: "nowrap",
                }}
              >
                Carte personnelle – non transférable
              </p>
              <span style={{ display: "block", height: 2, width: "100%", backgroundColor: ORANGE, margin: "7px 0" }} />
              <p style={{ margin: 0, fontSize: 9.5, lineHeight: "13px", color: GRIS }}>
                Toute perte, détérioration ou utilisation frauduleuse doit être signalée à AgriCapital SARL.
                Cette carte doit être restituée à l'entreprise à la fin de la collaboration ou sur demande.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
          <QR code={carte.code_verification} taille={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: VERT,
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                lineHeight: "13px",
              }}
            >
              <svg viewBox="0 0 24 24" width={15} height={15} fill={VERT} aria-hidden style={{ flexShrink: 0 }}>
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14.4-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9.4l-7 7Z" />
              </svg>
              Vérification du badge
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 9.5, lineHeight: "13px", color: GRIS }}>
              Scannez ce QR code pour vérifier l'authenticité et la validité de ce badge sur app.agricapital.ci
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 12px" }}>
          <span style={{ height: 1, flex: 1, backgroundColor: GRIS_LIGNE }} />
          <img src={symbole} alt="" style={{ height: 16, objectFit: "contain" }} />
          <span style={{ height: 1, flex: 1, backgroundColor: GRIS_LIGNE }} />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 168, flexShrink: 0 }}>
            <p style={{ margin: 0, color: VERT, fontSize: 11, fontWeight: 800, textTransform: "uppercase", lineHeight: "13px" }}>
              AgriCapital SARL
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 8.5, lineHeight: "12px", color: GRIS }}>
              Société à Responsabilité Limitée
              <br />
              RCCM : CI-DAL-01-2025-B12-00035
              <br />
              Daloa-Gonaté, Côte d'Ivoire
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {CONTACTS(carte).map((c) => (
              <div key={c.t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 9,
                    backgroundColor: VERT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg viewBox="0 0 24 24" width={10} height={10} fill="#FFFFFF" aria-hidden>
                    <path d={c.d} />
                  </svg>
                </span>
                <span style={{ fontSize: 8.5, lineHeight: "11px", color: GRIS, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {coupe(c.t, 30)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  </div>
));
CarteVerso.displayName = "CarteVerso";