import { useMemo } from "react";
import { Building2, MapPinned, Sprout, MessageSquare, ArrowRight, LogOut, UserRound, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { MessagerieTab } from "@/components/plantation/tabs/MessagerieTab";

interface Props {
  souscripteur:any;
  plantations:any[];
  onPlantationHub:()=>void;
  onLogout:()=>void;
}

export default function StakeholderDashboard({souscripteur,plantations,onPlantationHub,onLogout}:Props){
  const roles=souscripteur?.portal_roles||[];
  const parcelles=souscripteur?.parcelles||[];
  const attributions=souscripteur?.attributions||[];
  const hectares=useMemo(()=>parcelles.reduce((s:any,p:any)=>s+Number(p.surface_totale_ha||0),0),[parcelles]);
  const attributed=useMemo(()=>attributions.reduce((s:any,a:any)=>s+Number(a.surface_attribuee_ha||0),0),[attributions]);
  const roleLabel=roles.includes("proprietaire_foncier")&&roles.includes("beneficiaire_particulier")
    ?"Propriétaire foncier · Bénéficiaire"
    :roles.includes("proprietaire_foncier")?"Propriétaire foncier"
    :"Bénéficiaire particulier";

  return <div className="min-h-screen bg-muted/20">
    <header className="sticky top-0 z-50 border-b bg-primary px-3 py-3 text-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="rounded-lg bg-white p-1"><img src={logoWhiteBg} alt="AgriCapital" className="h-8 object-contain"/></div>
        <div className="min-w-0 flex-1 px-2"><p className="truncate text-sm font-bold">{souscripteur?.nom_complet||"Espace portail"}</p><p className="truncate text-[10px] text-white/70">{roleLabel}</p></div>
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-white hover:bg-white/15" title="Déconnexion"><LogOut className="h-4 w-4"/></Button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary"/><div><p className="text-lg font-bold">Mon espace AgriCapital</p><p className="text-xs text-muted-foreground">Vos informations foncières, attributions, plantations et échanges avec AgriCapital.</p></div></div>
        <Badge className="mt-3 bg-primary/10 text-primary hover:bg-primary/10">{roleLabel}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><MapPinned className="h-4 w-4 text-primary"/><p className="mt-2 text-2xl font-bold">{parcelles.length}</p><p className="text-[11px] text-muted-foreground">Parcelle(s)</p></CardContent></Card>
        <Card><CardContent className="p-4"><Building2 className="h-4 w-4 text-primary"/><p className="mt-2 text-2xl font-bold">{hectares.toLocaleString("fr-FR")}</p><p className="text-[11px] text-muted-foreground">Ha fonciers</p></CardContent></Card>
        <Card><CardContent className="p-4"><Sprout className="h-4 w-4 text-primary"/><p className="mt-2 text-2xl font-bold">{plantations.length}</p><p className="text-[11px] text-muted-foreground">Plantation(s)</p></CardContent></Card>
        <Card><CardContent className="p-4"><FileText className="h-4 w-4 text-primary"/><p className="mt-2 text-2xl font-bold">{attributed.toLocaleString("fr-FR")}</p><p className="text-[11px] text-muted-foreground">Ha attribués</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPinned className="h-4 w-4 text-primary"/>Mes parcelles</CardTitle></CardHeader><CardContent>
        {parcelles.length===0?<p className="text-sm text-muted-foreground">Aucune parcelle rattachée pour le moment.</p>:
          <div className="grid gap-2 md:grid-cols-2">{parcelles.map((p:any)=><div key={p.id} className="rounded-xl border p-3"><p className="font-semibold text-sm">{p.nom||p.id_unique||"Parcelle"}</p><p className="text-xs text-muted-foreground">{Number(p.surface_totale_ha||0).toLocaleString("fr-FR")} ha · {p.village||"Localité non renseignée"}</p></div>)}</div>}
      </CardContent></Card>

      {plantations.length>0&&<Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Sprout className="h-4 w-4 text-primary"/>Mes plantations</CardTitle></CardHeader><CardContent className="space-y-2">
        {plantations.map((p:any)=><div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.nom_plantation||p.id_unique||"Plantation"}</p><p className="text-xs text-muted-foreground">{Number(p.superficie_ha||0).toLocaleString("fr-FR")} ha · {p.statut_global||"Suivi"}</p></div><Button size="sm" variant="outline" onClick={onPlantationHub}>Suivi <ArrowRight className="ml-1 h-3.5 w-3.5"/></Button></div>)}
      </CardContent></Card>}

      <div id="messagerie"><MessagerieTab souscripteur={souscripteur}/></div>
      <div className="rounded-xl border bg-white p-3 text-xs text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary"/>Les messages sont rattachés à votre dossier portail et sont traités par l’équipe AgriCapital.</div>
    </main>
  </div>;
}
