/**
 * Traçage léger des erreurs de synchronisation CRM et des changements
 * d'état temps réel (offline / reconnect), sans dépendance externe.
 *
 * - Conserve les 200 derniers évènements en localStorage (diagnostic hors ligne).
 * - Émet vers Sentry si `window.Sentry` est présent (script chargé côté hébergement),
 *   avec un tag `account` permettant de retrouver directement le compte concerné.
 */

export type TrackedLevel = "info" | "warning" | "error";

export interface TrackedEvent {
  id: string;
  at: string;
  level: TrackedLevel;
  scope: "realtime" | "sync" | "payment" | "auth";
  message: string;
  account?: string | null;
  context?: Record<string, unknown>;
}

const KEY = "agri_error_trace";
const MAX = 200;
export const ERROR_TRACE_EVENT = "agri:error-trace";

export function readTrace(): TrackedEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function trackEvent(e: Omit<TrackedEvent, "id" | "at">): void {
  const full: TrackedEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...e,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([full, ...readTrace()].slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(ERROR_TRACE_EVENT, { detail: full }));
  } catch {
    /* quota */
  }

  const S = (window as any).Sentry;
  if (S) {
    try {
      S.withScope?.((scope: any) => {
        scope.setTag?.("scope", e.scope);
        if (e.account) {
          scope.setTag?.("account", e.account);
          scope.setUser?.({ id: e.account });
        }
        if (e.context) scope.setContext?.("details", e.context);
        if (e.level === "error") S.captureException?.(new Error(e.message));
        else S.captureMessage?.(e.message, e.level);
      });
    } catch {
      /* noop */
    }
  }

  if (e.level === "error") console.error(`[${e.scope}] ${e.message}`, e.context || "");
}

export function clearTrace(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(ERROR_TRACE_EVENT));
  } catch {
    /* noop */
  }
}
