import { CheckinApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL;
const TOKEN = import.meta.env.VITE_TOKEN;

if (!API_URL || !TOKEN) {
  console.error("CRITICAL: Environment variables VITE_API_URL or VITE_TOKEN are not set. Please check your .env file.");
  alert("Application is not configured correctly. Please contact an administrator.");
}

export const sendCheckinId = async (id: string): Promise<CheckinApiResponse> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return { status: 'error', message: 'Error: No ID provided or invalid ID format.' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': TOKEN,
      },
      body: JSON.stringify({ id }),
    });

    let responseData;
    try {
      // Per the API spec, all responses should be JSON.
      responseData = await response.json();
    } catch (e) {
      console.error("API response was not valid JSON.", { status: response.status, statusText: response.statusText });
      return {
        status: 'error',
        message: `Server returned an invalid response (HTTP ${response.status}). Please try again later.`
      };
    }
    
    // The API spec indicates that the JSON body will always contain 'status' and 'message'.
    // This holds true for both success (2xx) and error (4xx, 5xx) HTTP codes.
    if (responseData && typeof responseData.status === 'string' && typeof responseData.message === 'string') {
        // This correctly handles "ok", "already registered", "id not known", and specific "error" statuses from the server
        // as they all conform to the CheckinApiResponse interface.
        return responseData as CheckinApiResponse;
    } else {
        // This is a fallback for when the server returns JSON, but it's not in the expected {status, message} format.
        console.error("API response JSON has an unexpected structure:", responseData);
        return {
            status: 'error',
            message: `Received a malformed response from the server (HTTP ${response.status}).`
        };
    }

  } catch (error: any) {
    console.error("API call failed:", error);
    // This block catches network-level errors. The "Failed to fetch" error lands here.
    let message = "A network error occurred. Please check your connection and try again.";
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // This is the specific error the user mentioned.
        // It's most commonly a CORS issue or a complete failure to connect to the server.
        message = "Could not connect to the check-in server. This may be a network issue or a server configuration problem (CORS). Please contact an administrator.";
    }
    return { status: 'error', message };
  }
};


