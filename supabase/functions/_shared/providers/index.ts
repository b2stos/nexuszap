/**
 * Provider Registry
 * 
 * Factory para obter providers por nome.
 */

import { Provider, Channel } from './types.ts';
import { notificameProvider } from './notificame.ts';
import { createProviderError, ProviderException } from './errors.ts';

// ============================================
// PROVIDER REGISTRY
// ============================================

const providers: Record<string, Provider> = {
  notificame: notificameProvider,
};

/**
 * Obtém um provider pelo nome
 */
export function getProvider(name: string): Provider {
  const provider = providers[name];
  
  if (!provider) {
    throw new ProviderException(
      createProviderError(
        'invalid_request',
        'UNKNOWN_PROVIDER',
        `Provider '${name}' not found. Available: ${Object.keys(providers).join(', ')}`
      )
    );
  }
  
  return provider;
}

/**
 * Obtém o provider de um channel
 */
export function getProviderForChannel(channel: Channel, providerName: string): Provider {
  return getProvider(providerName);
}

/**
 * Lista providers disponíveis
 */
export function listProviders(): string[] {
  return Object.keys(providers);
}

/**
 * Registra um novo provider (para extensibilidade)
 */
export function registerProvider(name: string, provider: Provider): void {
  providers[name] = provider;
}

// ============================================
// RE-EXPORTS
// ============================================

export * from './types.ts';
export * from './errors.ts';
export { notificameProvider } from './notificame.ts';
