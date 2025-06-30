
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeResult, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import { XCircleIcon } from './icons/XCircleIcon';
import { CameraRotateIcon } from './icons/CameraRotateIcon';
import { Button } from './Button';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError: (errorMessage: string) => void;
  onRequestClose: () => void;
}

const qrcodeRegionId = "html5qr-code-full-region";
const PREFERRED_CAMERA_ID_KEY = 'qrScannerPreferredCameraId';

const Scanner: React.FC<ScannerProps> = ({ onScanSuccess, onScanError, onRequestClose }) => {
  const html5QrcodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(-1);
  const [internalScanError, setInternalScanError] = useState<string | null>(null);
  const [currentCameraLabel, setCurrentCameraLabel] = useState<string>("Initializing camera...");
  const [isCameraOperationInProgress, setIsCameraOperationInProgress] = useState<boolean>(false);

  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const onRequestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanErrorRef.current = onScanError;
    onRequestCloseRef.current = onRequestClose;
  }, [onScanSuccess, onScanError, onRequestClose]);

  useEffect(() => {
    if (!document.getElementById(qrcodeRegionId)) {
        console.error("QR Code region element not found in DOM.");
        onScanErrorRef.current("Scanner UI element missing. Please refresh.");
        return;
    }
    if (!html5QrcodeInstanceRef.current) {
      try {
        html5QrcodeInstanceRef.current = new Html5Qrcode(
          qrcodeRegionId,
          { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] }
        );
      } catch (e: any) {
        console.error("Failed to initialize Html5Qrcode:", e);
        onScanErrorRef.current(e.message || "Failed to initialize scanner. Please refresh.");
        return;
      }
    }

    Html5Qrcode.getCameras()
      .then(cameras => {
        if (cameras && cameras.length) {
          setAvailableCameras(cameras as CameraDevice[]);
          let initialIndex = 0;
          const preferredCameraId = localStorage.getItem(PREFERRED_CAMERA_ID_KEY);
          
          if (preferredCameraId) {
            const preferredCameraIdx = cameras.findIndex(cam => cam.id === preferredCameraId);
            if (preferredCameraIdx !== -1) {
              initialIndex = preferredCameraIdx;
            } else {
              // Preferred camera not found, remove from storage and use default logic
              localStorage.removeItem(PREFERRED_CAMERA_ID_KEY);
              const backCameraIdx = cameras.findIndex(cam => cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('rear'));
              const frontCameraIdx = cameras.findIndex(cam => cam.label.toLowerCase().includes('front'));
              if (backCameraIdx !== -1) initialIndex = backCameraIdx;
              else if (frontCameraIdx !== -1) initialIndex = frontCameraIdx;
            }
          } else {
            // No preferred camera, use default logic
            const backCameraIdx = cameras.findIndex(cam => cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('rear'));
            const frontCameraIdx = cameras.findIndex(cam => cam.label.toLowerCase().includes('front'));
            if (backCameraIdx !== -1) initialIndex = backCameraIdx;
            else if (frontCameraIdx !== -1) initialIndex = frontCameraIdx;
          }
          setSelectedCameraIndex(initialIndex);
        } else {
          onScanErrorRef.current("No cameras found on this device.");
          setCurrentCameraLabel("No cameras found");
        }
      })
      .catch(err => {
        console.error("Failed to get cameras:", err);
        onScanErrorRef.current("Could not access cameras. Please check permissions.");
        setCurrentCameraLabel("Camera access error");
      });

    return () => {
      const qrInstance = html5QrcodeInstanceRef.current;
      if (qrInstance) {
        if (qrInstance.getState() === Html5QrcodeScannerState.SCANNING ||
            qrInstance.getState() === Html5QrcodeScannerState.PAUSED) {
          qrInstance.stop()
            .then(() => console.log("Scanner stopped on component unmount."))
            .catch(stopErr => console.error("Error stopping scanner on unmount:", stopErr))
            .finally(() => {
                const regionElement = document.getElementById(qrcodeRegionId);
                if (regionElement) regionElement.innerHTML = ''; 
            });
        }
        html5QrcodeInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    const qrCode = html5QrcodeInstanceRef.current;
    if (!qrCode || selectedCameraIndex < 0 || availableCameras.length === 0) {
      if (availableCameras.length > 0 && selectedCameraIndex < 0 && !isCameraOperationInProgress) {
        if (qrCode && (qrCode.getState() === Html5QrcodeScannerState.SCANNING || qrCode.getState() === Html5QrcodeScannerState.PAUSED)) {
            setIsCameraOperationInProgress(true);
            qrCode.stop()
                .then(() => setCurrentCameraLabel("Camera stopped."))
                .catch(e => console.error("Error stopping camera on index reset", e))
                .finally(() => setIsCameraOperationInProgress(false));
        }
      }
      return;
    }

    const camera = availableCameras[selectedCameraIndex];
    if (!camera || !camera.id) {
      const errorMsg = "Selected camera is invalid or has no ID.";
      setInternalScanError(errorMsg);
      setCurrentCameraLabel("Invalid camera");
      return;
    }
    
    const currentCameraId = camera.id;
    let friendlyLabel = `Camera ${selectedCameraIndex + 1}`;
    const rawLabel = camera.label?.toLowerCase() || "";
    if (rawLabel.includes('back') || rawLabel.includes('rear')) friendlyLabel = "Back Camera";
    else if (rawLabel.includes('front')) friendlyLabel = "Front Camera";
    else if (camera.label) friendlyLabel = camera.label.split(',')[0].trim();
    
    let isMounted = true;

    const manageCameraStream = async () => {
      if (isCameraOperationInProgress) {
        console.warn("Camera operation already in progress, skipping new request.");
        return;
      }
      setIsCameraOperationInProgress(true);
      setInternalScanError(null);

      try {
        if (qrCode.getState() === Html5QrcodeScannerState.SCANNING || qrCode.getState() === Html5QrcodeScannerState.PAUSED) {
          console.debug("Attempting to stop current camera stream before switching...");
          await qrCode.stop();
           if (!isMounted) { setIsCameraOperationInProgress(false); return; }
          console.debug("Current camera stream stopped.");
          const regionElement = document.getElementById(qrcodeRegionId);
          if (regionElement) regionElement.innerHTML = ''; 
        }
        
        if (!isMounted) { setIsCameraOperationInProgress(false); return; }

        console.debug(`Attempting to start camera: ${friendlyLabel} (${currentCameraId})`);
        setCurrentCameraLabel(`Loading ${friendlyLabel}...`);

        await qrCode.start(
          currentCameraId,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.max(200, Math.floor(minEdge * 0.75));
              // Force square dimensions - ensure both width and height are exactly the same
              return qrboxSize;
            },
          },
          (decodedText: string, result: Html5QrcodeResult) => {
            if (isMounted) onScanSuccessRef.current(decodedText);
          },
          (errorMessage: string, error: any) => {
             // Non-critical scan errors (e.g. QR not found in frame)
          }
        );
        if (isMounted) {
            console.debug(`Camera started: ${friendlyLabel}`);
            setCurrentCameraLabel(friendlyLabel);
            setInternalScanError(null);
            localStorage.setItem(PREFERRED_CAMERA_ID_KEY, currentCameraId); // Save preferred camera
        }

      } catch (startErr: any) {
        console.error(`Failed to start scanner with camera ${currentCameraId} (${friendlyLabel}):`, startErr);
        if (isMounted) {
          let message = `Failed to start ${friendlyLabel}.`;
          if (startErr.name === "NotAllowedError") message = `Camera permission denied for ${friendlyLabel}.`;
          else if (startErr.name === "NotFoundError") message = `${friendlyLabel} not found or disconnected.`;
          else if (startErr.name === "NotReadableError") message = `${friendlyLabel} is already in use or unreadable. Try another camera.`;
          else if (startErr.message) message = `${friendlyLabel}: ${startErr.message}`;
          setInternalScanError(message);
          setCurrentCameraLabel(`Error: ${friendlyLabel}`);
        }
      } finally {
        if (isMounted) {
          setIsCameraOperationInProgress(false);
        }
      }
    };

    manageCameraStream();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraIndex, availableCameras]); 

  const handleSwitchCamera = useCallback(() => {
    if (availableCameras.length > 1 && !isCameraOperationInProgress) {
      setSelectedCameraIndex(prevIndex => (prevIndex + 1) % availableCameras.length);
    } else if (isCameraOperationInProgress) {
        console.log("Switch camera ignored: operation in progress.");
    }
  }, [availableCameras.length, isCameraOperationInProgress]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-2 sm:p-4" aria-modal="true" role="dialog">
      <div className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg relative border border-slate-700 flex flex-col">
        <button
          onClick={onRequestCloseRef.current}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 text-slate-400 hover:text-sky-400 transition-colors z-20 p-1"
          aria-label="Close scanner"
          disabled={isCameraOperationInProgress}
        >
          <XCircleIcon className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1 text-center text-sky-300">Scan QR Code</h2>
        <p className="text-xs text-slate-400 mb-3 sm:mb-4 text-center min-h-[1.2em]">
          {currentCameraLabel}
        </p>
        
        <div 
          id={qrcodeRegionId} 
          className="w-full bg-slate-900 rounded-lg overflow-hidden shadow-inner border border-slate-700"
          style={{ aspectRatio: '1 / 1', minHeight: '280px', maxHeight: '500px' }}
        >
          {/* html5-qrcode library renders video stream here */}
        </div>

        {internalScanError && (
          <p className="text-red-400 text-xs sm:text-sm text-center mt-2 p-2 bg-red-900/50 rounded-md">
            Scanner Error: {internalScanError}
          </p>
        )}
        
        <p className="text-xs sm:text-sm text-slate-400 mt-3 text-center">
          Position the QR code within the frame.
        </p>

        {availableCameras.length > 1 && (
          <Button
            onClick={handleSwitchCamera}
            variant="secondary"
            className="w-full mt-4 flex items-center justify-center space-x-2"
            aria-label="Switch Camera"
            disabled={isCameraOperationInProgress || availableCameras.length <= 1}
          >
            <CameraRotateIcon className="w-5 h-5" />
            <span>Switch Camera</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default Scanner;
