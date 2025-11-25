// src/hooks/useAPI.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient, APIError } from '@/config/apiClient';

interface UseAPIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para gerenciar requisições à API
 * Exemplo de uso:
 * 
 * const { data, loading, error, execute } = useAPI();
 * 
 * const fetchUsers = async () => {
 *   await execute(() => apiClient.get('/users'));
 * };
 */
export function useAPI<T = any>() {
  const [state, setState] = useState<UseAPIState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const isMountedRef = useRef(true);

  /**
   * Executa uma requisição à API
   */
  const execute = useCallback(
    async (request: () => Promise<T>) => {
      if (!isMountedRef.current) return;

      setState({ data: null, loading: true, error: null });

      try {
        const result = await request();
        if (isMountedRef.current) {
          setState({ data: result, loading: false, error: null });
        }
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof APIError
            ? err.message
            : 'Erro ao carregar dados';

        if (isMountedRef.current) {
          setState({
            data: null,
            loading: false,
            error: errorMessage,
          });
        }

        throw err;
      }
    },
    []
  );

  /**
   * Limpa o estado de erro
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Reseta o estado completo
   */
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  // Cleanup ao desmontar o componente
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    execute,
    clearError,
    reset,
  };
}
