import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { FullPermit } from '@shared/schema';

interface CardOptions {
  dpi?: number;
  format?: 'individual' | 'batch';
  cardsPerPage?: number;
}

export async function generatePermitCard(
  permit: FullPermit, 
  qrPayload: string, 
  options: CardOptions = {}
): Promise<Buffer> {
  const { dpi = 300 } = options;
  
  // Standard credit card size: 85.60 × 53.98 mm
  const cardWidth = 85.60 * 2.83465; // Convert mm to points
  const cardHeight = 53.98 * 2.83465;
  
  const doc = new PDFDocument({
    size: [cardWidth, cardHeight],
    margin: 0
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // FRONT OF CARD
  // Header with logos
  doc.rect(0, 0, cardWidth, 30)
     .fill('#ffffff');

  // Left logo placeholder (MAEP)
  doc.rect(5, 5, 20, 20)
     .fillAndStroke('#10b981', '#10b981');
  doc.fillColor('white')
     .fontSize(6)
     .text('MAEP', 7, 12);

  // Right logo placeholder (Bénin)
  doc.rect(cardWidth - 25, 5, 20, 20)
     .fillAndStroke('#dc2626', '#dc2626');
  doc.fillColor('white')
     .fontSize(6)
     .text('BÉNIN', cardWidth - 23, 12);

  // Ministry text
  doc.fillColor('black')
     .fontSize(6)
     .font('Helvetica')
     .text('MINISTÈRE DE L\'AGRICULTURE', 30, 8, { width: cardWidth - 60, align: 'center' })
     .text('DE L\'ÉLEVAGE ET DE LA PÊCHE', 30, 16, { width: cardWidth - 60, align: 'center' })
     .fontSize(5)
     .text('RÉPUBLIQUE DU BÉNIN', 30, 24, { width: cardWidth - 60, align: 'center' });

  // Green header bar
  doc.rect(0, 30, cardWidth, 25)
     .fill('#10b981');

  doc.fillColor('white')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('PERMIS DE PÊCHE', 5, 38, { width: cardWidth - 10, align: 'center' })
     .fontSize(8)
     .text(`CATÉGORIE ${permit.categorie}`, 5, 50, { width: cardWidth - 10, align: 'center' });

  // Main content area
  doc.fillColor('black')
     .fontSize(7)
     .font('Helvetica');

  let yPos = 65;
  const lineHeight = 8;

  // Permit details
  const details = [
    `N° ${permit.numSerie}`,
    `Type de pêche: ${permit.typePeche}`,
    `Zone de pêche: ${permit.zonePeche}`,
    `Nom du titulaire: ${permit.fisher.nom} ${permit.fisher.prenoms}`,
    `Adresse complète: ${permit.fisher.adresse}`,
    `Téléphone: ${permit.fisher.telephone}`
  ];

  // Photo area
  const photoX = cardWidth - 35;
  const photoY = 65;
  const photoWidth = 30;
  const photoHeight = 35;

  doc.rect(photoX, photoY, photoWidth, photoHeight)
     .stroke('#cccccc');

  if (permit.media?.[0]?.base64Data) {
    try {
      const imageBuffer = Buffer.from(permit.media[0].base64Data.split(',')[1], 'base64');
      doc.image(imageBuffer, photoX + 1, photoY + 1, {
        width: photoWidth - 2,
        height: photoHeight - 2,
        fit: [photoWidth - 2, photoHeight - 2]
      });
    } catch (error) {
      console.error('Error adding photo:', error);
    }
  }

  // Add permit details
  details.forEach((detail, index) => {
    if (yPos + lineHeight < cardHeight - 25) {
      doc.text(detail, 5, yPos, { width: cardWidth - 45 });
      yPos += lineHeight;
    }
  });

  // Vessel info if available
  if (permit.vessel?.nomEmbarcation) {
    doc.text(`Nom et enregistrement de l'embarcation: ${permit.vessel.nomEmbarcation} N°${permit.vessel.numEmbarcation}`, 5, yPos, { width: cardWidth - 45 });
    yPos += lineHeight;
  }

  if (permit.vessel?.siteDebarquement) {
    doc.text(`Site de débarquement/Habitation: ${permit.vessel.siteDebarquement}`, 5, yPos, { width: cardWidth - 45 });
    yPos += lineHeight;
  }

  if (permit.technique?.typeEngin) {
    doc.text(`Type d'engin /technique de pêche: ${permit.technique.typeEngin} - ${permit.technique.techniquePeche}`, 5, yPos, { width: cardWidth - 45 });
    yPos += lineHeight;
  }

  if (permit.technique?.especesCiblees) {
    doc.text(`Espèces Ciblées: ${permit.technique.especesCiblees}`, 5, yPos, { width: cardWidth - 45 });
    yPos += lineHeight;
  }

  // Bottom section
  doc.fontSize(6)
     .text(`Fait à ${permit.faitA} le ${new Date(permit.dateDelivrance).toLocaleDateString('fr-FR')}`, 5, cardHeight - 20);

  // Expiration box
  doc.rect(cardWidth - 60, cardHeight - 25, 55, 20)
     .stroke('#000000');
  doc.fontSize(5)
     .text('Expire le', cardWidth - 58, cardHeight - 22, { width: 50, align: 'center' })
     .fontSize(7)
     .font('Helvetica-Bold')
     .text(new Date(permit.dateExpiration).toLocaleDateString('fr-FR'), cardWidth - 58, cardHeight - 15, { width: 50, align: 'center' });

  // NEW PAGE FOR BACK OF CARD
  doc.addPage({ size: [cardWidth, cardHeight], margin: 0 });

  // Back header
  doc.rect(0, 0, cardWidth, 25)
     .fill('#f5f5f5');

  doc.fillColor('black')
     .fontSize(8)
     .font('Helvetica-Bold')
     .text('DIRECTION DE LA PRODUCTION HALIEUTIQUE', 5, 8, { width: cardWidth - 10, align: 'center' });

  // Black line
  doc.rect(0, 25, cardWidth, 2)
     .fill('#000000');

  // Content area
  doc.fontSize(6)
     .font('Helvetica-Oblique')
     .text('NB: le renouvellement est subordonné à la présentation d\'un numéro IFU', 5, 35, { width: cardWidth - 10 });

  // Signature area
  const signatureX = 20;
  const signatureY = 50;
  
  // Official stamp circle
  doc.circle(signatureX + 15, signatureY + 15, 12)
     .stroke('#1e40af', 2);
  doc.fontSize(5)
     .fillColor('#1e40af')
     .text('CACHET', signatureX + 8, signatureY + 12);

  doc.fillColor('black')
     .fontSize(5)
     .text('Le Directeur de la Production Halieutique', signatureX - 5, signatureY + 35, { width: 80 });

  // QR Code
  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrPayload, {
      width: 60,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
    doc.image(qrBuffer, cardWidth - 65, 45, {
      width: 60,
      height: 60
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    doc.rect(cardWidth - 65, 45, 60, 60)
       .stroke('#000000');
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function generateBatchCards(
  permits: FullPermit[], 
  qrPayloads: string[], 
  options: CardOptions = {}
): Promise<Buffer> {
  const { cardsPerPage = 8 } = options;
  
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  
  const doc = new PDFDocument({
    size: 'A4',
    margin: 20
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const cardWidth = (pageWidth - 60) / 2;
  const cardHeight = (pageHeight - 100) / 4;
  
  for (let i = 0; i < permits.length; i++) {
    const cardIndex = i % cardsPerPage;
    
    if (cardIndex === 0 && i > 0) {
      doc.addPage();
    }
    
    const col = cardIndex % 2;
    const row = Math.floor(cardIndex / 2);
    
    const x = 30 + (col * (cardWidth + 20));
    const y = 30 + (row * (cardHeight + 10));
    
    // Draw simplified card
    doc.rect(x, y, cardWidth, cardHeight)
       .stroke('#cccccc');
    
    doc.fillColor('#10b981')
       .rect(x, y, cardWidth, 20)
       .fill();
    
    doc.fillColor('white')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('PERMIS DE PÊCHE', x + 5, y + 6, { width: cardWidth - 10, align: 'center' });
    
    doc.fillColor('black')
       .fontSize(6)
       .font('Helvetica')
       .text(`${permits[i].fisher.nom} ${permits[i].fisher.prenoms}`, x + 5, y + 25)
       .text(`N°: ${permits[i].numSerie}`, x + 5, y + 35)
       .text(`Zone: ${permits[i].zonePeche}`, x + 5, y + 45);
    
    // Small QR code
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrPayloads[i], {
        width: 25,
        margin: 0
      });
      
      const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
      doc.image(qrBuffer, x + cardWidth - 30, y + cardHeight - 30, {
        width: 25,
        height: 25
      });
    } catch (error) {
      console.error('Error generating QR code for batch:', error);
    }
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}