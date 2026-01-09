/**
 * Database Mapping Helpers
 * 
 * Funções para mapear eventos do provider para estruturas do banco.
 * Estas funções NÃO escrevem no banco, apenas preparam os dados.
 */

import {
  InboundMessageEvent,
  StatusUpdateEvent,
  MappedContact,
  MappedConversation,
  MappedMessage,
  MappedStatusUpdate,
  DeliveryStatus,
} from './types.ts';

/**
 * Mapeia evento inbound para dados de contato
 */
export function mapInboundToContact(event: InboundMessageEvent): MappedContact {
  return {
    phone: event.from_phone,
    // Nome pode vir do webhook em alguns casos (context do WhatsApp)
    name: undefined,
  };
}

/**
 * Mapeia evento inbound para dados de conversa
 */
export function mapInboundToConversation(
  event: InboundMessageEvent,
  channelId: string
): MappedConversation {
  let preview = event.text?.substring(0, 100);
  
  if (!preview && event.media) {
    preview = `[${event.message_type}]`;
  } else if (!preview && event.location) {
    preview = '[location]';
  } else if (!preview && event.contacts?.length) {
    preview = '[contact]';
  }
  
  return {
    channel_id: channelId,
    contact_phone: event.from_phone,
    last_inbound_at: event.timestamp,
    last_message_at: event.timestamp,
    last_message_preview: preview,
  };
}

/**
 * Mapeia evento inbound para dados de mensagem
 */
export function mapInboundToMessage(event: InboundMessageEvent): MappedMessage {
  return {
    direction: 'inbound',
    type: event.message_type,
    content: event.text,
    media_url: event.media?.url,
    media_mime_type: event.media?.mime_type,
    media_filename: event.media?.filename,
    provider_message_id: event.provider_message_id,
    status: 'delivered', // Inbound já foi entregue
    created_at: event.timestamp,
  };
}

/**
 * Mapeia evento de status para atualização de mensagem
 */
export function mapStatusToUpdate(event: StatusUpdateEvent): MappedStatusUpdate {
  const update: MappedStatusUpdate = {
    provider_message_id: event.provider_message_id,
    status: event.status,
  };
  
  // Timestamps baseados no status
  switch (event.status) {
    case 'sent':
      update.sent_at = event.timestamp;
      break;
    case 'delivered':
      update.delivered_at = event.timestamp;
      break;
    case 'read':
      update.read_at = event.timestamp;
      break;
    case 'failed':
      update.failed_at = event.timestamp;
      update.error_code = event.error?.code;
      update.error_detail = event.error?.detail;
      break;
  }
  
  return update;
}

/**
 * Verifica se está dentro da janela de 24h
 */
export function isWithin24hWindow(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  
  const now = new Date();
  const diff = now.getTime() - lastInboundAt.getTime();
  const hours24 = 24 * 60 * 60 * 1000;
  
  return diff <= hours24;
}

/**
 * Calcula tempo restante na janela de 24h
 */
export function getTimeRemainingIn24hWindow(lastInboundAt: Date | null): {
  isOpen: boolean;
  remainingMs: number;
  remainingFormatted: string;
} {
  if (!lastInboundAt) {
    return {
      isOpen: false,
      remainingMs: 0,
      remainingFormatted: 'Janela fechada',
    };
  }
  
  const now = new Date();
  const windowEnd = new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000);
  const remainingMs = Math.max(0, windowEnd.getTime() - now.getTime());
  
  if (remainingMs <= 0) {
    return {
      isOpen: false,
      remainingMs: 0,
      remainingFormatted: 'Janela fechada',
    };
  }
  
  // Format remaining time
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  
  return {
    isOpen: true,
    remainingMs,
    remainingFormatted: `${hours}h ${minutes}m restantes`,
  };
}

/**
 * Normaliza número de telefone para formato E.164
 */
export function normalizePhone(phone: string): string {
  // Remove caracteres não numéricos
  let digits = phone.replace(/\D/g, '');
  
  // Remove leading zeros
  digits = digits.replace(/^0+/, '');
  
  // Se for número brasileiro (10-11 dígitos), adiciona DDI
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  
  return digits;
}

/**
 * Formata número de telefone para exibição
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = normalizePhone(phone);
  
  // Formato brasileiro: +55 (11) 99999-9999
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.substring(2, 4);
    const rest = digits.substring(4);
    
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
    } else if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
    }
  }
  
  return `+${digits}`;
}
