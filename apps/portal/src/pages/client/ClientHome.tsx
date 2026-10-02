import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { Loader2, ArrowRight, MessageCircle, ShieldCheck, KeyRound, ArrowLeft, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PortalAccessSupportDialog from "@/components/client/PortalAccessSupportDialog";

interface ClientHomeProps {
  onLogin: (client: any, plantations: any[], paiements: any[]) => void;
}
type Step = "phone" | "setup" | "login" | "demo";

const ClientHome = ({ onLogin }: ClientHomeProps) => {
  const { toast } = useToast();
  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [accessCode, setAccessCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);\n  const [demoData, setDemoData] = useState<any>(null);

  useEffect(() => { document.title = "Portail Client | AgriCapital"; }, []);

  const cleanPhone = () => telephone.replace(/\D/g, "").slice(0, 10);
  const formatPhoneDisplay = (value: string) => value.replace(/\D/g, "").slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setTelephone(e.target.value.replace(/\D/g, "").slice(0, 10));

  const saveSession = (data: any, token?: string, demo = false, demoToken?: string, demoCode?: string) => {
    const client = data.client || data.souscripteur;
    sessionStorage.setItem("agri_client", JSON.stringify(client));
    sessionStorage.setItem("agri_souscripteur", JSON.stringify(client));
    sessionStorage.setItem("agri_plantations", JSON.stringify(data.plantations || []));
    sessionStorage.setItem("agri_paiements", JSON.stringify(data.paiements || []));
    sessionStorage.setItem("agri_demo", demo ? "1" : "0");
    if (token) sessionStorage.setItem("agri_portal_access_token", token);
    else sessionStorage.removeItem("agri_portal_access_token");
    if (demoToken) sessionStorage.setItem("agri_demo_token", demoToken);
    else sessionStorage.removeItem("agri_demo_token");
    if (demoCode) sessionStorage.setItem("agri_demo_code", demoCode);
    else sessionStorage.removeItem("agri_demo_code");
    onLogin(client, data.plantations || [], data.paiements || []);
  };

  const saveDemoSession = (data: any) => {
    saveSession(data, undefined, true, data.demo_token || sessionStorage.getItem("agri_demo_token") || undefined, data.demo_code || sessionStorage.getItem("agri_demo_code") || undefined);
  };

  const loadRealClient = async (token: string) => {
    const { data, error } = await supabase.functions.invoke("client-portal-data", { body: { access_token: token } });
    if (error || !data?.success) throw new Error(data?.error || error?.message || "Impossible de charger votre espace client.");
    saveSession(data, token);
  };

  const handlePhoneContinue = async () => {
    const phone = cleanPhone();
    if (phone.length < 8) {
      toast({ variant: "destructive", title: "Numéro incomplet", description: "Veuillez saisir un numéro valide." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", { body: { action: "inspect", telephone: phone } });

      if (!error && data?.success) {
        setClientName(data.nom_complet || "");
        setAccessCode("");
        setConfirmCode("");
        setDemoData(null);
        setStep(data.needs_access_code_setup ? "setup" : "login");
        return;
      }

      // Retour au parcours historique : numéro inconnu => démonstration,
      // sans SMS/OTP et sans création de données CRM.
      const demoResponse = await supabase.functions.invoke("subscriber-lookup", { body: { telephone: phone } });
      if (demoResponse.error || !demoResponse.data?.success || !demoResponse.data?.demo) {
        throw new Error(data?.error || error?.message || demoResponse.data?.error || demoResponse.error?.message || "Vérification impossible.");
      }

      setClientName("");
      setAccessCode("");
      setConfirmCode("");
      setDemoData(demoResponse.data);
      setStep("demo");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message || "Connexion impossible." });
    } finally { setLoading(false); }
  };

  const handleSetup = async () => {
    if (!/^\d{4}$/.test(accessCode) || accessCode !== confirmCode) {
      toast({ variant: "destructive", title: "Code invalide", description: "Les deux champs doivent contenir le même code à 4 chiffres." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", {
        body: { action: "setup", telephone: cleanPhone(), code: accessCode, confirm_code: confirmCode }
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Enregistrement impossible.");
      await loadRealClient(data.access_token);
      sessionStorage.setItem("agri_access_code_saved", "1");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message || "Impossible d'enregistrer le code." });
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!/^\d{4}$/.test(accessCode)) {
      toast({ variant: "destructive", title: "Code requis", description: "Veuillez saisir votre code d'accès à 4 chiffres." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", { body: { action: "login", telephone: cleanPhone(), code: accessCode } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Code incorrect.");
      await loadRealClient(data.access_token);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Connexion refusée", description: e.message || "Code incorrect." });
    } finally { setLoading(false); }
  };

  const handleDemoEnter = () => {
    if (!demoData?.demo_token || !demoData?.demo_code) {
      toast({ variant: "destructive", title: "Démonstration indisponible", description: "Veuillez relancer la vérification du numéro." });
      return;
    }
    saveDemoSession(demoData);
  };

  const reset = () => {
    setStep("phone");
    setAccessCode("");
    setConfirmCode("");
    setClientName("");
    setDemoData(null);
  };

  const codeInput = (value: string, setter: (v: string) => void) => (
    <Input value={value} onChange={(e) => setter(e.target.value.replace(/\D/g, "").slice(0, 4))}
      inputMode="numeric" maxLength={4} autoComplete="one-time-code" type="password"
      placeholder="••••" className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-semibold" />
  );

  const welcomeText = clientName ? "Bienvenue, " + clientName + "." : "Saisissez votre code d'accès à 4 chiffres.";

  return (
    <>
      <Helmet>
        <title>Portail Client | AgriCapital</title>
        <meta name="description" content="Accédez à votre espace client AgriCapital." />
      </Helmet>
      <main className="min-h-screen bg-gradient-to-b from-[#F7FAF8] to-white flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <img src={logoWhiteBg} alt="AgriCapital" className="h-16 w-auto object-contain" />
          </div>
          <section className="rounded-3xl border border-[#E3EAE5] bg-white p-6 shadow-xl shadow-black/5 sm:p-8">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF5EF] text-[#00643C]">
                {step === "phone" ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
              </div>
              <h1 className="text-2xl font-bold text-[#123326]">Votre espace client</h1>
              <p className="mt-2 text-sm text-[#68756E]">
                {step === "phone" ? "Connectez-vous avec le numéro utilisé lors de votre contractualisation."
                  : step === "setup" ? "Créez votre code d'accès personnel."
                  : step === "demo" ? "Ce numéro n'est pas encore enregistré : découvrez le portail en mode démonstration."
                  : welcomeText}
              </p>
            </div>

            {step !== "phone" && (
              <button type="button" onClick={reset} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#00643C] hover:underline">
                <ArrowLeft className="h-4 w-4" /> Modifier le numéro
              </button>
            )}

            {step === "phone" && (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#24352D]">Numéro de téléphone</label>
                  <Input type="tel" inputMode="numeric" autoComplete="tel" value={formatPhoneDisplay(telephone)}
                    onChange={handlePhoneChange} onKeyDown={(e) => { if (e.key === "Enter") void handlePhoneContinue(); }}
                    placeholder="07 00 00 00 00" className="h-14 rounded-xl text-lg" />
                </div>
                <Button onClick={() => void handlePhoneContinue()} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                  {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Vérification…</> : <>Continuer <ArrowRight className="ml-2 h-5 w-5" /></>}
                </Button>
              </div>
            )}

            {step === "setup" && (
              <div className="space-y-5">
                <div className="rounded-xl bg-[#F5F8F6] p-4 text-sm text-[#53625A]">
                  <div className="flex items-center gap-2 font-semibold text-[#234137]"><Sparkles className="h-4 w-4 text-[#00643C]" /> Première connexion</div>
                  <p className="mt-1">Choisissez un code à 4 chiffres pour vos prochaines connexions.</p>
                </div>
                <div><label className="mb-2 block text-sm font-semibold text-[#24352D]">Nouveau code</label>{codeInput(accessCode, setAccessCode)}</div>
                <div><label className="mb-2 block text-sm font-semibold text-[#24352D]">Confirmer le code</label>{codeInput(confirmCode, setConfirmCode)}</div>
                <Button onClick={() => void handleSetup()} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                  {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Création…</> : <>Créer mon accès <CheckCircle2 className="ml-2 h-5 w-5" /></>}
                </Button>
              </div>
            )}

            {step === "demo" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-[#E5C46A] bg-[#FFF9E8] p-5 text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-[#B47A00]" />
                  <p className="text-sm font-semibold text-[#5E4700]">Mode démonstration</p>
                  <p className="mt-1 text-xs text-[#76651E]">Aucune donnée réelle ne sera créée ou modifiée.</p>
                  <div className="mt-4 rounded-xl bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-[#7B7564]">Code de démonstration</p>
                    <p className="mt-1 text-3xl font-black tracking-[0.35em] text-[#00643C]">{demoData?.demo_code || "----"}</p>
                  </div>
                </div>
                <Button onClick={handleDemoEnter} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                  Explorer la démonstration <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}

            {step === "login" && (
              <div className="space-y-5">
                <div className="rounded-xl bg-[#F5F8F6] p-4 text-center text-sm text-[#53625A]">
                  <Lock className="mx-auto mb-2 h-5 w-5 text-[#00643C]" />
                  Saisissez votre code d'accès à 4 chiffres.
                </div>
                {codeInput(accessCode, setAccessCode)}
                <Button onClick={() => void handleLogin()} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                  {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion…</> : <>Accéder à mon espace <ArrowRight className="ml-2 h-5 w-5" /></>}
                </Button>
              </div>
            )}

            <div className="mt-7 border-t border-[#E8ECE9] pt-5 text-center">
              <p className="mb-3 text-xs text-[#78847E]">Besoin d'aide pour accéder à votre espace ?</p>
              <Button variant="outline" onClick={() => setSupportOpen(true)} className="h-11 rounded-xl border-[#D8E2DC] text-[#00643C]">
                <MessageCircle className="mr-2 h-4 w-4" /> Contacter AgriCapital
              </Button>
            </div>
          </section>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#7A867F]">
            <ShieldCheck className="h-3.5 w-3.5" /> Accès sécurisé à votre espace personnel
          </p>
        </div>
      </main>
      <PortalAccessSupportDialog open={supportOpen} onOpenChange={setSupportOpen} initialPhone={cleanPhone()} />
    </>
  );
};

export default ClientHome;
