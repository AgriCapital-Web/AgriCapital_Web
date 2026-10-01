const PREVIEW_HOSTS = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];

function registrationAllowed() {
  const host = window.location.hostname;
  const previewHost = host.startsWith("id-preview--") || host.startsWith("preview--") ||
    PREVIEW_HOSTS.some((root) => host === root || host.endsWith(`.${root}`));
  return import.meta.env.PROD && window.top === window.self && !previewHost && new URLSearchParams(location.search).get("sw") !== "off";
}

async function unregisterAppWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations
    .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
    .map((registration) => registration.unregister()));
}

export async function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!registrationAllowed()) {
    await unregisterAppWorkers();
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    immediate: true,
    // Mise à jour automatique et silencieuse des PWA déjà installées
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Vérifie une nouvelle version au démarrage, au retour au premier plan et toutes les 15 min
      const check = () => void registration.update();
      check();
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });
}
