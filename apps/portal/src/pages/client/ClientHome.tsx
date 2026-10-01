import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { Loader2, ArrowRight, MessageCircle, ShieldCheck, KeyRound, ArrowLeft, Lock, Sparkles, CheckCircle2, Copy } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PortalAccessSupportDialog from "@/components/client/PortalAccessSupportDialog";

interface ClientHomeProps { onLogin: (client: any, plantations: any[], paiements: any[]) => void; }
type Step = "phone" | "setup" | "login";

const ClientHome = ({ onLogin }: ClientHomeProps) => {
  const { toast } = useToast();
  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [accessCode, setAccessCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [clientName, setClientName] = useState<string>("");
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => { document.title = "Portail Client | AgriCapital"; }, []);

  const cleanPhone = () => telephone.replace(/\D/g, "").slice(0, 10);
  const formatPhoneDisplay = (value: string) => value.replace(/\D/g, "").slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelephone(e.target.value.replace(/\D/g, "").slice(0, 10));
  };

  const saveSession = (data: any, token?: string) => {
    const client = data.client || data.souscripteur;
    sessionStorage.setItem("agri_client", JSON.stringify(client));
    sessionStorage.setItem("agri_souscripteur", JSON.stringify(client));
    sessionStorage.setItem("agri_plantations", JSON.stringify(data.plantations || []));
    sessionStorage.setItem("agri_paiements", JSON.stringify(data.paiements || []));
    if (token) sessionStorage.setItem("agri_portal_access_token", token);
    sessionStorage.setItem("agri_demo", "0");
    sessionStorage.removeItem("agri_demo_token");
    sessionStorage.removeItem("agri_demo_code");
    onLogin(client, data.plantations || [], data.paiements || []);
  };

  const loadRealClient = async (token: string) => {
    const { data, error } = await supabase.functions.invoke("client-portal-data", { body: { access_token: token } });
    if (error || !data?.success) throw new Error(data?.error || error?.message || "Impossible de charger votre espace client.");
    saveSession(data, token);
  };

  const handlePhoneContinue = async () => {
    const phone = cleanPhone();
    if (phone.length < 8) { toast({ variant: "destructive", title: "Numéro incomplet", description: "Veuillez saisir un numéro valide." }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", { body: { action: "inspect", telephone: phone } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Vérification impossible.");
      if (data.needs_access_code_setup) { setAccessCode(""); setConfirmCode(""); setClientName(data.nom_complet || ""); setStep("setup"); }
      else { setAccessCode(""); setClientName(data.nom_complet || ""); setStep("login"); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message || "Connexion impossible." });
    } finally { setLoading(false); }
  };

  const handleSetup = async () => {
    if (!/^\d{4}$/.test(accessCode) || accessCode !== confirmCode) { toast({ variant: "destructive", title: "Code invalide", description: "Les deux champs doivent contenir le même code à 4 chiffres." }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", { body: { action: "setup", telephone: cleanPhone(), code: accessCode, confirm_code: confirmCode } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Enregistrement impossible.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadRealClient(data.access_token);
      sessionStorage.setItem("agri_access_code_saved", "1");
    } catch (e: any) { toast({ variant: "destructive", title: "Erreur", description: e.message || "Impossible d'enregistrer le code." }); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!/^\d{4}$/.test(accessCode)) { toast({ variant: "destructive", title: "Code requis", description: "Veuillez saisir votre code d'accès à 4 chiffres." }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", { body: { action: "login", telephone: cleanPhone(), code: accessCode } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Code incorrect.");
      await loadRealClient(data.access_token);
    } catch (e: any) { toast({ variant: "destructive", title: "Connexion refusée", description: e.message || "Code incorrect." }); }
    finally { setLoading(false); }
  };


