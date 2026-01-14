/**
 * useCampaignDebug Hook
 * 
 * Gerencia estado de debug para campanhas.
 * Captura informações detalhadas de cada tentativa de envio.
 */

import { useState, useCallback } from 'react';
import type { DebugInfo } from '@/components/campaigns/CampaignDebugPanel';

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
  status?: number;
  responseText?: string;
  traceId?: string;
}

/**
 * Serializa qualquer erro para um objeto com todas as propriedades relevantes
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Captura causa se existir (ES2022 Error cause)
    if ('cause' in error && error.cause) {
      serialized.cause = error.cause;
    }

    // Tenta extrair informações do FunctionsHttpError do Supabase
    // deno-lint-ignore no-explicit-any
    const anyError = error as any;
    
    if (anyError.context) {
      serialized.cause = anyError.context;
    }
    
    if (anyError.status) {
      serialized.status = anyError.status;
    }
    
    if (anyError.details) {
      if (!serialized.cause) serialized.cause = {};
      (serialized.cause as Record<string, unknown>).details = anyError.details;
    }

    // Tenta extrair traceId da mensagem
    const traceMatch = error.message.match(/\(Trace: ([a-f0-9-]+)\)/i);
    if (traceMatch) {
      serialized.traceId = traceMatch[1];
    }

    return serialized;
  }

  // Erro não é instância de Error
  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      name: String(obj.name || 'UnknownError'),
      message: String(obj.message || JSON.stringify(error)),
      cause: obj,
    };
  }

  return { name: 'UnknownError', message: String(error) };
}

/**
 * Extrai traceId de uma resposta (body ou headers)
 */
export function extractTraceId(
  responseData: unknown,
  headers?: Headers
): string | undefined {
  // Tenta do header primeiro
  if (headers) {
    const headerTrace = headers.get('x-trace-id');
    if (headerTrace) return headerTrace;
  }

  // Tenta do body
  if (responseData && typeof responseData === 'object') {
    const data = responseData as Record<string, unknown>;
    if (typeof data.traceId === 'string') return data.traceId;
  }

  return undefined;
}

/**
 * Cria um resumo do payload sem dados sensíveis
 */
export function createPayloadSummary(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Remove tokens e chaves
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
      summary[key] = '***MASKED***';
      continue;
    }

    // Para arrays, mostra só o tamanho
    if (Array.isArray(value)) {
      summary[key] = `[Array: ${value.length} items]`;
      continue;
    }

    // Para objetos grandes, mostra resumo
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value as object);
      if (keys.length > 5) {
        summary[key] = `{Object: ${keys.length} keys}`;
      } else {
        summary[key] = value;
      }
      continue;
    }

    // Strings longas são truncadas
    if (typeof value === 'string' && value.length > 100) {
      summary[key] = value.slice(0, 100) + '...';
      continue;
    }

    summary[key] = value;
  }

  return summary;
}

/**
 * Hook para gerenciar estado de debug de campanhas
 */
export function useCampaignDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  /**
   * Registra uma tentativa de envio
   */
  const recordAttempt = useCallback((info: Partial<DebugInfo> & { endpoint: string; method: string }) => {
    setDebugInfo({
      timestamp: new Date().toISOString(),
      ...info,
    });
  }, []);

  /**
   * Registra erro de uma tentativa
   */
  const recordError = useCallback((
    endpoint: string,
    method: string,
    error: unknown,
    payload?: Record<string, unknown>,
    responseRaw?: string,
    status?: number,
    durationMs?: number
  ) => {
    const serialized = serializeError(error);

    setDebugInfo({
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      status,
      responseRaw,
      traceId: serialized.traceId,
      errorName: serialized.name,
      errorMessage: serialized.message,
      errorStack: serialized.stack,
      errorCause: serialized.cause,
      payloadSummary: payload ? createPayloadSummary(payload) : undefined,
      durationMs,
    });
  }, []);

  /**
   * Registra sucesso de uma tentativa
   */
  const recordSuccess = useCallback((
    endpoint: string,
    method: string,
    responseData: unknown,
    payload?: Record<string, unknown>,
    status = 200,
    durationMs?: number
  ) => {
    const traceId = extractTraceId(responseData);

    setDebugInfo({
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      status,
      statusText: 'OK',
      responseRaw: JSON.stringify(responseData, null, 2),
      traceId,
      payloadSummary: payload ? createPayloadSummary(payload) : undefined,
      durationMs,
    });
  }, []);

  /**
   * Limpa informações de debug
   */
  const clearDebug = useCallback(() => {
    setDebugInfo(null);
  }, []);

  return {
    debugInfo,
    recordAttempt,
    recordError,
    recordSuccess,
    clearDebug,
    setDebugInfo,
  };
}
