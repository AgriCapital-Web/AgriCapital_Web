import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatMontant(m: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(m));
}

function formatDate(d: string): string {
  const date = new Date(d);
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString('fr-FR', options);
}

function generateReceiptHTML(data: any): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: white; }
.receipt { max-width: 500px; margin: 0 auto; border: 3px solid transparent; border-image: linear-gradient(135deg, #C5A028 0%, #C5A028 50%, #00643C 50%, #00643C 100%) 1; padding: 30px; position: relative; }
.receipt::before { content: ''; position: absolute; top: 0; right: 0; width: 80px; height: 80px; background: linear-gradient(135deg, transparent 50%, #C5A028 50%); opacity: 0.15; }
.header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #00643C; }
.company-name { color: #00643C; font-size: 22px; font-weight: 900; letter-spacing: 1px; }
.company-sub { color: #C5A028; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
.company-slogan { color: #666; font-size: 10px; margin-top: 4px; }
.receipt-title { background: linear-gradient(135deg, #00643C, #004d2e); color: white; text-align: center; padding: 12px; margin: 15px 0; font-size: 16px; font-weight: 800; letter-spacing: 3px; border-radius: 6px; }
.receipt-ref { text-align: center; font-family: monospace; color: #666; margin-bottom: 15px; font-size: 11px; }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e0e0e0; }
.info-label { color: #888; font-size: 12px; }
.info-value { font-weight: 700; color: #333; font-size: 13px; text-align: right; max-width: 60%; }
.amount-section { background: linear-gradient(135deg, #00643C, #008f4c); color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,100,60,0.3); }
.amount-label { font-size: 12px; opacity: 0.9; }
.amount { font-size: 28px; font-weight: 900; }
.amount-currency { font-size: 14px; }
.status-badge { display: inline-block; background: linear-gradient(135deg, #C5A028, #d4af37); color: white; padding: 6px 18px; border-radius: 20px; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
.signature-section { margin-top: 35px; display: flex; justify-content: space-between; }
.signature-box { width: 45%; text-align: center; }
.signature-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 5px; }
.dg-signature { font-family: 'Brush Script MT', cursive; font-size: 22px; color: #00643C; }
.signature-name { font-size: 10px; color: #666; }
.footer { margin-top: 25px; padding-top: 15px; border-top: 2px solid #C5A028; text-align: center; }
.footer-text { font-size: 10px; color: #666; }
.contact { margin-top: 8px; font-size: 10px; color: #00643C; font-weight: 600; }
.gold-accent { color: #C5A028; }
.watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 60px; color: rgba(0,100,60,0.04); font-weight: 900; letter-spacing: 10px; pointer-events: none; }
</style></head>
<body>
<div class="receipt">
  <div class="watermark">AGRICAPITAL</div>
  <div class="header">
    <div class="company-name">🌴 AGRICAPITAL</div>
    <div class="company-sub">Portail Client</div>
    <div class="company-slogan">Le partenaire idéal des producteurs agricoles</div>
  </div>
  <div class="receipt-title">REÇU DE PAIEMENT</div>
  <div class="receipt-ref">Réf: ${data.reference || '—'}</div>
  <div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${formatDate(data.date_paiement || data.created_at)}</span></div>
    <div class="info-row"><span class="info-label">Souscripteur</span><span class="info-value">${data.souscripteur_nom || '—'}</span></div>
    <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${data.souscripteur_telephone || '—'}</span></div>
    <div class="info-row"><span class="info-label">Plantation</span><span class="info-value">${data.plantation_nom || '—'}</span></div>
    <div class="info-row"><span class="info-label">Type</span><span class="info-value">${data.type_paiement === 'DA' ? "Dépôt Initial" : 'Mensualité'}</span></div>
    <div class="info-row"><span class="info-label">Mode</span><span class="info-value">${data.mode_paiement || 'Mobile Money'}</span></div>
  </div>
  <div class="amount-section">
    <div class="amount-label">Montant payé</div>
    <div class="amount">${formatMontant(data.montant_paye || data.montant)} <span class="amount-currency">F CFA</span></div>
  </div>
  <div style="text-align:center;margin:15px 0;">
    <span class="status-badge">✓ VALIDÉ</span>
  </div>
  <div class="signature-section">
    <div class="signature-box"><div class="signature-line"></div><div class="signature-name">Cachet du Client</div></div>
    <div class="signature-box"><div class="dg-signature">I. Koffi</div><div class="signature-name">Inocent KOFFI — PDG</div><div style="font-size:9px;color:#999;">Signature électronique</div></div>
  </div>
  <div class="footer">
    <div class="footer-text">Ce reçu fait foi de paiement. Conservez-le précieusement.</div>
    <div class="contact">📞 +225 05 64 55 17 17 | 🌐 www.agricapital.ci</div>
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller to prevent leaking PII
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    const callerId = claimsData.claims.sub as string;

    const { paiement_id, reference } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authorization: caller must be staff/admin OR own the paiement (via souscripteurs.user_id)
    const { data: isStaffData } = await supabase.rpc("is_staff", { _user_id: callerId });
    const isStaff = isStaffData === true;

    let query = supabase.from('paiements')
      .select('*, souscripteurs(user_id, nom_complet, telephone, id_unique), plantations(nom_plantation, id_unique)');

    if (paiement_id) query = query.eq('id', paiement_id);
    else if (reference) query = query.eq('reference', reference);
    else throw new Error("paiement_id ou reference requis");

    const { data: paiement, error } = await query.maybeSingle();
    if (error || !paiement) throw new Error("Paiement introuvable");

    const ownerUserId = (paiement.souscripteurs as any)?.user_id;
    if (!isStaff && ownerUserId !== callerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Accès refusé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const receiptData = {
      reference: paiement.reference,
      date_paiement: paiement.date_paiement,
      created_at: paiement.created_at,
      souscripteur_nom: (paiement.souscripteurs as any)?.nom_complet,
      souscripteur_telephone: (paiement.souscripteurs as any)?.telephone,
      plantation_nom: (paiement.plantations as any)?.nom_plantation || (paiement.plantations as any)?.id_unique,
      type_paiement: paiement.type_paiement,
      mode_paiement: paiement.mode_paiement,
      montant: paiement.montant,
      montant_paye: paiement.montant_paye,
    };

    const html = generateReceiptHTML(receiptData);

    return new Response(
      JSON.stringify({ success: true, html, data: receiptData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Receipt error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
