import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ClientHome from "./client/ClientHome";
import ClientDashboard from "./client/ClientDashboard";
import ClientPayment from "./client/ClientPayment";
import ClientPortfolio from "./client/ClientPortfolio";
import ClientPaymentHistory from "./client/ClientPaymentHistory";
import ClientStatistics from "./client/ClientStatistics";
import PaymentReturn from "./client/PaymentReturn";
import ClientPlantationHub from "./client/ClientPlantationHub";
import StakeholderDashboard from "./client/StakeholderDashboard";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { supabase } from "@/integrations/supabase/client";
import SyncStatusBanner from "@/components/client/SyncStatusBanner";

type View = 'home' | 'dashboard' | 'payment' | 'portfolio' | 'history' | 'statistics' | 'payment-return' | 'plantation-hub';

interface PaymentOptions {
  prefillAmount?: number;
  prefillType?: 'arriere' | 'avance' | 'solde_initial';
}

const ClientPortal = () => {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>('home');
  const [client, setClient] = useState<any>(null);
  const [plantations, setPlantations] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({});

  // Check if returning from payment
  useEffect(() => {
    const status = searchParams.get('status');
    const reference = searchParams.get('reference') || searchParams.get('ref');
    const transactionId = searchParams.get('id') || searchParams.get('transaction_id');
    
    if (status || reference || transactionId) {
      setView('payment-return');
    }
  }, [searchParams]);

  // Restore and revalidate the private portal session.
  useEffect(() => {
    if (view !== "home") return;
    const token = sessionStorage.getItem("agri_portal_access_token");
    const isDemo = sessionStorage.getItem("agri_demo") === "1";
    const restore = async () => {
      if (isDemo) {
        const storedClient = JSON.parse(sessionStorage.getItem("agri_client") || "null");
        if (!storedClient) return;
        const { data, error } = await supabase.functions.invoke("subscriber-lookup", {
          body: {
            telephone: storedClient.telephone,
            silent: true,
            demo_token: sessionStorage.getItem("agri_demo_token"),
            demo_code: sessionStorage.getItem("agri_demo_code"),
          },
        });
        if (!error && data?.success && data?.demo) {
          setClient(data.souscripteur || data.client);
          setPlantations(data.plantations || []);
          setPaiements(data.paiements || []);
          setView("dashboard");
          return;
        }
        sessionStorage.removeItem("agri_demo");
        sessionStorage.removeItem("agri_demo_token");
        sessionStorage.removeItem("agri_demo_code");
        return;
      }

      if (!token) return;
      const { data, error } = await supabase.functions.invoke("client-portal-data", { body: { access_token: token } });
      if (!error && data?.success) {
        setClient(data.client || data.souscripteur);
        setPlantations(data.plantations || []);
        setPaiements(data.paiements || []);
        setView("dashboard");
      } else {
        sessionStorage.removeItem("agri_portal_access_token");
        sessionStorage.removeItem("agri_client");
        sessionStorage.removeItem("agri_souscripteur");
        sessionStorage.removeItem("agri_plantations");
        sessionStorage.removeItem("agri_paiements");
        sessionStorage.removeItem("agri_demo");
      }
    };
    void restore();
  }, [view]);


  // PWA meta
  useEffect(() => {
    document.title = "Espace Client | AgriCapital";
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) manifestLink.setAttribute('href', '/manifest-client.json');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', '#00643C');
  }, []);

  // SEO: indexable only on the public login screen ('home').
  // Once authenticated / navigating private views, switch to noindex,nofollow
  // so search engines never list internal pages (dashboard, paiement, portefeuille...).
  useEffect(() => {
    const isPrivate = view !== 'home';
    const ensure = (name: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      return el;
    };
    ensure('robots').setAttribute(
      'content',
      isPrivate ? 'noindex, nofollow, noarchive, nosnippet, noimageindex' : 'index, follow'
    );
    ensure('googlebot').setAttribute(
      'content',
      isPrivate ? 'noindex, nofollow, noarchive' : 'index, follow'
    );
  }, [view]);

  // Auto-refresh continu : Realtime sur offres/promotions + polling 15s.
  // Garantit que tout changement CRM (prix, offre, promo, plantation, paiement)
  // est répercuté sur le portail sans action manuelle du client.
  const { status, lastSync } = useAutoRefresh(
    client?.telephone,
    (s, plts, pays) => {
      setClient(s);
      setPlantations(plts);
      setPaiements(pays);
    },
  );


  const handleLogin = (sous: any, plants: any[], paies: any[]) => {
    setClient(sous);
    setPlantations(plants);
    setPaiements(paies);
    setView('dashboard');
  };

  const handleLogout = () => {
    setClient(null);
    setPlantations([]);
    setPaiements([]);
    sessionStorage.removeItem('agri_client');
    sessionStorage.removeItem('agri_plantations');
    sessionStorage.removeItem('agri_paiements');
    sessionStorage.removeItem("agri_portal_access_token");
    sessionStorage.removeItem("agri_demo");
    setView('home');
  };

  const handleBackFromPaymentReturn = () => {
    window.history.replaceState({}, '', window.location.pathname);
    if (client) {
      setView('dashboard');
    } else {
      setView('home');
    }
  };

  return (
    <>
      <InstallPrompt />

      {client && <SyncStatusBanner status={status} lastSync={lastSync} />}

      
      {view === 'home' && <ClientHome onLogin={handleLogin} />}
      
      {view === 'dashboard' && client?.portal_primary_role !== "client" ? (
        <StakeholderDashboard
          client={client}
          plantations={plantations}
          onPlantationHub={() => setView('plantation-hub')}
          onLogout={handleLogout}
        />
      ) : view === 'dashboard' && (
        <ClientDashboard
          client={client}
          plantations={plantations}
          paiements={paiements}
          syncStatus={status}
          lastSync={lastSync}

          onPayment={(opts?: PaymentOptions) => {
            setPaymentOptions(opts || {});
            setView('payment');
          }}
          onPortfolio={() => setView('portfolio')}
          onHistory={() => setView('history')}
          onStatistics={() => setView('statistics')}
          onPlantationHub={() => setView('plantation-hub')}
          onLogout={handleLogout}
        />
      )}

      {view === 'plantation-hub' && (
        <ClientPlantationHub
          client={client}
          plantations={plantations}
          onBack={() => setView('dashboard')}
        />
      )}
      
      {view === 'payment' && (
        <ClientPayment
          client={client}
          plantations={plantations}
          paiements={paiements}
          onBack={() => setView('dashboard')}
          prefillAmount={paymentOptions.prefillAmount}
          prefillType={paymentOptions.prefillType}
        />
      )}
      
      {view === 'portfolio' && (
        <ClientPortfolio
          client={client}
          plantations={plantations}
          paiements={paiements}
          onBack={() => setView('dashboard')}
        />
      )}

      {view === 'history' && (
        <ClientPaymentHistory
          client={client}
          plantations={plantations}
          paiements={paiements}
          onBack={() => setView('dashboard')}
        />
      )}

      {view === 'statistics' && (
        <ClientStatistics
          client={client}
          plantations={plantations}
          paiements={paiements}
          onBack={() => setView('dashboard')}
        />
      )}

      {view === 'payment-return' && (
        <PaymentReturn onBack={handleBackFromPaymentReturn} />
      )}
    </>
  );
};

export default ClientPortal;
