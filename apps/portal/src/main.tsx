import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initCacheBuster } from "./utils/cacheBuster";

// Enregistre le Service Worker unique de la PWA : cache, Push et clics notification.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("AgriCapital Service Worker registration failed:", error);
    });
  });
}

// Cache-busting PWA : détecte les nouveaux déploiements et force le reload
// pour éviter tout affichage d'une ancienne page depuis un cache périmé.
void initCacheBuster();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
