import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { qrScanner, type QRScanResult } from '@/lib/qr-utils';

export default function QRScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scannerRef = useRef<HTMLDivElement>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    startScanner();
    
    return () => {
      qrScanner.stopCameraScanner();
      qrScanner.stopScanner();
    };
  }, []);

  const startScanner = async () => {
    if (!scannerRef.current) return;

    try {
      setIsScanning(true);
      setScanResult(null);
      
      await qrScanner.startCameraScanner(
        'qr-scanner-view',
        handleScanSuccess
      );
    } catch (error) {
      console.error('Scanner start error:', error);
      toast({
        title: 'Erreur du scanner',
        description: 'Impossible de démarrer le scanner QR',
        variant: 'destructive',
      });
      setLocation('/');
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    qrScanner.stopCameraScanner();
    
    try {
      const result = await qrScanner.verifyQRCode(decodedText);
      setScanResult(result);
      setIsScanning(false);
      
      // Show toast based on result
      if (result.result === 'valid') {
        toast({
          title: 'QR Code valide',
          description: result.message,
        });
      } else if (result.result === 'expired') {
        toast({
          title: 'Permis expiré',
          description: result.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'QR Code invalide',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('QR verification error:', error);
      toast({
        title: 'Erreur de vérification',
        description: 'Impossible de vérifier le QR code',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    qrScanner.stopCameraScanner();
    qrScanner.stopScanner();
    setLocation('/');
  };

  const handleScanAgain = () => {
    setScanResult(null);
    startScanner();
  };

  if (scanResult) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            data-testid="button-close-scanner"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
          <h3 className="text-lg font-semibold">Résultat du Scan</h3>
          <div className="w-10"></div>
        </div>

        {/* Result Content */}
        <div className="flex-1 p-4 space-y-6">
          {/* Status Card */}
          <Card className={`border-2 ${
            scanResult.result === 'valid' 
              ? 'border-secondary bg-secondary/5' 
              : 'border-destructive bg-destructive/5'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                scanResult.result === 'valid'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-destructive text-destructive-foreground'
              }`}>
                <i className={`fas text-2xl ${
                  scanResult.result === 'valid' ? 'fa-check' : 'fa-exclamation-triangle'
                }`}></i>
              </div>
              
              <h3 className={`text-xl font-bold mb-2 ${
                scanResult.result === 'valid' ? 'text-secondary' : 'text-destructive'
              }`}>
                {scanResult.result === 'valid' 
                  ? 'Permis Valide' 
                  : scanResult.result === 'expired'
                    ? 'Permis Expiré'
                    : 'QR Code Invalide'
                }
              </h3>
              
              <p className="text-muted-foreground" data-testid="scan-result-message">
                {scanResult.message}
              </p>
            </CardContent>
          </Card>

          {/* Permit Details */}
          {scanResult.permit && (
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-semibold mb-4">Détails du Permis</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-user text-primary w-5"></i>
                    <div>
                      <p className="font-medium" data-testid="permit-fisher-name">
                        {scanResult.permit.fisher.nom} {scanResult.permit.fisher.prenoms}
                      </p>
                      <p className="text-sm text-muted-foreground">Titulaire</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-hashtag text-primary w-5"></i>
                    <div>
                      <p className="font-medium" data-testid="permit-serial-number">
                        {scanResult.permit.numSerie}
                      </p>
                      <p className="text-sm text-muted-foreground">Numéro de série</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-map-marker-alt text-primary w-5"></i>
                    <div>
                      <p className="font-medium" data-testid="permit-zone">
                        {scanResult.permit.zonePeche}
                      </p>
                      <p className="text-sm text-muted-foreground">Zone de pêche</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-fish text-primary w-5"></i>
                    <div>
                      <p className="font-medium" data-testid="permit-type">
                        {scanResult.permit.typePeche}
                      </p>
                      <p className="text-sm text-muted-foreground">Type de pêche</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-calendar text-primary w-5"></i>
                    <div>
                      <p className={`font-medium ${scanResult.isExpired ? 'text-destructive' : ''}`} data-testid="permit-expiration">
                        {new Date(scanResult.permit.dateExpiration).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-sm text-muted-foreground">Date d'expiration</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <div className="flex space-x-4">
            <Button
              onClick={handleScanAgain}
              variant="outline"
              className="flex-1"
              data-testid="button-scan-again"
            >
              <i className="fas fa-qrcode mr-2"></i>
              Scanner Autre
            </Button>
            <Button
              onClick={handleClose}
              className="flex-1"
              data-testid="button-finish-scan"
            >
              <i className="fas fa-check mr-2"></i>
              Terminer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="flex flex-col h-full">
        {/* Scanner Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            data-testid="button-close-qr-scanner"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
          <h3 className="text-lg font-semibold">Scanner QR Code</h3>
          <div className="w-10"></div>
        </div>
        
        {/* Scanner Viewfinder */}
        <div className="flex-1 relative">
          {isProcessing ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-white text-center">
                <i className="fas fa-spinner fa-spin text-4xl mb-4"></i>
                <p className="text-lg">Vérification du QR code...</p>
              </div>
            </div>
          ) : (
            <>
              {/* QR Scanner View */}
              <div id="qr-scanner-view" className="w-full h-full" ref={scannerRef}></div>
              
              {/* QR targeting square */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-primary rounded-lg">
                  {/* Corner indicators */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-primary"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-primary"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-primary"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-primary"></div>
                </div>
              </div>

              {/* Instructions */}
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-center">
                    <i className="fas fa-qrcode text-6xl mb-4"></i>
                    <p className="text-lg">Initialisation du scanner...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Scanner Status */}
        <div className="p-6 text-center">
          <div className="flex items-center justify-center space-x-2 text-white">
            {isScanning ? (
              <>
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                <span className="text-sm">Pointez vers un QR Code</span>
              </>
            ) : (
              <span className="text-sm">Préparation du scanner...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
