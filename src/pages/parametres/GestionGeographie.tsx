import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, MapPin, Building, Home, TreePine, TentTree } from "lucide-react";
import GestionDistricts from "./GestionDistricts";
import GestionRegions from "./GestionRegions";
import GestionDepartements from "./GestionDepartements";
import GestionSousPrefectures from "./GestionSousPrefectures";
import GestionVillages from "./GestionVillages";
import GestionCampements from "./GestionCampements";

export default function GestionGeographie(){
  return <div className="space-y-4">
    <div><h2 className="text-xl font-semibold">Référentiel géographique</h2><p className="text-sm text-muted-foreground">Hiérarchie officielle ANStat RGPH 2021 et disponibilité opérationnelle AgriCapital.</p></div>
    <Tabs defaultValue="districts" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
        <TabsTrigger value="districts"><Map className="h-4 w-4 mr-1"/>Districts</TabsTrigger>
        <TabsTrigger value="regions"><MapPin className="h-4 w-4 mr-1"/>Régions</TabsTrigger>
        <TabsTrigger value="departements"><Building className="h-4 w-4 mr-1"/>Départements</TabsTrigger>
        <TabsTrigger value="sous-prefectures"><Home className="h-4 w-4 mr-1"/>S/Préfectures</TabsTrigger>
        <TabsTrigger value="villages"><TreePine className="h-4 w-4 mr-1"/>Villages</TabsTrigger>
        <TabsTrigger value="campements"><TentTree className="h-4 w-4 mr-1"/>Campements</TabsTrigger>
      </TabsList>
      <TabsContent value="districts"><GestionDistricts/></TabsContent>
      <TabsContent value="regions"><GestionRegions/></TabsContent>
      <TabsContent value="departements"><GestionDepartements/></TabsContent>
      <TabsContent value="sous-prefectures"><GestionSousPrefectures/></TabsContent>
      <TabsContent value="villages"><GestionVillages/></TabsContent>
      <TabsContent value="campements"><GestionCampements/></TabsContent>
    </Tabs>
  </div>;
}
