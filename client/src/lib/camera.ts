export interface CameraConstraints {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

interface CameraInfo {
  hasCamera: boolean;
  userAgent: string;
  platform: string;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
}

class CameraManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  getCameraInfo(): CameraInfo {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isMobile = isIOS || isAndroid || /Mobile/.test(userAgent);

    return {
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      userAgent,
      platform,
      isIOS,
      isAndroid,
      isMobile
    };
  }

  async requestPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    } catch (error) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }

  async startCamera(
    videoElement: HTMLVideoElement,
    constraints: CameraConstraints = {}
  ): Promise<MediaStream> {
    const cameraInfo = this.getCameraInfo();
    
    if (!cameraInfo.hasCamera) {
      throw new Error('Camera not supported on this device');
    }

    const defaultConstraints = {
      width: { ideal: cameraInfo.isMobile ? 720 : 1280 },
      height: { ideal: cameraInfo.isMobile ? 1280 : 720 },
      facingMode: cameraInfo.isMobile ? 'environment' : 'user',
      ...constraints
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: defaultConstraints,
        audio: false
      });

      this.video = videoElement;
      videoElement.srcObject = this.stream;
      
      return new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play()
            .then(() => resolve(this.stream!))
            .catch(reject);
        };
        videoElement.onerror = reject;
      });
    } catch (error) {
      console.error('Camera error:', error);
      console.log('Camera info:', cameraInfo);
      throw new Error(`Unable to access camera: ${error.message}`);
    }
  }

  async capturePhoto(videoElement: HTMLVideoElement): Promise<string> {
    if (!videoElement || videoElement.videoWidth === 0) {
      throw new Error('Video not ready for capture');
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Unable to create canvas context');
    }

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  async switchCamera(): Promise<MediaStream | null> {
    if (!this.video) return null;

    const currentConstraints = this.stream?.getVideoTracks()[0]?.getSettings();
    const newFacingMode = currentConstraints?.facingMode === 'user' ? 'environment' : 'user';

    this.stopCamera();
    
    try {
      return await this.startCamera(this.video, { facingMode: newFacingMode });
    } catch (error) {
      console.error('Error switching camera:', error);
      return null;
    }
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error getting cameras:', error);
      return [];
    }
  }
}

export const cameraManager = new CameraManager();