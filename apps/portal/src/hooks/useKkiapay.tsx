import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    openKkiapayWidget: (config: KkiapayConfig) => void;
    addKkiapayListener: (event: string, callback: (data: any) => void) => void;
    removeKkiapayListener: (event: string, callback: (data: any) => void) => void;
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
  paymentMethods?: ('momo' | 'card')[];
}

export interface KkiapayResponse {
  transactionId: string;
  isPaymentSucces?: boolean;
  account?: string;
  label?: string;
  method?: string;
  amount?: number;
  fees?: number;
  partnerId?: string;
  performedAt?: string;
  stateData?: Record<string, any>;
  event?: string;
}

export interface KkiapayError {
  reason: string;
  error?: string;
}

export const useKkiapay = () => {
  const scriptLoaded = useRef(false);
  const publicKey = useRef<string | null>(null);
  const successCallback = useRef<((response: KkiapayResponse) => void) | null>(null);
  const failedCallback = useRef<((error: KkiapayError) => void) | null>(null);
  const closeCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (scriptLoaded.current) return;
    const existingScript = document.querySelector('script[src="https://cdn.kkiapay.me/k.js"]');
    if (existingScript) { scriptLoaded.current = true; return; }

    const script = document.createElement('script');
    script.src = 'https://cdn.kkiapay.me/k.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded.current = true;
      console.log('KKiaPay SDK chargé');
      if (window.addKkiapayListener) {
        window.addKkiapayListener('success', (response: KkiapayResponse) => {
          console.log('KKiaPay Success:', response);
          successCallback.current?.(response);
        });
        window.addKkiapayListener('failed', (error: KkiapayError) => {
          console.log('KKiaPay Failed:', error);
          failedCallback.current?.(error);
        });
        window.addKkiapayListener('close', () => {
          console.log('KKiaPay fermé');
          closeCallback.current?.();
        });
      }
    };
    script.onerror = () => console.error('Erreur chargement KKiaPay SDK');
    document.body.appendChild(script);
  }, []);

  // Fetch the public key from edge function (cached)
  const getPublicKey = useCallback(async (): Promise<string | null> => {
    if (publicKey.current) return publicKey.current;
    try {
      const { data, error } = await supabase.functions.invoke('kkiapay-create-transaction', {
        body: { amount: 0, description: 'key-fetch', reference: 'init' }
      });
      if (data?.config?.key) {
        publicKey.current = data.config.key;
        return data.config.key;
      }
    } catch (e) {
      console.error('Impossible de récupérer la clé KKiaPay:', e);
    }
    return null;
  }, []);

  const openPayment = useCallback(async (config: Omit<KkiapayConfig, 'key'>) => {
    if (!window.openKkiapayWidget) {
      console.error('KKiaPay SDK non chargé');
      return false;
    }
    const key = await getPublicKey();
    if (!key) {
      console.error('Clé KKiaPay non disponible');
      return false;
    }
    try {
      window.openKkiapayWidget({
        ...config,
        key,
        sandbox: false,
        countries: ['CI'],
        paymentMethods: config.paymentMethods || ['momo', 'card'],
        theme: '#00643C'
      });
      return true;
    } catch (error) {
      console.error('Erreur ouverture widget KKiaPay:', error);
      return false;
    }
  }, [getPublicKey]);

  const onSuccess = useCallback((callback: (response: KkiapayResponse) => void) => { successCallback.current = callback; }, []);
  const onFailed = useCallback((callback: (error: KkiapayError) => void) => { failedCallback.current = callback; }, []);
  const onClose = useCallback((callback: () => void) => { closeCallback.current = callback; }, []);

  return { openPayment, onSuccess, onFailed, onClose, isLoaded: scriptLoaded.current };
};

export default useKkiapay;
