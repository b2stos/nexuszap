// src/services/authService.ts

import { apiClient } from '@/config/apiClient';
import { User } from '@/types/User';

/**
 * Serviço de autenticação com backend
 */
export class AuthService {
  /**
   * Realiza login no backend
   */
  static async login(email: string, password: string): Promise<{
    token: string;
    user: User;
  }> {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    if (response.token) {
      apiClient.setAuthToken(response.token);
    }

    return response;
  }

  /**
   * Realiza logout
   */
  static async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      apiClient.clearAuthToken();
    }
  }

  /**
   * Cria uma nova conta (register)
   */
  static async register(
    email: string,
    password: string,
    name: string
  ): Promise<{
    token: string;
    user: User;
  }> {
    const response = await apiClient.post('/auth/register', {
      email,
      password,
      name,
    });

    if (response.token) {
      apiClient.setAuthToken(response.token);
    }

    return response;
  }

  /**
   * Obtém o usuário atual
   */
  static async getCurrentUser(): Promise<User> {
    return apiClient.get('/auth/me');
  }

  /**
   * Refresh do token
   */
  static async refreshToken(): Promise<string> {
    const response = await apiClient.post('/auth/refresh');
    if (response.token) {
      apiClient.setAuthToken(response.token);
    }
    return response.token;
  }

  /**
   * Verifica se o token ainda é válido
   */
  static isTokenValid(): boolean {
    const token = localStorage.getItem('authToken');
    if (!token) return false;

    try {
      // Decodifica o JWT (sem verificar assinatura no client)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // converter para ms

      return Date.now() < expiresAt;
    } catch {
      return false;
    }
  }

  /**
   * Obtém o token atual
   */
  static getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * Define um novo token
   */
  static setToken(token: string): void {
    apiClient.setAuthToken(token);
  }
}
