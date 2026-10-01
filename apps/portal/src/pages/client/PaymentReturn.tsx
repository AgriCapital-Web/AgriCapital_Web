import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { CheckCircle, XCircle, Loader2, Home, RefreshCw, Download, Printer } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PaymentReturnProps { onBack: () => void; }

const PaymentReturn = ({ onBack }: PaymentReturnProps) => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [paiement, setPaiement] = useState<any>(null);
  const [checkCount, setCheckCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const reference = searchParams.get('reference') || searchParams.get('ref');
  const urlStatus = searchParams.get('status');
  const transactionId = searchParams.get('id') || searchParams.get('transaction_id') || searchParams.get('transactionId');

  const fetchReceipt = async (ref: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt', { body: { reference: ref } });
      if (!error && data?.html) setReceiptHtml(data.html);
    } catch (e) { console.error('Receipt fetch error:', e); }
  };

  useEffect(() => {
    const check = async () => {
      if (!reference && !transactionId) { setStatus('pending'); return; }
      try {
        const { data: statusData } = await supabase.functions.invoke('create-payment', {
          body: { action: 'status', reference, transaction_id: transactionId }
        });
        const db = statusData?.paiement;
        if (db) {
          setPaiement(db);
          if (db.statut === 'valide') { setStatus('success'); fetchReceipt(db.reference); return; }
          if (db.statut === 'echec' || db.statut === 'rejete') { setStatus('error'); return; }
          if (transactionId) {
            try {
              const { data, error } = await supabase.functions.invoke('kkiapay-verify-transaction', { body: { transactionId } });
              if (!error && data?.success) {
                const ok = data.transaction?.isPaymentSuccessful || data.transaction?.status?.toLowerCase() === 'success';
                const fail = ['failed', 'canceled'].includes(data.transaction?.status?.toLowerCase());
                if (ok || fail) {
                  const s = ok ? 'valide' : 'echec';
                  if (ok) {
                    await supabase.functions.invoke('create-payment', {
                      body: {
                        action: 'confirm',
                        reference: db.reference,
                        kkiapay_transaction_id: transactionId,
                        montant_paye: db.metadata?.client_debit_amount ?? db.montant,
                        method: data.transaction?.source || data.transaction?.method || null,
                        fees: data.transaction?.fees || 0,
                        kkiapay_amount: data.transaction?.amount ?? null,
                        client_debit_amount: db.metadata?.client_debit_amount ?? db.montant,
                        fee_absorption_rate: db.metadata?.fee_absorption_rate ?? 0,
                      }
                    });
                  }
                  setPaiement({ ...db, statut: s, montant_paye: ok ? (db.metadata?.client_debit_amount ?? db.montant) : 0 });
                  if (ok) fetchReceipt(db.reference);
                  setStatus(ok ? 'success' : 'error'); return;
                }
              }
            } catch {}
          }
          // SECURITY: a payment is NEVER confirmed based on the URL `status`
          // parameter alone — that value is fully attacker-controlled. Only the
          // KKiaPay-verified branch above may transition a payment to `valide`.
          // If we reach this point without a verified transactionId, we simply
          // keep polling until the webhook or a verified verify call arrives.

          if (checkCount < 10) setTimeout(() => setCheckCount(c => c + 1), 2500);
          setStatus('pending');
        } else { setStatus('pending'); }
      } catch { setStatus('pending'); }
    };
    check();
  }, [reference, transactionId, checkCount, urlStatus]);

  const fmt = (m: number) => new Intl.NumberFormat("fr-FR").format(m || 0) + " F CFA";

  const handlePDF = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const el = receiptRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
      const w = pdf.internal.pageSize.getWidth();
      pdf.addImage(img, 'PNG', 0, 0, w, (canvas.height * w) / canvas.width);
      pdf.save(`recu-agri-${paiement?.reference || 'paiement'}.pdf`);
    } catch (e) { console.error('PDF:', e); } finally { setDownloading(false); }
  };

  const handlePrintReceipt = () => {
    if (!receiptHtml) { window.print(); return; }
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.print(); return; }
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #00643C, #003320)' }}>
      <header className="py-5 px-4"><div className="container mx-auto flex justify-center"><div className="bg-white rounded-xl p-2"><img src={logoWhiteBg} alt="AgriCapital" className="h-14 sm:h-16 object-contain" /></div></div></header>

      <main className="flex-1 flex items-start justify-center px-4 py-4 pb-8">
        <Card className="w-full max-w-sm border-0 shadow-2xl overflow-hidden rounded-2xl" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
          <CardContent className="p-6 text-center space-y-4">
            {status === 'loading' && (
              <><Loader2 className="h-16 w-16 text-primary animate-spin mx-auto" /><h2 className="text-lg font-bold">Vérification...</h2><p className="text-sm text-muted-foreground">Veuillez patienter</p></>
            )}

            {status === 'success' && paiement && (
              <>
                <div className="relative h-20 w-20 mx-auto">
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
                  <div className="relative h-20 w-20 bg-green-100 rounded-full flex items-center justify-center"><CheckCircle className="h-12 w-12 text-green-500" /></div>
                </div>
                <h2 className="text-xl font-black text-green-600">Paiement réussi !</h2>

                <div ref={receiptRef} className="bg-muted/30 rounded-2xl p-4 text-left border text-xs space-y-2 card-brand-subtle">
                  <div className="flex justify-between pb-2 border-b border-dashed mb-2">
                    <div><p className="font-bold text-primary text-sm">REÇU</p><p className="text-[9px] text-muted-foreground">AgriCapital CI</p></div>
                    <p className="text-xs font-semibold">{paiement.date_paiement ? format(new Date(paiement.date_paiement), "dd/MM/yy HH:mm", { locale: fr }) : format(new Date(), "dd/MM/yy HH:mm", { locale: fr })}</p>
                  </div>
                  {[
                    ['Référence', paiement.reference || '—'],
                    ['Souscripteur', paiement.souscripteurs?.nom_complet || '—'],
                    ['Téléphone', paiement.souscripteurs?.telephone || '—'],
                    ['Plantation', paiement.plantations?.nom_plantation || paiement.plantations?.id_unique || '—'],
                    ['Type', paiement.type_paiement === 'DA' ? "Dépôt Initial" : 'Mensualité'],
                    ['Mode', paiement.mode_paiement || 'Mobile Money'],
                  ].map(([l, v], i) => (
                    <div key={i} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-semibold text-right max-w-[55%] truncate">{v}</span></div>
                  ))}
                  <div className="pt-2 border-t border-dashed flex justify-between items-center">
                    <span className="font-black text-sm">TOTAL</span>
                    <span className="text-lg font-black text-primary">{fmt(paiement.montant_paye || paiement.montant)}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground text-center pt-1">AgriCapital — pay.agricapital.ci — +225 05 64 55 17 17</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handlePDF} disabled={downloading} className="h-10 gap-1.5 text-xs rounded-xl">
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}PDF
                  </Button>
                  <Button variant="outline" onClick={handlePrintReceipt} className="h-10 gap-1.5 text-xs rounded-xl"><Printer className="h-3.5 w-3.5" />Imprimer</Button>
                </div>
                <Button onClick={onBack} className="w-full h-11 gap-2 rounded-xl btn-brand"><Home className="h-4 w-4" />Retour</Button>
              </>
            )}

            {status === 'success' && !paiement && (
              <><CheckCircle className="h-20 w-20 text-green-500 mx-auto" /><h2 className="text-xl font-bold text-green-600">Paiement réussi !</h2><Button onClick={onBack} className="w-full h-12 gap-2 rounded-xl btn-brand"><Home className="h-5 w-5" />Retour</Button></>
            )}

            {status === 'error' && (
              <>
                <XCircle className="h-20 w-20 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-destructive">Paiement échoué</h2>
                <p className="text-sm text-muted-foreground">Le paiement n'a pas pu être traité.</p>
                {paiement && (
                  <div className="bg-destructive/5 rounded-xl p-3 text-left text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span className="font-bold">{fmt(paiement.montant)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Réf.</span><span className="font-mono text-[10px]">{paiement.reference}</span></div>
                  </div>
                )}
                <Button onClick={onBack} className="w-full h-11 gap-2 rounded-xl btn-brand"><RefreshCw className="h-4 w-4" />Réessayer</Button>
              </>
            )}

            {status === 'pending' && (
              <>
                <div className="h-20 w-20 mx-auto flex items-center justify-center bg-amber-50 rounded-full"><Loader2 className="h-12 w-12 text-accent animate-spin" /></div>
                <h2 className="text-lg font-bold text-accent">Traitement en cours...</h2>
                <p className="text-sm text-muted-foreground">Vérification automatique</p>
                {checkCount < 5 && <p className="text-xs text-muted-foreground">Tentative {checkCount + 1}/5</p>}
                <Button variant="outline" onClick={() => setCheckCount(c => c + 1)} className="w-full gap-2 h-10 text-sm rounded-xl"><RefreshCw className="h-4 w-4" />Actualiser</Button>
                <Button onClick={onBack} className="w-full h-10 text-sm rounded-xl btn-brand">Retour</Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 text-center">
        <p className="text-xs text-white/50">© {new Date().getFullYear()} AgriCapital</p>
      </footer>
    </div>
  );
};

export default PaymentReturn;
