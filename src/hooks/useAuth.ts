// src/hooks/useAuth.ts

import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '@/services/authService';
import { User } from '@/types/User';
import { useAPI } from './useAPI';

interface UseAuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

/**
 * Hook para gerenciar autenticação
 */
export function useAuth() {
  const [state, setState] = useState<UseAuthState>({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
  });

  const { execute: loginExecute } = useAPI();
  const { execute: registerExecute } = useAPI();
  const { execute: getCurrentUserExecute } = useAPI();

  /**
   * Verifica se tem token válido ao montar o componente
   */
  useEffect(() => {
    const checkAuth = async () => {
      if (!AuthService.isTokenValid()) {
        AuthService.setToken('');
        return;
      }

      try {
        const user = await getCurrentUserExecute(() =>
          AuthService.getCurrentUser()
        );
        setState({
          user,
          loading: false,
          error: null,
          isAuthenticated: true,
        });
      } catch (error) {
        setState({
          user: null,
          loading: false,
          error: 'Erro ao carregar usuário',
          isAuthenticated: false,
        });
      }
    };

    checkAuth();
  }, [getCurrentUserExecute]);

  /**
   * Realiza login
   */
  const login = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { token, user } = await loginExecute(() =>
          AuthService.login(email, password)
        );

        setState({
          user,
          loading: false,
          error: null,
          isAuthenticated: true,
        });

        return { token, user };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Erro ao fazer login';

        setState({
          user: null,
          loading: false,
          error: errorMsg,
          isAuthenticated: false,
        });

        throw error;
      }
    },
    [loginExecute]
  );

  /**
   * Realiza registro
   */
  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { token, user } = await registerExecute(() =>
          AuthService.register(email, password, name)
        );

        setState({
          user,
          loading: false,
          error: null,
          isAuthenticated: true,
        });

        return { token, user };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Erro ao registrar';

        setState({
          user: null,
          loading: false,
          error: errorMsg,
          isAuthenticated: false,
        });

        throw error;
      }
    },
    [registerExecute]
  );

  /**
   * Realiza logout
   */
  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } finally {
      setState({
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      });
    }
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
  };
}
