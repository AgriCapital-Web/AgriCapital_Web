/**
 * PWA Cache-Busting silencieux.
 * Détecte les nouveaux déploiements et recharge automatiquement en arrière-plan,
 * sans bannière, toast ou action demandée à l'utilisateur.
 */
declare const __APP_BUILD_ID__: string;

const STORAGE_KEY = 'agc_app_build_id';
const LAST_CHECK_KEY = 'agc_app_last_check';
const POLL_INTERVAL_MS = 20 * 1000;
const VISIBILITY_STALE_MS = 30 * 1000;

const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

async function purgeAllCaches() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch { /* silencieux */ }
}

let reloadInProgress = false;
async function forceReload() {
  if (reloadInProgress) return;
  reloadInProgress = true;
  await purgeAllCaches();
  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}

async function fetchRemoteBuildFingerprint(): Promise<string | null> {
  try {
    const res = await fetch('/index.html?_=' + Date.now(), {
      cache: 'no-store', credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/\/assets\/[^"']*\.js/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

let initialFingerprint: string | null = null;

async function checkForUpdate() {
  const remote = await fetchRemoteBuildFingerprint();
  if (!remote) return;
  if (initialFingerprint === null) {
    initialFingerprint = remote;
    return;
  }
  if (remote !== initialFingerprint) {
    // Nouvelle version : mise à jour totalement silencieuse.
    await forceReload();
  }
}

export async function initCacheBuster() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const hadController = !!navigator.serviceWorker.controller;
      const registration = await navigator.serviceWorker.register('/sw.js?v=' + currentBuildId, {
        updateViaCache: 'none',
      });

      // Toute nouvelle version du SW prend immédiatement la main.
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Pas de reload lors de la toute première prise de contrôle.
        // Si une version existait déjà, le nouveau SW entraîne un reload silencieux.
        if (hadController) void forceReload();
      });

      await registration.update();
      setInterval(() => { void registration.update(); }, 60 * 1000);
    } catch {
      // Le polling index.html reste le filet de sécurité.
    }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== currentBuildId) {
      localStorage.setItem(STORAGE_KEY, currentBuildId);
      await forceReload();
      return;
    }
    localStorage.setItem(STORAGE_KEY, currentBuildId);
  } catch { /* silencieux */ }

  initialFingerprint = await fetchRemoteBuildFingerprint();

  setInterval(() => {
    try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch { /* silencieux */ }
    void checkForUpdate();
  }, POLL_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    if (Date.now() - last > VISIBILITY_STALE_MS) void checkForUpdate();
  });
}

export const APP_BUILD_ID = currentBuildId;
