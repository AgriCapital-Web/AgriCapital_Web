import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Smartphone, Sparkles, ShieldCheck } from 'lucide-react';
import { isOnClientPortal } from '@/hooks/useClientPortal';

const ogLogoImage = 'https://storage.googleapis.com/gpt-engineer-file-uploads/OI6nUHN0rMdlKjHmlXGUEQqHcM52/social-images/social-1776354157716-139657.webp';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const isClientPortal = isOnClientPortal();

  useEffect(() => {
    // Détecter iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    
    setIsIOS(isIOSDevice);

    // Ne pas afficher si déjà installé
    if (isInStandaloneMode) return;

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Vérifier si l'utilisateur n'a pas déjà refusé
      const dismissedKey = isClientPortal ? 'pwa-install-dismissed-portail' : 'pwa-install-dismissed-crm';
      const dismissed = localStorage.getItem(dismissedKey);
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Afficher le prompt iOS après un délai
    if (isIOSDevice && !isInStandaloneMode) {
      const dismissedKey = isClientPortal ? 'pwa-install-dismissed-portail' : 'pwa-install-dismissed-crm';
      const dismissed = localStorage.getItem(dismissedKey);
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isClientPortal]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installée');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    const dismissedKey = isClientPortal ? 'pwa-install-dismissed-portail' : 'pwa-install-dismissed-crm';
    localStorage.setItem(dismissedKey, 'true');
  };

  const appName = isClientPortal ? "Portail Client" : "CRM AgriCapital";
  const appDescription = isClientPortal
    ? "Installez le portail sur votre écran d'accueil pour payer et suivre vos plantations plus vite."
    : "Installez AgriCapital pour ouvrir votre espace en plein écran, sans chercher l'adresse.";

  if (!showPrompt) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="max-w-[92vw] overflow-hidden rounded-[2rem] border border-primary/15 bg-card/95 p-0 shadow-2xl backdrop-blur sm:max-w-md">
        <div className="relative bg-[image:var(--gradient-hero)] px-6 pb-7 pt-8 text-primary-foreground">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-36 w-36 rounded-full bg-primary-foreground/15 blur-3xl" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-primary-foreground/25 bg-card p-1.5 shadow-2xl">
              <img src={ogLogoImage} alt="AgriCapital" className="h-full w-full rounded-[1.25rem] object-cover" />
            </div>
            <div className="min-w-0 pt-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-accent" /> App officielle
              </div>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl font-black leading-tight text-primary-foreground">Installer {appName}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-primary-foreground/75">
                  {appDescription}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5">
          <div className="mb-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-3">
              <Smartphone className="mb-2 h-4 w-4 text-primary" />
              <p className="text-[11px] font-bold text-foreground">Plein écran</p>
              <p className="text-[10px] text-muted-foreground">Comme une app mobile</p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3">
              <ShieldCheck className="mb-2 h-4 w-4 text-accent" />
              <p className="text-[11px] font-bold text-foreground">Sécurisé</p>
              <p className="text-[10px] text-muted-foreground">Accès rapide au portail</p>
            </div>
          </div>

          <div className="text-left text-sm text-muted-foreground">
            {isIOS ? (
              <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
                <p className="text-foreground font-medium">Pour installer l'application sur iOS :</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Appuyez sur le bouton <strong>Partager</strong> <span className="inline-block px-2 py-1 bg-muted rounded">⬆️</span></li>
                  <li>Faites défiler et sélectionnez <strong>"Sur l'écran d'accueil"</strong></li>
                  <li>Appuyez sur <strong>Ajouter</strong> en haut à droite</li>
                </ol>
              </div>
            ) : (
              <p className="rounded-2xl bg-muted/40 p-4">Un raccourci moderne sera ajouté à votre téléphone avec le logo AgriCapital.</p>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-6">
          {!isIOS && deferredPrompt && (
            <Button 
              onClick={handleInstall}
              size="lg"
              className="w-full gap-2 rounded-2xl h-14 btn-brand-green shadow-xl"
            >
              <Download className="h-5 w-5" />
              Installer l'application
            </Button>
          )}
          
          <Button 
            variant="outline"
            onClick={handleDismiss}
            className="w-full rounded-2xl"
          >
            Plus tard
          </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Installation gratuite · aucune donnée supplémentaire requise
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallPrompt;