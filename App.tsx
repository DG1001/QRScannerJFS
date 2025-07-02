import React, { useState, useCallback, useEffect, useRef } from 'react';
import Scanner from './components/Scanner';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { sendCheckinId } from './services/apiService';
import { ID_REGEX } from './constants';
import { ApiResponseStatus, CheckinApiResponse } from './types';
import { QrCodeIcon } from './components/icons/QrCodeIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './components/icons/ExclamationTriangleIcon';
import { XCircleIcon } from './components/icons/XCircleIcon';
import PinInput from './components/PinInput'; // Import the new PinInput component

const MESSAGE_DISPLAY_DURATION = 3000; // 3 seconds
const SUCCESS_MESSAGE_DURATION = 2500; // 2,5 seconds for success messages
const WARNING_MESSAGE_DURATION = 4000; // 4 seconds for warning messages

// Global audio context for iOS compatibility
let audioContext: AudioContext | null = null;

// Wake Lock API for preventing screen sleep during scanning
let wakeLock: any = null;

const requestWakeLock = async (enabled: boolean) => {
  if (!enabled) return;
  
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      console.log('Screen wake lock activated');
      
      wakeLock.addEventListener('release', () => {
        console.log('Screen wake lock released');
      });
    }
  } catch (err) {
    console.log('Wake lock not supported or failed:', err);
  }
};

const releaseWakeLock = () => {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
    console.log('Screen wake lock manually released');
  }
};

// Initialize audio context (required for iOS)
const initAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      // iOS requires audio context to be resumed after user interaction
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } catch (e) {
      console.log('Audio context creation failed');
    }
  }
};

// Audio feedback functions
const playSuccessSound = () => {
  try {
    if (!audioContext) initAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Audio playback failed');
  }
};

const playWarningSound = () => {
  try {
    if (!audioContext) initAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(500, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.log('Audio playback failed');
  }
};

const playErrorSound = () => {
  try {
    if (!audioContext) initAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(250, audioContext.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio playback failed');
  }
};

const playRejectedSound = () => {
  try {
    if (!audioContext) initAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    
    // Create a distinctive "buzzer" pattern for rejected IDs
    const createBuzz = (startTime: number, frequency: number, duration: number) => {
      const oscillator = audioContext!.createOscillator();
      const gainNode = audioContext!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext!.destination);
      
      oscillator.frequency.setValueAtTime(frequency, startTime);
      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    // Create three rapid buzzer pulses
    const currentTime = audioContext.currentTime;
    createBuzz(currentTime, 400, 0.1);
    createBuzz(currentTime + 0.15, 400, 0.1);
    createBuzz(currentTime + 0.3, 400, 0.1);
  } catch (e) {
    console.log('Audio playback failed');
  }
};

const App: React.FC = () => {
  // Read PIN code from environment variables
  const CORRECT_PIN = import.meta.env.VITE_PIN_CODE;

  // State to manage PIN verification
  const [isPinVerified, setIsPinVerified] = useState<boolean>(() => {
    // Check local storage on initial load
    // If CORRECT_PIN is not set, assume no PIN is required and verify immediately.
    if (!CORRECT_PIN) return true;
    return localStorage.getItem('pin_verified') === 'true';
  });

  const handlePinVerified = useCallback(() => {
    // Initialize audio context on PIN verification (user interaction for iOS)
    initAudioContext();
    
    setIsPinVerified(true);
    localStorage.setItem('pin_verified', 'true');
  }, []);

  const [scannedId, setScannedId] = useState<string | null>(null);
  const [apiResponseMessage, setApiResponseMessage] = useState<string | null>(null);
  const [apiResponseStatus, setApiResponseStatus] = useState<ApiResponseStatus | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null); // For non-API, non-scan errors

  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);

  const [scannedIdsLog, setScannedIdsLog] = useState<Set<string>>(new Set());
  const [lastProcessedId, setLastProcessedId] = useState<string | null>(null); // For immediate duplicate prevention

  // Wake lock preference state - default to false for better compatibility
  const [wakeLockEnabled, setWakeLockEnabled] = useState<boolean>(() => {
    return localStorage.getItem('wake_lock_enabled') === 'true';
  });

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState<boolean>(false);

  const messageTimeoutRef = useRef<number | null>(null);

  const toggleWakeLock = useCallback(() => {
    const newWakeLockEnabled = !wakeLockEnabled;
    setWakeLockEnabled(newWakeLockEnabled);
    localStorage.setItem('wake_lock_enabled', newWakeLockEnabled.toString());
    
    // If wake lock is being disabled and currently active, release it
    if (!newWakeLockEnabled && wakeLock) {
      releaseWakeLock();
    }
    // If wake lock is being enabled and scanning is active, request it
    if (newWakeLockEnabled && isScanningActive) {
      requestWakeLock(true);
    }
  }, [wakeLockEnabled, isScanningActive]);

  const clearMessage = useCallback(() => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    setApiResponseMessage(null);
    setApiResponseStatus(null);
    setGeneralError(null);
  }, []);

  const displayMessage = useCallback((message: string, status: ApiResponseStatus, isError: boolean = false) => {
    clearMessage();
    if (isError) setGeneralError(message);
    else {
      setApiResponseMessage(message);
      setApiResponseStatus(status);
    }
    
    // Play appropriate sound based on message type
    if (status === 'ok') {
      playSuccessSound();
    } else if (status === 'already registered') {
      playWarningSound();
    } else if (status === 'rejected') {
      playRejectedSound();
    } else if (status === 'error' || status === 'id not known' || isError) {
      playErrorSound();
    }
    
    // Determine display duration based on message type
    let duration = MESSAGE_DISPLAY_DURATION;
    if (status === 'ok') duration = SUCCESS_MESSAGE_DURATION;
    else if (status === 'already registered') duration = WARNING_MESSAGE_DURATION;
    
    messageTimeoutRef.current = window.setTimeout(() => {
      clearMessage();
      // If scanning is active, ensure scanner is shown after message clears
      if (isScanningActive && !showScanner) {
        setShowScanner(true);
      }
    }, duration);
  }, [clearMessage, isScanningActive, showScanner]);


  const extractIdFromUrl = (url: string): string | null => {
    const match = url.match(ID_REGEX);
    return match ? match[1] : null;
  };

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    setShowScanner(false); // Hide scanner to show message
    setIsLoading(true);

    const id = extractIdFromUrl(decodedText);

    if (!id) {
      displayMessage("❌ Invalid QR code: Does not contain a valid check-in URL.", 'error', true);
      setScannedId(null);
      setIsLoading(false);
      if (isScanningActive) setShowScanner(true); // Re-show scanner if still active
      return;
    }
    
    setScannedId(id);

    // Prevent immediate re-scan of the exact same QR code from being processed
    if (id === lastProcessedId) {
      displayMessage(`🔄 Duplicate: ID "${id}" was just processed. Ignoring duplicate scan.`, 'already registered');
      setIsLoading(false);
      // Do not reset lastProcessedId here - keep it set to prevent infinite loops
      if (isScanningActive) setTimeout(() => setShowScanner(true), WARNING_MESSAGE_DURATION);
      return;
    }

    if (scannedIdsLog.has(id)) {
      displayMessage(`⚠️ Already Registered: ID "${id}" has already been checked in.`, 'already registered');
      setIsLoading(false);
      setLastProcessedId(id); // Mark as processed for debounce
      if (isScanningActive) setTimeout(() => setShowScanner(true), WARNING_MESSAGE_DURATION);
      return;
    }

    try {
      const response = await sendCheckinId(id);
      if (response.status === 'ok') {
        setScannedIdsLog(prevLog => new Set(prevLog).add(id));
        displayMessage(`✅ Checked In: ${id} - ${response.message}`, 'ok');
        setLastProcessedId(id);
      } else if (response.status === 'rejected') {
        const rejectionReason = response.reason || 'No reason provided';
        displayMessage(`🚫 REJECTED: ID "${id}" - ${response.message}\n\nReason: ${rejectionReason}`, 'rejected', true);
        setLastProcessedId(id); // Prevent re-scanning rejected IDs
      } else {
        displayMessage(`❌ Problem with ID "${id}": ${response.message}`, response.status, response.status === 'error');
         // Do not set lastProcessedId here if it's an API error or ID not known,
         // allowing a retry if it was a transient issue.
      }
    } catch (e: any) {
      const apiErrorMessage = e.message || "Failed to contact service.";
      displayMessage(`🔗 API Error: ${apiErrorMessage}`, 'error', true);
    } finally {
      setIsLoading(false);
      if (isScanningActive) {
         // Delay showing scanner again to allow message to be read
         setTimeout(() => {
            if(isScanningActive) setShowScanner(true); // Check again in case user stopped scanning
         }, SUCCESS_MESSAGE_DURATION - 500);
      }
    }
  }, [isScanningActive, scannedIdsLog, lastProcessedId, displayMessage]);

  const handleScanError = useCallback((errorMessage: string) => {
    setShowScanner(false); // Hide scanner to show message
    displayMessage(`📷 Scanner Error: ${errorMessage}`, 'error', true);
    if (isScanningActive) {
      setTimeout(() => {
        if(isScanningActive) setShowScanner(true);
      }, MESSAGE_DISPLAY_DURATION - 500);
    }
  }, [isScanningActive, displayMessage]);

  const toggleScanning = () => {
    // Initialize audio context on first user interaction (required for iOS)
    initAudioContext();
    
    clearMessage();
    setIsScanningActive(prev => {
      const newIsScanningActive = !prev;
      if (newIsScanningActive) {
        setShowScanner(true);
        setLastProcessedId(null); // Reset debounce on new "start"
        // Request wake lock to prevent screen sleep during scanning (if enabled)
        requestWakeLock(wakeLockEnabled);
      } else {
        setShowScanner(false);
        // Release wake lock when scanning stops
        releaseWakeLock();
      }
      return newIsScanningActive;
    });
  };
  
  // Effect to manage scanner visibility based on isScanningActive
  useEffect(() => {
    if (isScanningActive && !showScanner && !isLoading && !apiResponseMessage && !generalError) {
      // If scanning is active, but scanner isn't shown (e.g., after a message), show it.
      setShowScanner(true);
    } else if (!isScanningActive && showScanner) {
      // If scanning stopped, hide scanner.
      setShowScanner(false);
    }
  }, [isScanningActive, showScanner, isLoading, apiResponseMessage, generalError]);

  // Cleanup wake lock on component unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  // PWA Install prompt handling
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if app is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('install_prompt_dismissed', 'true');
  };




  const getResponseStyle = (status: ApiResponseStatus | null): string => {
    if (!status) return 'bg-slate-700 text-slate-200';
    switch (status) {
      case 'ok':
        return 'bg-green-600/90 text-white';
      case 'already registered':
        return 'bg-yellow-500/90 text-black';
      case 'id not known':
      case 'error':
        return 'bg-red-600/90 text-white';
      default:
        return 'bg-slate-600 text-slate-100';
    }
  };

  const getResponseIcon = (status: ApiResponseStatus | null): React.ReactNode => {
    if (!status) return null;
    switch (status) {
      case 'ok':
        return <CheckCircleIcon className="w-6 h-6 text-white" />;
      case 'already registered':
        return <ExclamationTriangleIcon className="w-6 h-6 text-black" />;
      case 'id not known':
      case 'error':
        return <XCircleIcon className="w-6 h-6 text-white" />;
      default:
        return null;
    }
  };
  
  const currentMessage = apiResponseMessage || generalError;
  const currentStatus = generalError ? 'error' : apiResponseStatus;

  // Conditional rendering based on PIN verification
  if (!isPinVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col items-center justify-center p-4">
        <PinInput correctPin={CORRECT_PIN} onPinVerified={handlePinVerified} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col items-center p-4 selection:bg-sky-500 selection:text-white">
      <header className="w-full max-w-md text-center my-8">
        <div className="mb-4">
          <img 
            src="/QRScannerJFS/logo.png" 
            alt="JFS 2025 Logo" 
            className="w-24 h-24 mx-auto mb-4 opacity-90"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">QR Check-in</h1>
        <p className="text-slate-400 mt-2">Continuous QR code scanning.</p>
      </header>

      <main className="w-full max-w-md bg-slate-800 shadow-2xl rounded-lg p-6 space-y-6 flex flex-col">
        <Button
          onClick={toggleScanning}
          className={`w-full text-white flex items-center justify-center space-x-2 transition-all duration-150 ease-in-out transform hover:scale-105 ${
            isScanningActive ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400' : 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-400'
          }`}
          disabled={isLoading && !isScanningActive} // Disable if initial loading before first scan start
        >
          <QrCodeIcon className="w-5 h-5" />
          <span>{isScanningActive ? (isLoading ? 'Processing...' : 'Stop Scanning') : 'Start Scanning'}</span>
        </Button>

        {/* Wake Lock Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-700 rounded-md">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-300">Keep screen on</span>
            {wakeLock && (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">Active</span>
            )}
          </div>
          <button
            onClick={toggleWakeLock}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              wakeLockEnabled ? 'bg-sky-600' : 'bg-slate-600'
            }`}
            aria-label="Toggle keep screen on"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                wakeLockEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* PWA Install Prompt */}
        {showInstallPrompt && (
          <div className="flex items-center justify-between p-3 bg-sky-900/50 rounded-md border border-sky-600">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-sky-200">📱 Install App</span>
              <span className="text-xs text-sky-300">Add to home screen for better experience</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleInstallClick}
                className="px-3 py-1 bg-sky-600 text-white text-sm rounded hover:bg-sky-500 transition-colors"
              >
                Install
              </button>
              <button
                onClick={dismissInstallPrompt}
                className="px-2 py-1 text-sky-300 text-sm hover:text-sky-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {isLoading && <LoadingSpinner />}

        {currentMessage && !isLoading && (
          <div 
            className={`mt-4 p-3 rounded-md flex items-center space-x-3 text-lg shadow-lg transition-opacity duration-300 ease-in-out ${getResponseStyle(currentStatus)} ${currentMessage ? 'opacity-100' : 'opacity-0'}`}
            role="alert"
            aria-live="assertive"
          >
            {getResponseIcon(currentStatus)}
            <span className="font-medium">{currentMessage}</span>
          </div>
        )}
        
        {!currentMessage && !isLoading && !showScanner && !isScanningActive && (
             <div className="text-center text-slate-400 py-4">
                Click "Start Scanning" to begin.
            </div>
        )}
        
        {!currentMessage && !isLoading && showScanner && (
             <div className="text-center text-sky-300 py-4 animate-pulse">
                Scanner active... position QR code.
            </div>
        )}


      </main>

      {showScanner && isScanningActive && (
        <Scanner
          onScanSuccess={handleScanSuccess}
          onScanError={handleScanError}
          onRequestClose={() => {
            // This close is usually triggered by the scanner's own UI (e.g. close button)
            // It should stop the active scanning session.
            setIsScanningActive(false);
            setShowScanner(false);
            // Release wake lock when scanner is closed
            releaseWakeLock();
          }}
        />
      )}
      <footer className="w-full max-w-md text-center text-slate-500 mt-auto py-6 text-sm">
        QR Check-in App v{import.meta.env.VITE_APP_VERSION || '1.0.0'} &copy; {new Date().getFullYear()} MeiLuft
        <br />
        <span className="text-xs text-slate-600 mt-1 block">Licensed under MIT License</span>
      </footer>
    </div>
  );
};

export default App;
