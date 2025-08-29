import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export interface QRScanResult {
  result: 'valid' | 'invalid' | 'expired';
  permit?: {
    fisher: {
      nom: string;
      prenoms: string;
    };
    numSerie: string;
    zonePeche: string;
    dateExpiration: string;
    typePeche: string;
  };
  isExpired?: boolean;
  message: string;
}

class QRScanner {
  private scanner: Html5QrcodeScanner | null = null;
  private qrcode: Html5Qrcode | null = null;

  async startScanner(
    elementId: string,
    onScanSuccess: (decodedText: string) => void,
    onScanError?: (errorMessage: string) => void
  ): Promise<void> {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    this.scanner = new Html5QrcodeScanner(elementId, config, false);
    this.scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText);
        this.stopScanner();
      },
      onScanError || (() => {})
    );
  }

  async startCameraScanner(
    elementId: string,
    onScanSuccess: (decodedText: string) => void
  ): Promise<void> {
    try {
      this.qrcode = new Html5Qrcode(elementId);
      
      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) {
        throw new Error('No cameras found');
      }

      // Use back camera if available, otherwise use first camera
      const cameraId = cameras.find(camera => 
        camera.label.toLowerCase().includes('back') || 
        camera.label.toLowerCase().includes('rear')
      )?.id || cameras[0].id;

      await this.qrcode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          onScanSuccess(decodedText);
          this.stopCameraScanner();
        },
        () => {} // Error callback - ignore scan errors
      );
    } catch (error) {
      console.error('Error starting camera scanner:', error);
      throw new Error('Unable to start camera scanner');
    }
  }

  stopScanner(): void {
    if (this.scanner) {
      this.scanner.clear();
      this.scanner = null;
    }
  }

  stopCameraScanner(): void {
    if (this.qrcode) {
      this.qrcode.stop()
        .then(() => {
          this.qrcode = null;
        })
        .catch(console.error);
    }
  }

  async verifyQRCode(qrData: string): Promise<QRScanResult> {
    try {
      // Check if it's our app's QR format
      if (!qrData.startsWith('peche://verify')) {
        return {
          result: 'invalid',
          message: 'QR code invalide - Format non reconnu'
        };
      }

      // Try online verification first
      if (navigator.onLine) {
        const response = await fetch('/api/scans/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ qrData })
        });

        if (response.ok) {
          return await response.json();
        }
      }

      // Fallback to offline verification
      return await this.verifyOffline(qrData);
    } catch (error) {
      console.error('QR verification error:', error);
      return {
        result: 'invalid',
        message: 'Erreur lors de la vérification du QR code'
      };
    }
  }

  private async verifyOffline(qrData: string): Promise<QRScanResult> {
    // Import offline storage
    const { offlineStorage } = await import('./offline-storage');

    try {
      // Parse QR data
      const url = new URL(qrData);
      const permitId = url.searchParams.get('d');
      
      if (!permitId) {
        return {
          result: 'invalid',
          message: 'QR code invalide - Données manquantes'
        };
      }

      // Try to get cached permit data
      const cachedPermit = await offlineStorage.getCachedPermit(permitId);
      
      if (!cachedPermit) {
        return {
          result: 'invalid',
          message: 'Permit non trouvé en cache local'
        };
      }

      // Check expiration
      const now = new Date();
      const expiration = new Date(cachedPermit.dateExpiration);
      const isExpired = expiration <= now;

      return {
        result: isExpired ? 'expired' : 'valid',
        permit: {
          fisher: cachedPermit.fisher,
          numSerie: cachedPermit.numSerie,
          zonePeche: cachedPermit.zonePeche,
          dateExpiration: cachedPermit.dateExpiration,
          typePeche: cachedPermit.typePeche
        },
        isExpired,
        message: isExpired ? 'Permis expiré' : 'Permis valide (vérification hors ligne)'
      };
    } catch (error) {
      return {
        result: 'invalid',
        message: 'Erreur lors de la vérification hors ligne'
      };
    }
  }
}

export const qrScanner = new QRScanner();
