// src/config/apiClient.ts

/**
 * Configuração centralizada da API
 * Funciona em desenvolvimento (localhost) e produção
 */

const isDevelopment = import.meta.env.MODE === 'development';

export const API_CONFIG = {
  // Use diferentes URLs conforme o ambiente
  baseURL: isDevelopment 
    ? 'http://localhost:3000'
    : import.meta.env.VITE_API_URL || 'https://api.nexuszap.com',
    
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Cliente HTTP com tratamento de erros
 */
export class APIClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.loadAuthToken();
  }

  /**
   * Carrega token do localStorage
   */
  private loadAuthToken(): void {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('authToken');
    }
  }

  /**
   * Define o token de autenticação
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  /**
   * Limpa o token (logout)
   */
  clearAuthToken(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Headers padrão para requisições
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Faz requisição GET
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * Faz requisição POST
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Faz requisição PUT
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Faz requisição DELETE
   */
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Método genérico de requisição com tratamento de erros
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const url = `${this.baseURL}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers as Record<string, string>),
        },
        signal: AbortSignal.timeout(API_CONFIG.timeout),
      });

      // Tratamento de erros HTTP
      if (!response.ok) {
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          await response.text()
        );
      }

      // Se a resposta estiver vazia, retorna null
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new APIError('Erro de conexão. Verifique sua internet.', 0, '');
      }

      throw new APIError('Erro desconhecido', 0, '');
    }
  }
}

/**
 * Classe customizada para erros de API
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Instância singleton do cliente API
 */
export const apiClient = new APIClient();
