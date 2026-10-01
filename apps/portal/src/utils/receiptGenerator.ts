import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReceiptData {
  reference: string;
  date: Date;
  souscripteurNom: string;
  souscripteurTelephone: string;
  plantationNom: string;
  typePaiement: string;
  montant: number;
  modePaiement: string;
  statut: string;
}

export const generatePaymentReceiptHTML = (data: ReceiptData): string => {
  const formatMontant = (m: number) => new Intl.NumberFormat("fr-FR").format(m);
  
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <style>
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
        .footer { margin-top: 25px; padding-top: 15px; border-top: 2px solid #C5A028; text-align: center; }
        .signature-section { margin-top: 35px; display: flex; justify-content: space-between; }
        .signature-box { width: 45%; text-align: center; }
        .signature-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 5px; }
        .dg-signature { font-family: 'Brush Script MT', cursive; font-size: 22px; color: #00643C; }
        .signature-name { font-size: 10px; color: #666; }
        .footer-text { font-size: 10px; color: #666; }
        .contact { margin-top: 8px; font-size: 10px; color: #00643C; font-weight: 600; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 60px; color: rgba(0,100,60,0.04); font-weight: 900; letter-spacing: 10px; pointer-events: none; }
      </style>
    </head>
    <body>
      <div class="receipt" id="receipt">
        <div class="watermark">AGRICAPITAL</div>
        <div class="header">
          <div class="company-name">🌴 AGRICAPITAL</div>
          <div class="company-sub">Portail Client</div>
          <div class="company-slogan">Le partenaire idéal des producteurs agricoles</div>
        </div>
        
        <div class="receipt-title">REÇU DE PAIEMENT</div>
        
        <div class="receipt-ref">Réf: ${data.reference}</div>
        
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${format(data.date, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Souscripteur</span>
            <span class="info-value">${data.souscripteurNom}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Téléphone</span>
            <span class="info-value">${data.souscripteurTelephone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Plantation</span>
            <span class="info-value">${data.plantationNom}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Type</span>
            <span class="info-value">${data.typePaiement}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mode de paiement</span>
            <span class="info-value">${data.modePaiement}</span>
          </div>
        </div>
        
        <div class="amount-section">
          <div class="amount-label">Montant payé</div>
          <div class="amount">${formatMontant(data.montant)} <span class="amount-currency">F CFA</span></div>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <span class="status-badge">✓ ${data.statut === 'valide' ? 'VALIDÉ' : data.statut.toUpperCase()}</span>
        </div>
        
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-name">Cachet du Client</div>
          </div>
          <div class="signature-box">
            <div class="dg-signature">I. Koffi</div>
            <div class="signature-name">Inocent KOFFI - PDG</div>
            <div style="font-size: 10px; color: #999;">Signature électronique</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="qr-placeholder">QR CODE</div>
          <div class="footer-text">
            Ce reçu fait foi de paiement. Conservez-le précieusement.
          </div>
          <div class="contact">
            📞 +225 05 64 55 17 17 | 🌐 www.agricapital.ci
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const downloadReceiptAsPDF = async (data: ReceiptData): Promise<void> => {
  // Créer un iframe caché pour le rendu
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '600px';
  iframe.style.height = '900px';
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Could not access iframe document');
  }
  
  iframeDoc.open();
  iframeDoc.write(generatePaymentReceiptHTML(data));
  iframeDoc.close();
  
  // Attendre le chargement
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const receiptElement = iframeDoc.getElementById('receipt');
  if (!receiptElement) {
    document.body.removeChild(iframe);
    throw new Error('Receipt element not found');
  }
  
  try {
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });
    
    // Télécharger comme image (simulation PDF)
    const link = document.createElement('a');
    link.download = `recu-${data.reference}-${format(data.date, 'yyyy-MM-dd')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(iframe);
  }
};

export const printReceipt = (data: ReceiptData): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les popups pour imprimer le reçu');
    return;
  }
  
  printWindow.document.write(generatePaymentReceiptHTML(data));
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
};