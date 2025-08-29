import { FullPermit } from '@shared/schema';
import { Card } from '@/components/ui/card';

interface PermitCardProps {
  permit: FullPermit;
  showActions?: boolean;
  onDownload?: () => void;
  onShare?: () => void;
}

export default function PermitCard({ permit, showActions = true, onDownload, onShare }: PermitCardProps) {
  const isExpired = new Date(permit.dateExpiration) <= new Date();

  return (
    <div className="space-y-6">
      {/* Front of Card */}
      <Card className="p-0 overflow-hidden max-w-sm mx-auto">
        <div className="bg-white">
          {/* Header with logos and title */}
          <div className="bg-green-600 text-white p-4 text-center relative">
            <div className="absolute left-2 top-2">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <div className="text-green-600 font-bold text-xs">MAEP</div>
              </div>
            </div>
            <div className="absolute right-2 top-2">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <div className="text-red-600 font-bold text-xs">BÉNIN</div>
              </div>
            </div>
            <div className="pt-4">
              <h2 className="text-lg font-bold">PERMIS DE PÊCHE</h2>
              <div className="text-sm">CATÉGORIE {permit.categorie}</div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-2">
                <div>
                  <span className="font-semibold">N°</span> {permit.numSerie}
                </div>
                <div>
                  <span className="font-semibold">Type de pêche:</span> {permit.typePeche}
                </div>
                <div>
                  <span className="font-semibold">Zone de pêche:</span> {permit.zonePeche}
                </div>
                <div>
                  <span className="font-semibold">Nom du titulaire:</span> {permit.fisher.nom} {permit.fisher.prenoms}
                </div>
                <div>
                  <span className="font-semibold">Adresse complète:</span> {permit.fisher.adresse}
                </div>
                <div>
                  <span className="font-semibold">Téléphone:</span> {permit.fisher.telephone}
                </div>
              </div>
              
              {/* Photo */}
              <div className="w-20 h-24 bg-gray-200 border-2 border-gray-300 flex items-center justify-center ml-4">
                {permit.media?.[0] ? (
                  <img 
                    src={permit.media[0].url} 
                    alt="Photo d'identité" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <i className="fas fa-user text-gray-400"></i>
                )}
              </div>
            </div>

            {/* Vessel and technique info */}
            {permit.vessel && (
              <div>
                <span className="font-semibold">Nom et enregistrement de l'embarcation:</span> {permit.vessel.nomEmbarcation} N°{permit.vessel.numEmbarcation}
              </div>
            )}
            
            {permit.vessel && (
              <div>
                <span className="font-semibold">Site de débarquement/Habitation:</span> {permit.vessel.siteDebarquement}
              </div>
            )}

            {permit.technique && (
              <div>
                <span className="font-semibold">Type d'engin /technique de pêche:</span> {permit.technique.typeEngin} - {permit.technique.techniquePeche}
              </div>
            )}

            {permit.technique?.especesCiblees && (
              <div>
                <span className="font-semibold">Espèces Ciblées:</span> {permit.technique.especesCiblees}
              </div>
            )}

            {/* Bottom section */}
            <div className="flex justify-between items-end pt-4">
              <div className="text-xs">
                <div><span className="font-semibold">Fait à</span> {permit.faitA} le {new Date(permit.dateDelivrance).toLocaleDateString('fr-FR')}</div>
              </div>
              <div className="border-2 border-black p-2 text-center">
                <div className="text-xs font-semibold">Expire le</div>
                <div className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-black'}`}>
                  {new Date(permit.dateExpiration).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Back of Card */}
      <Card className="p-0 overflow-hidden max-w-sm mx-auto">
        <div className="bg-white">
          {/* Header */}
          <div className="bg-gray-100 p-4 text-center border-b-2 border-black">
            <h3 className="text-lg font-bold">DIRECTION DE LA PRODUCTION HALIEUTIQUE</h3>
          </div>

          {/* Content with QR and signature */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex-1">
              <div className="mb-4">
                <div className="text-sm italic">NB: le renouvellement est subordonné à la présentation d'un numéro IFU</div>
              </div>
              
              {/* Signature area */}
              <div className="text-center">
                <div className="w-20 h-20 border-2 border-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <div className="text-blue-600 text-xs font-bold">CACHET</div>
                </div>
                <div className="text-xs">Le Directeur de la Production Halieutique</div>
              </div>
            </div>

            {/* QR Code */}
            <div className="w-24 h-24 bg-black flex items-center justify-center">
              <i className="fas fa-qrcode text-white text-2xl"></i>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      {showActions && (
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onDownload}
            className="bg-secondary text-secondary-foreground py-3 rounded-lg hover:bg-secondary/90 transition-colors"
            data-testid="button-download-pdf"
          >
            <i className="fas fa-download mr-2"></i>
            Exporter PDF
          </button>
          <button 
            onClick={onShare}
            className="bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors"
            data-testid="button-share-card"
          >
            <i className="fas fa-share mr-2"></i>
            Partager
          </button>
        </div>
      )}
    </div>
  );
}