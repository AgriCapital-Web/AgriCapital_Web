import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutGrid, ListChecks, Sprout, Camera, FileText, MapPin, FileBarChart2, MessageSquare, TrendingUp, Package, PieChart } from "lucide-react";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { PlantationSelector } from "@/components/plantation/PlantationSelector";
import { OverviewTab } from "@/components/plantation/tabs/OverviewTab";
import { ProgressionTab } from "@/components/plantation/tabs/ProgressionTab";
import { TechniqueTab } from "@/components/plantation/tabs/TechniqueTab";
import { MediasTab } from "@/components/plantation/tabs/MediasTab";
import { DocumentsTab } from "@/components/plantation/tabs/DocumentsTab";
import { MapTab } from "@/components/plantation/tabs/MapTab";
import { RapportsTab } from "@/components/plantation/tabs/RapportsTab";
import { MessagerieTab } from "@/components/plantation/tabs/MessagerieTab";
import { ProductionTab } from "@/components/plantation/tabs/ProductionTab";
import { IntrantsTab } from "@/components/plantation/tabs/IntrantsTab";
import { RevenusTab } from "@/components/plantation/tabs/RevenusTab";

interface Props {
  souscripteur: any;
  plantations: any[];
  onBack: () => void;
}

const ClientPlantationHub = ({ souscripteur, plantations, onBack }: Props) => {
  const [selectedId, setSelectedId] = useState<string>(plantations[plantations.length - 1]?.id || plantations[0]?.id);
  const plantation = useMemo(() => plantations.find((p) => p.id === selectedId) || plantations[0], [plantations, selectedId]);
  const isPlus = (souscripteur?.offres?.code || "").endsWith("+");
  const isPalmTerroir = String(souscripteur?.formule_code || "").startsWith("PALMTERROIR");
  const formuleLabel = souscripteur?.formule_nom || souscripteur?.formule_code || souscripteur?.famille_offre || souscripteur?.offres?.nom || "Formule";

  const baseTabs = [
    { value: "overview", icon: LayoutGrid, label: "Vue" },
    { value: "progression", icon: ListChecks, label: "Progression" },
    { value: "technique", icon: Sprout, label: "Technique" },
    { value: "medias", icon: Camera, label: "Médias" },
    { value: "documents", icon: FileText, label: "Documents" },
    { value: "carte", icon: MapPin, label: "Carte" },
    { value: "rapports", icon: FileBarChart2, label: "Rapports" },
    { value: "messagerie", icon: MessageSquare, label: "Messagerie" },
  ];
  const plusTabs = [
    { value: "production", icon: TrendingUp, label: "Production" },
    { value: "intrants", icon: Package, label: "Intrants" },
    { value: "revenus", icon: PieChart, label: "Revenus" },
  ];
  const tabs = isPlus ? [...baseTabs, ...plusTabs] : baseTabs;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #00643C 0%, #004d2e 20%, #f8f7f4 20.1%, #f8f7f4 100%)" }}>
      <header className="px-4 pt-4 pb-3 sticky top-0 z-50" style={{ background: "linear-gradient(180deg, #00643C 0%, #004d2e 100%)" }}>
        <div className="container mx-auto max-w-lg lg:max-w-[1400px]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="bg-white rounded-lg p-1"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 object-contain" /></div>
            <div className="w-9" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-white/60 tracking-wider">Ma Plantation</p>
              <h1 className="text-lg font-bold text-white truncate">{plantation?.nom_plantation || plantation?.id_unique || "—"}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap"><Badge className="bg-white/10 border-white/20 text-white text-[9px]">{formuleLabel}</Badge>{isPalmTerroir && <span className="text-[9px] text-white/70">Encadrement & suivi après mise en terre</span>}</div>
            </div>
            <div className="w-56 shrink-0">
              <PlantationSelector plantations={plantations} selectedId={selectedId} onChange={setSelectedId} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 lg:px-8 max-w-lg lg:max-w-[1400px] py-4 lg:py-6">
        {isPalmTerroir && <div className="mb-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground"><strong className="text-primary">PalmTerroir :</strong> après la mise en terre, les travaux réguliers d’entretien et les intrants restent à la charge du client. AgriCapital assure l’encadrement, les recommandations et le suivi technique.</div>}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar h-auto p-1 bg-white/80 backdrop-blur rounded-xl mb-4 justify-start lg:justify-center">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-shrink-0 gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-white">
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview"><OverviewTab plantation={plantation} souscripteur={souscripteur} /></TabsContent>
          <TabsContent value="progression"><ProgressionTab plantation={plantation} souscripteur={souscripteur} /></TabsContent>
          <TabsContent value="technique"><TechniqueTab plantation={plantation} /></TabsContent>
          <TabsContent value="medias"><MediasTab plantation={plantation} /></TabsContent>
          <TabsContent value="documents"><DocumentsTab plantation={plantation} souscripteur={souscripteur} /></TabsContent>
          <TabsContent value="carte"><MapTab plantation={plantation} /></TabsContent>
          <TabsContent value="rapports"><RapportsTab plantation={plantation} /></TabsContent>
          <TabsContent value="messagerie"><MessagerieTab souscripteur={souscripteur} plantation={plantation} /></TabsContent>
          {isPlus && <TabsContent value="production"><ProductionTab plantation={plantation} /></TabsContent>}
          {isPlus && <TabsContent value="intrants"><IntrantsTab plantation={plantation} /></TabsContent>}
          {isPlus && <TabsContent value="revenus"><RevenusTab plantation={plantation} /></TabsContent>}
        </Tabs>
      </main>

      <footer className="border-t bg-card py-3">
        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital · client.agricapital.ci</p>
      </footer>
    </div>
  );
};

export default ClientPlantationHub;
