import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cameraManager } from '@/lib/camera';

export default function CameraCapture() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    startCamera();
    
    return () => {
      cameraManager.stopCamera();
    };
  }, []);

  const startCamera = async () => {
    if (!cameraManager.isSupported()) {
      toast({
        title: 'Caméra non supportée',
        description: 'Votre navigateur ne supporte pas l\'accès à la caméra',
        variant: 'destructive',
      });
      setLocation('/permit-form');
      return;
    }

    try {
      const hasPermission = await cameraManager.requestPermission();
      if (!hasPermission) {
        toast({
          title: 'Permission refusée',
          description: 'Veuillez autoriser l\'accès à la caméra',
          variant: 'destructive',
        });
        setLocation('/permit-form');
        return;
      }

      if (videoRef.current) {
        await cameraManager.startCamera(videoRef.current, {
          facingMode: currentFacingMode,
          width: 1280,
          height: 720,
        });
        setIsStreamActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: 'Erreur caméra',
        description: 'Impossible d\'accéder à la caméra',
        variant: 'destructive',
      });
      setLocation('/permit-form');
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    setIsCapturing(true);

    try {
      const photoDataUrl = await cameraManager.capturePhoto(videoRef.current);
      setCapturedPhoto(photoDataUrl);
      
      // Store photo in localStorage for the form
      localStorage.setItem('capturedPhoto', photoDataUrl);
      
      toast({
        title: 'Photo capturée',
        description: 'Photo d\'identité prise avec succès',
      });
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: 'Erreur de capture',
        description: 'Impossible de prendre la photo',
        variant: 'destructive',
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const switchCamera = async () => {
    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      if (videoRef.current) {
        await cameraManager.startCamera(videoRef.current, {
          facingMode: newFacingMode,
        });
        setCurrentFacingMode(newFacingMode);
      }
    } catch (error) {
      toast({
        title: 'Changement de caméra impossible',
        description: 'Une seule caméra disponible',
        variant: 'destructive',
      });
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const confirmPhoto = () => {
    cameraManager.stopCamera();
    setLocation('/permit-form');
  };

  const handleClose = () => {
    cameraManager.stopCamera();
    setLocation('/permit-form');
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="flex flex-col h-full">
        {/* Camera Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            data-testid="button-close-camera"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
          <h3 className="text-lg font-semibold">Photo d'Identité</h3>
          <button
            onClick={switchCamera}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            data-testid="button-switch-camera"
          >
            <i className="fas fa-sync-alt text-xl"></i>
          </button>
        </div>
        
        {/* Camera Viewfinder or Photo Preview */}
        <div className="flex-1 relative flex items-center justify-center">
          {capturedPhoto ? (
            // Photo Preview
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={capturedPhoto}
                alt="Photo capturée"
                className="max-w-full max-h-full object-contain rounded-lg"
                data-testid="img-captured-photo"
              />
            </div>
          ) : (
            // Camera View
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                data-testid="video-camera-feed"
              />
              
              {/* Face outline guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-2 border-white rounded-lg opacity-50">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-white"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-white"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-white"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-white"></div>
                </div>
              </div>

              {/* Camera loading indicator */}
              {!isStreamActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-center">
                    <i className="fas fa-spinner fa-spin text-4xl mb-4"></i>
                    <p className="text-lg">Initialisation de la caméra...</p>
                  </div>
                </div>
              )}
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Camera Controls */}
        <div className="p-6 text-center">
          {capturedPhoto ? (
            // Photo confirmation controls
            <div className="flex justify-center space-x-4">
              <Button
                onClick={retakePhoto}
                variant="outline"
                size="lg"
                className="text-white border-white hover:bg-white/10"
                data-testid="button-retake-photo"
              >
                <i className="fas fa-redo mr-2"></i>
                Reprendre
              </Button>
              <Button
                onClick={confirmPhoto}
                size="lg"
                className="bg-primary hover:bg-primary/90"
                data-testid="button-confirm-photo"
              >
                <i className="fas fa-check mr-2"></i>
                Confirmer
              </Button>
            </div>
          ) : (
            // Capture controls
            <>
              <button
                onClick={capturePhoto}
                disabled={!isStreamActive || isCapturing}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50"
                data-testid="button-capture-photo"
              >
                {isCapturing ? (
                  <i className="fas fa-spinner fa-spin text-primary text-lg"></i>
                ) : (
                  <div className="w-12 h-12 bg-primary rounded-full"></div>
                )}
              </button>
              <p className="text-white text-sm mt-3">
                {isStreamActive 
                  ? 'Positionnez le visage dans le cadre et appuyez pour capturer' 
                  : 'Chargement de la caméra...'
                }
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
