import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Smartphone, WifiOff, Zap, HardDrive, X, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    // Check if PWA is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsPWAInstalled(isStandalone);
    if (isStandalone) return;

    // Background detection: periodically check if app is not installed
    const checkInterval = setInterval(() => {
      const stillNotInstalled = !window.matchMedia('(display-mode: standalone)').matches 
        && !(window.navigator as any).standalone;
      if (!stillNotInstalled) {
        setIsPWAInstalled(true);
        setShowPrompt(false);
        clearInterval(checkInterval);
      }
    }, 30000); // Check every 30s

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const shouldShowPrompt = () => {
      const dismissed = localStorage.getItem('pwa-install-dismissed-crm');
      const lastDismissed = dismissed ? parseInt(dismissed) : 0;
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      return !dismissed || lastDismissed < threeDaysAgo;
    };

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (shouldShowPrompt()) {
        setTimeout(() => setShowPrompt(true), 1200);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS: also prompt installation
    if (isIOSDevice && !isStandalone && shouldShowPrompt()) {
      setTimeout(() => setShowPrompt(true), 1800);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearInterval(checkInterval);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsPWAInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  useEffect(() => {\n    if (!showPrompt) return;\n    const timer = window.setTimeout(() => setShowPrompt(false), 3000);\n    return () => window.clearTimeout(timer);\n  }, [showPrompt]);\n\n  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed-crm', Date.now().toString());
  };

  if (!showPrompt || isPWAInstalled) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="w-[calc(100vw-1.25rem)] max-w-sm rounded-[28px] border-primary/20 p-4 shadow-2xl sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5 animate-pulse">
              <Smartphone className="h-7 w-7 text-primary" /><Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-accent" />
            </div>
            <div>
              <span className="block">Installer AgriCapital</span>
              <span className="text-sm font-normal text-muted-foreground">Application officielle</span>
            </div>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 mt-4">
              {isIOS ? (
                <div className="space-y-3">
                  <p className="text-foreground font-medium">Pour installer sur votre iPhone/iPad :</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Appuyez sur le bouton <strong>Partager</strong> ⬆️ en bas de Safari</li>
                    <li>Faites défiler et sélectionnez <strong>"Sur l'écran d'accueil"</strong></li>
                    <li>Appuyez sur <strong>Ajouter</strong></li>
                  </ol>
                </div>
              ) : (
                <p className="text-sm">Installez l’application pour la retrouver directement sur l’écran d’accueil, y compris lorsque la connexion est faible ou absente.</p>
              )}
              
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex flex-col items-center gap-1.5 p-2.5 bg-muted rounded-xl">
                  <WifiOff className="h-5 w-5 text-primary" />
                  <span className="text-xs text-center font-medium">Mode hors ligne</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 bg-muted rounded-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-xs text-center font-medium">Plus rapide</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 bg-muted rounded-lg">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <span className="text-xs text-center font-medium">Données locales</span>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-3">
          {!isIOS && deferredPrompt && (
            <Button onClick={handleInstall} size="lg" className="w-full gap-2 animate-pulse bg-gradient-to-r from-red-600 via-primary to-red-600 text-white shadow-lg">
              <Download className="h-5 w-5" />
              Installer maintenant
            </Button>
          )}
          <Button variant="outline" onClick={handleDismiss} className="w-full">
            Plus tard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallPrompt;
