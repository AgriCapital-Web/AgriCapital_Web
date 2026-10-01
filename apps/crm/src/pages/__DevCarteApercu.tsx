import { useRef } from "react";
import html2canvas from "html2canvas";
import { CarteRecto, CarteVerso, CarteData } from "@/components/cartes/CartePersonnel";

const demo: CarteData = {
  id: "00000000-0000-0000-0000-000000000000",
  matricule: "AC-COM-DAL-2026-001",
  code_verification: "AC7X92KD4P",
  nom_complet: "KOUASSI YAO JEAN-BAPTISTE",
  poste: "Chef d'équipe commercial régional",
  role_code: "chef_equipe_commercial",
  type_contrat: "cdd",
  statut_agent: "employe",
  zone_intervention: "Daloa – Gonaté",
  date_delivrance: "2026-09-01",
  date_expiration: "2026-11-30",
  statut: "active",
  telephone: "+225 07 50 56 60 87",
};

const DevCarteApercu = () => {
  const recto = useRef<HTMLDivElement>(null);
  const verso = useRef<HTMLDivElement>(null);

  const exporter = async (ref: React.RefObject<HTMLDivElement>, nom: string) => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, {
      scale: 8,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    (window as unknown as Record<string, string>)[`export_${nom}`] =
      canvas.toDataURL("image/png");
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4">
        <div className="flex w-full flex-col items-center gap-6 overflow-x-auto pb-2 lg:flex-row lg:items-start lg:justify-center">
          <CarteRecto ref={recto} carte={demo} />
          <CarteVerso ref={verso} carte={demo} />
        </div>
        <button
          id="exp"
          onClick={() => {
            void exporter(recto, "recto");
            void exporter(verso, "verso");
          }}
        >
          exporter
        </button>
      </div>
    </div>
  );
};

export default DevCarteApercu;
