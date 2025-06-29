export type ApiResponseStatus = 'ok' | 'already registered' | 'id not known' | 'error';

// CheckinData interface is no longer needed as per new requirements.

export interface CheckinApiResponse {
  status: ApiResponseStatus;
  message: string; // User-facing message for the status
}
