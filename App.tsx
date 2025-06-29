import React, { useState, useCallback, useEffect, useRef } from 'react';
import Scanner from './components/Scanner';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { sendCheckinId, getScannedIdsList } from './services/apiService';
import { ID_REGEX } from './constants';
import { ApiResponseStatus, CheckinApiResponse } from './types';
import { QrCodeIcon } from './components/icons/QrCodeIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './components/icons/ExclamationTriangleIcon';
import { XCircleIcon } from './components/icons/XCircleIcon';

const MESSAGE_DISPLAY_DURATION = 3000; // 3 seconds

const App: React.FC = () => {
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [apiResponseMessage, setApiResponseMessage] = useState<string | null>(null);
  const [apiResponseStatus, setApiResponseStatus] = useState<ApiResponseStatus | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null); // For non-API, non-scan errors

  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);

  const [scannedIdsLog, setScannedIdsLog] = useState<Set<string>>(new Set());
  const [lastProcessedId, setLastProcessedId] = useState<string | null>(null); // For immediate duplicate prevention

  const messageTimeoutRef = useRef<number | null>(null);

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
    messageTimeoutRef.current = window.setTimeout(() => {
      clearMessage();
      // If scanning is active, ensure scanner is shown after message clears
      if (isScanningActive && !showScanner) {
        setShowScanner(true);
      }
    }, MESSAGE_DISPLAY_DURATION);
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
      displayMessage("Invalid QR code: Does not contain a valid check-in URL.", 'error', true);
      setScannedId(null);
      setIsLoading(false);
      if (isScanningActive) setShowScanner(true); // Re-show scanner if still active
      return;
    }
    
    setScannedId(id);

    // Prevent immediate re-scan of the exact same QR code from being processed
    if (id === lastProcessedId) {
      displayMessage(`ID "${id}" was just processed. Ignoring duplicate scan.`, 'already registered');
      setIsLoading(false);
      setLastProcessedId(null); // Reset to allow next distinct scan
      if (isScanningActive) setTimeout(() => setShowScanner(true), MESSAGE_DISPLAY_DURATION);
      return;
    }

    if (scannedIdsLog.has(id)) {
      displayMessage(`Warning: ID "${id}" has already been checked in.`, 'already registered');
      setIsLoading(false);
      setLastProcessedId(id); // Mark as processed for debounce
      if (isScanningActive) setTimeout(() => setShowScanner(true), MESSAGE_DISPLAY_DURATION);
      return;
    }

    try {
      const response = await sendCheckinId(id);
      if (response.status === 'ok') {
        setScannedIdsLog(prevLog => new Set(prevLog).add(id));
        displayMessage(`Checked In: ${id} - ${response.message}`, 'ok');
        setLastProcessedId(id);
      } else {
        displayMessage(`Problem with ID "${id}": ${response.message}`, response.status, response.status === 'error');
         // Do not set lastProcessedId here if it's an API error or ID not known,
         // allowing a retry if it was a transient issue.
      }
    } catch (e: any) {
      const apiErrorMessage = e.message || "Failed to contact service.";
      displayMessage(`API Error: ${apiErrorMessage}`, 'error', true);
    } finally {
      setIsLoading(false);
      if (isScanningActive) {
         // Delay showing scanner again to allow message to be read
         setTimeout(() => {
            if(isScanningActive) setShowScanner(true); // Check again in case user stopped scanning
         }, MESSAGE_DISPLAY_DURATION - 500); // Show slightly before message clears
      }
    }
  }, [isScanningActive, scannedIdsLog, lastProcessedId, displayMessage]);

  const handleScanError = useCallback((errorMessage: string) => {
    setShowScanner(false); // Hide scanner to show message
    displayMessage(`Scanner Error: ${errorMessage}`, 'error', true);
    if (isScanningActive) {
      setTimeout(() => {
        if(isScanningActive) setShowScanner(true);
      }, MESSAGE_DISPLAY_DURATION - 500);
    }
  }, [isScanningActive, displayMessage]);

  const toggleScanning = () => {
    clearMessage();
    setIsScanningActive(prev => {
      const newIsScanningActive = !prev;
      if (newIsScanningActive) {
        setShowScanner(true);
        setLastProcessedId(null); // Reset debounce on new "start"
      } else {
        setShowScanner(false);
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


  const handleShowScannedIds = () => {
    const idsArray = Array.from(scannedIdsLog);
    const jsonOutput = getScannedIdsList(idsArray);
    console.log("Scanned IDs:", jsonOutput);
    alert(`Scanned IDs (${idsArray.length}):\n\n${jsonOutput}\n\n(Also logged to console)`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col items-center p-4 selection:bg-sky-500 selection:text-white">
      <header className="w-full max-w-md text-center my-8">
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


        <Button
          onClick={handleShowScannedIds}
          variant="secondary"
          className="w-full mt-4"
          disabled={scannedIdsLog.size === 0}
        >
          Show {scannedIdsLog.size} Scanned ID(s)
        </Button>
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
          }}
        />
      )}
      <footer className="w-full max-w-md text-center text-slate-500 mt-auto py-6 text-sm">
        QR Check-in App &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
