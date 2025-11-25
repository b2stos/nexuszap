export interface APIResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

export interface APIError {
  message: string;
  code?: string;
  details?: any;
}

export interface WhatsAppMessagePayload {
  to: string;
  message: string;
  mediaUrls?: string[];
}
