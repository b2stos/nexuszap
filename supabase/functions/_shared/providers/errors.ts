/**
 * Provider Error Handling
 * 
 * Padronização de erros entre providers.
 */

import { ErrorCategory, ProviderError } from './types.ts';

/**
 * Cria um ProviderError padronizado
 */
export function createProviderError(
  category: ErrorCategory,
  code: string,
  detail: string,
  raw?: unknown
): ProviderError {
  const is_retryable = category === 'rate_limit' || category === 'temporary';
  
  return {
    category,
    code,
    detail,
    is_retryable,
    raw,
  };
}

/**
 * Mapeia HTTP status codes para categorias de erro
 */
export function mapHttpStatusToCategory(status: number): ErrorCategory {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status >= 500) return 'temporary';
  return 'unknown';
}

/**
 * Extrai informações de erro de uma resposta HTTP
 */
export function extractErrorFromResponse(
  status: number,
  body: unknown,
  defaultMessage = 'Unknown error'
): ProviderError {
  const category = mapHttpStatusToCategory(status);
  
  let code = `HTTP_${status}`;
  let detail = defaultMessage;
  
  // Tenta extrair detalhes do body
  if (body && typeof body === 'object') {
    const errorBody = body as Record<string, unknown>;
    
    // WhatsApp Cloud API format
    if (errorBody.error && typeof errorBody.error === 'object') {
      const error = errorBody.error as Record<string, unknown>;
      const errorData = error.error_data as Record<string, unknown> | undefined;
      code = String(error.code || code);
      detail = String(error.message || errorData?.details || detail);
      
      // Categorias específicas do WhatsApp
      if (code === '131026') {
        return createProviderError('recipient_error', code, 'Message failed to send because more than 24 hours have passed since the customer last replied', body);
      }
      if (code === '132000' || code === '132001') {
        return createProviderError('template_error', code, detail, body);
      }
    }
    
    // Generic format
    if (errorBody.message) {
      detail = String(errorBody.message);
    }
    if (errorBody.code) {
      code = String(errorBody.code);
    }
  }
  
  return createProviderError(category, code, detail, body);
}

/**
 * Classe de exceção para erros de provider
 */
export class ProviderException extends Error {
  public readonly providerError: ProviderError;
  
  constructor(error: ProviderError) {
    super(`[${error.category}] ${error.code}: ${error.detail}`);
    this.name = 'ProviderException';
    this.providerError = error;
  }
}

/**
 * Verifica se um erro é retryable com base em sua categoria
 */
export function isRetryableError(error: ProviderError): boolean {
  return error.is_retryable;
}

/**
 * Calcula delay para retry com exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 30000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}
