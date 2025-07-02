export type ApiResponseStatus = 'ok' | 'already registered' | 'id not known' | 'rejected' | 'error';

// CheckinData interface is no longer needed as per new requirements.

export interface CheckinApiResponse {
  status: ApiResponseStatus;
  message: string; // User-facing message for the status
  reason?: string; // Rejection reason (only present for 'rejected' status)
}
