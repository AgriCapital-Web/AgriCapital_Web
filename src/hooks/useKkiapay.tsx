import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    openKkiapayWidget?: (config: KkiapayConfig) => void;
    addKkiapayListener?: (event: string, callback: (data: any) => void) => void;
    removeKkiapayListener?: (event: string, callback: (data: any) => void) => void;
  }
}

export interface KkiapayConfig {
  amount: number;
  key: string;
  sandbox?: boolean;
  email?: string;
  phone?: string;
  name?: string;
  callback?: string;
  data?: Record<string, any>;
  theme?: string;
  countries?: string[];
  paymentMethods?: string[];
}

export interface KkiapayResponse { transactionId: string; isPaymentSucces?: boolean; account?: string; label?: string; method?: string; amount?: number; fees?: number; partnerId?: string; performedAt?: string; stateData?: Record<string, any>; event?: string; }
export interface KkiapayError { reason: string; error?: string; }

const KKIAPAY_PUBLIC_KEY = import.meta.env.VITE_KKIAPAY_PUBLIC_KEY || '193bbb7e7387d1c3ac16ced9d47fe52fad2b228e';

export const useKkiapay = () => {
  const scriptLoaded = useRef(false);
  const loadPromise = useRef<Promise<boolean> | null>(null);
  const successCallback = useRef<((response: KkiapayResponse) => void) | null>(null);
  const failedCallback = useRef<((error: KkiapayError) => void) | null>(null);
  const closeCallback = useRef<(() => void) | null>(null);

  const attachListeners = useCallback(() => {
    if (!window.addKkiapayListener) return;
    window.addKkiapayListener('success', (response: KkiapayResponse) => successCallback.current?.(response));
    window.addKkiapayListener('failed', (error: KkiapayError) => failedCallback.current?.(error));
    window.addKkiapayListener('close', () => closeCallback.current?.());
  }, []);

  const ensureLoaded = useCallback(() => {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (window.openKkiapayWidget) {
      scriptLoaded.current = true;
      return Promise.resolve(true);
    }
    if (loadPromise.current) return loadPromise.current;

    loadPromise.current = new Promise<boolean>((resolve) => {
      const existing = document.querySelector('script[src="https://cdn.kkiapay.me/k.js"]') as HTMLScriptElement | null;
      const finish = (ok: boolean) => {
        scriptLoaded.current = ok;
        if (ok) attachListeners();
        resolve(ok);
      };
      if (existing) {
        const onLoad = () => { existing.removeEventListener("load", onLoad); existing.removeEventListener("error", onError); finish(!!window.openKkiapayWidget); };
        const onError = () => { existing.removeEventListener("load", onLoad); existing.removeEventListener("error", onError); finish(false); };
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
        const timer = window.setInterval(() => {
          if (window.openKkiapayWidget) { window.clearInterval(timer); onLoad(); }
        }, 100);
        window.setTimeout(() => { window.clearInterval(timer); if (!window.openKkiapayWidget) onError(); }, 10000);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.kkiapay.me/k.js';
      script.async = true;
      script.onload = () => finish(!!window.openKkiapayWidget);
      script.onerror = () => finish(false);
      document.body.appendChild(script);
    });
    return loadPromise.current;
  }, [attachListeners]);

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const openPayment = useCallback(async (config: Omit<KkiapayConfig, 'key'>) => {
    const ready = await ensureLoaded();
    if (!ready || !window.openKkiapayWidget) return false;
    try {
      window.openKkiapayWidget({
        ...config,
        key: KKIAPAY_PUBLIC_KEY,
        sandbox: false,
        countries: ['CI'],
        paymentMethods: ['momo', 'card'],
        theme: '#00643C',
        position: 'center',
      });
      return true;
    } catch (error) {
      console.error('Erreur ouverture widget KKiaPay:', error);
      return false;
    }
  }, [ensureLoaded]);

  const onSuccess = useCallback((callback: (response: KkiapayResponse) => void) => { successCallback.current = callback; }, []);
  const onFailed = useCallback((callback: (error: KkiapayError) => void) => { failedCallback.current = callback; }, []);
  const onClose = useCallback((callback: () => void) => { closeCallback.current = callback; }, []);

  return { openPayment, onSuccess, onFailed, onClose, isLoaded: scriptLoaded.current };
};

export default useKkiapay;
