/**
 * Demo Inbox Data
 * 
 * Dados fictícios para o Demo Mode do Inbox
 * 12 conversas, 12 contatos, 8+ mensagens por conversa
 * Temáticas variadas: orçamento, dúvida de preço, agendamento, pós-venda, suporte, catálogo, pagamento
 */

import { InboxConversation, InboxMessage, InboxContact } from '@/types/inbox';

// Helper para gerar IDs únicos
const generateId = () => `demo-${Math.random().toString(36).substring(2, 11)}`;

// Helper para datas relativas
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// ============================================
// CONTATOS FICTÍCIOS (12)
// ============================================

export const demoContacts: InboxContact[] = [
  {
    id: 'contact-1',
    name: 'Maria Silva',
    phone: '5511987654321',
    avatar_url: null,
    last_interaction_at: minutesAgo(5),
  },
  {
    id: 'contact-2',
    name: 'João Santos',
    phone: '5521998765432',
    avatar_url: null,
    last_interaction_at: minutesAgo(15),
  },
  {
    id: 'contact-3',
    name: 'Ana Oliveira',
    phone: '5531976543210',
    avatar_url: null,
    last_interaction_at: minutesAgo(45),
  },
  {
    id: 'contact-4',
    name: 'Pedro Costa',
    phone: '5541965432109',
    avatar_url: null,
    last_interaction_at: hoursAgo(2),
  },
  {
    id: 'contact-5',
    name: 'Carla Souza',
    phone: '5551954321098',
    avatar_url: null,
    last_interaction_at: hoursAgo(4),
  },
  {
    id: 'contact-6',
    name: 'Lucas Ferreira',
    phone: '5561943210987',
    avatar_url: null,
    last_interaction_at: hoursAgo(6),
  },
  {
    id: 'contact-7',
    name: 'Juliana Lima',
    phone: '5571932109876',
    avatar_url: null,
    last_interaction_at: hoursAgo(12),
  },
  {
    id: 'contact-8',
    name: 'Roberto Mendes',
    phone: '5581921098765',
    avatar_url: null,
    last_interaction_at: hoursAgo(18),
  },
  {
    id: 'contact-9',
    name: 'Fernanda Rocha',
    phone: '5591910987654',
    avatar_url: null,
    last_interaction_at: daysAgo(1),
  },
  {
    id: 'contact-10',
    name: 'Thiago Almeida',
    phone: '5585909876543',
    avatar_url: null,
    last_interaction_at: daysAgo(2),
  },
  {
    id: 'contact-11',
    name: 'Beatriz Martins',
    phone: '5562908765432',
    avatar_url: null,
    last_interaction_at: daysAgo(3),
  },
  {
    id: 'contact-12',
    name: 'Ricardo Gomes',
    phone: '5548907654321',
    avatar_url: null,
    last_interaction_at: daysAgo(5),
  },
];

// ============================================
// CONVERSAS FICTÍCIAS (12)
// ============================================

const baseTenantId = 'demo-tenant';
const baseChannelId = 'demo-channel';

export const demoConversations: InboxConversation[] = [
  // Conversa 1 - Orçamento (unread)
  {
    id: 'conv-1',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-1',
    status: 'open',
    assigned_user_id: null,
    unread_count: 3,
    is_pinned: true,
    last_message_at: minutesAgo(5),
    last_inbound_at: minutesAgo(5),
    last_message_preview: 'Aguardo o orçamento, por favor!',
    created_at: daysAgo(2),
    updated_at: minutesAgo(5),
    contact: demoContacts[0],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 2 - Dúvida de preço (unread)
  {
    id: 'conv-2',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-2',
    status: 'open',
    assigned_user_id: null,
    unread_count: 2,
    is_pinned: false,
    last_message_at: minutesAgo(15),
    last_inbound_at: minutesAgo(15),
    last_message_preview: 'Qual o valor do plano mensal?',
    created_at: daysAgo(1),
    updated_at: minutesAgo(15),
    contact: demoContacts[1],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 3 - Agendamento (unread)
  {
    id: 'conv-3',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-3',
    status: 'open',
    assigned_user_id: null,
    unread_count: 1,
    is_pinned: false,
    last_message_at: minutesAgo(45),
    last_inbound_at: minutesAgo(45),
    last_message_preview: 'Posso agendar para amanhã às 14h?',
    created_at: daysAgo(3),
    updated_at: minutesAgo(45),
    contact: demoContacts[2],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 4 - Suporte
  {
    id: 'conv-4',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-4',
    status: 'open',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: hoursAgo(2),
    last_inbound_at: hoursAgo(3),
    last_message_preview: 'Pronto, problema resolvido! Qualquer dúvida estou à disposição.',
    created_at: daysAgo(1),
    updated_at: hoursAgo(2),
    contact: demoContacts[3],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 5 - Pós-venda
  {
    id: 'conv-5',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-5',
    status: 'open',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: hoursAgo(4),
    last_inbound_at: hoursAgo(5),
    last_message_preview: 'Obrigada pelo feedback! Fico feliz que esteja satisfeita.',
    created_at: daysAgo(5),
    updated_at: hoursAgo(4),
    contact: demoContacts[4],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 6 - Catálogo
  {
    id: 'conv-6',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-6',
    status: 'open',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: hoursAgo(6),
    last_inbound_at: hoursAgo(7),
    last_message_preview: 'Segue o link do nosso catálogo atualizado!',
    created_at: daysAgo(2),
    updated_at: hoursAgo(6),
    contact: demoContacts[5],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 7 - Confirmação de pagamento
  {
    id: 'conv-7',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-7',
    status: 'open',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: hoursAgo(12),
    last_inbound_at: hoursAgo(13),
    last_message_preview: 'Pagamento confirmado! Seu pedido será enviado em breve.',
    created_at: daysAgo(1),
    updated_at: hoursAgo(12),
    contact: demoContacts[6],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 8 - Dúvida geral
  {
    id: 'conv-8',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-8',
    status: 'open',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: hoursAgo(18),
    last_inbound_at: hoursAgo(20),
    last_message_preview: 'Nosso horário de funcionamento é de seg a sex, das 9h às 18h.',
    created_at: daysAgo(4),
    updated_at: hoursAgo(18),
    contact: demoContacts[7],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 9 - Resolvida
  {
    id: 'conv-9',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-9',
    status: 'resolved',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: daysAgo(1),
    last_inbound_at: daysAgo(1),
    last_message_preview: 'Muito obrigada pela ajuda!',
    created_at: daysAgo(7),
    updated_at: daysAgo(1),
    contact: demoContacts[8],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 10 - Janela fechada
  {
    id: 'conv-10',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-10',
    status: 'open',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: daysAgo(2),
    last_inbound_at: daysAgo(2),
    last_message_preview: 'Vou analisar e retorno.',
    created_at: daysAgo(10),
    updated_at: daysAgo(2),
    contact: demoContacts[9],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 11 - Arquivada
  {
    id: 'conv-11',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-11',
    status: 'archived',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: daysAgo(3),
    last_inbound_at: daysAgo(4),
    last_message_preview: 'Até a próxima!',
    created_at: daysAgo(15),
    updated_at: daysAgo(3),
    contact: demoContacts[10],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
  // Conversa 12 - Antiga
  {
    id: 'conv-12',
    tenant_id: baseTenantId,
    channel_id: baseChannelId,
    contact_id: 'contact-12',
    status: 'resolved',
    assigned_user_id: null,
    unread_count: 0,
    is_pinned: false,
    last_message_at: daysAgo(5),
    last_inbound_at: daysAgo(6),
    last_message_preview: 'Perfeito, obrigado pelo retorno!',
    created_at: daysAgo(20),
    updated_at: daysAgo(5),
    contact: demoContacts[11],
    channel: { id: baseChannelId, name: 'WhatsApp Principal', phone_number: '5511999999999' },
  },
];

// ============================================
// MENSAGENS FICTÍCIAS (8+ por conversa)
// ============================================

// URLs de mídia fictícias (usando placeholders públicos)
const DEMO_MEDIA = {
  // Imagens
  product1: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
  product2: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
  receipt: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
  screenshot: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
  logo: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=400',
  // Documentos (usando URLs fictícias - o sistema mostrará o ícone)
  pdf_proposal: 'https://example.com/docs/proposta-comercial.pdf',
  pdf_catalog: 'https://example.com/docs/catalogo-2024.pdf',
  pdf_contract: 'https://example.com/docs/contrato-servico.pdf',
  xlsx_report: 'https://example.com/docs/relatorio-mensal.xlsx',
  // Áudios (usando URLs fictícias - o sistema mostrará o player)
  audio1: 'https://example.com/audio/mensagem-voz-1.ogg',
  audio2: 'https://example.com/audio/mensagem-voz-2.ogg',
};

function createMessage(
  id: string,
  conversationId: string,
  contactId: string,
  direction: 'inbound' | 'outbound',
  content: string,
  createdAt: string,
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' = 'read'
): InboxMessage {
  return {
    id,
    tenant_id: baseTenantId,
    conversation_id: conversationId,
    channel_id: baseChannelId,
    contact_id: contactId,
    direction,
    type: 'text',
    content,
    media_url: null,
    media_mime_type: null,
    media_filename: null,
    template_name: null,
    provider_message_id: `provider-${id}`,
    status: direction === 'inbound' ? 'delivered' : status,
    error_code: status === 'failed' ? 'DELIVERY_FAILED' : null,
    error_detail: status === 'failed' ? 'Mensagem não pôde ser entregue' : null,
    reply_to_message_id: null,
    sent_by_user_id: direction === 'outbound' ? 'demo-user' : null,
    sent_at: direction === 'outbound' ? createdAt : null,
    delivered_at: status === 'delivered' || status === 'read' ? createdAt : null,
    read_at: status === 'read' ? createdAt : null,
    failed_at: status === 'failed' ? createdAt : null,
    created_at: createdAt,
  };
}

function createImageMessage(
  id: string,
  conversationId: string,
  contactId: string,
  direction: 'inbound' | 'outbound',
  imageUrl: string,
  caption: string | null,
  createdAt: string,
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' = 'read'
): InboxMessage {
  return {
    id,
    tenant_id: baseTenantId,
    conversation_id: conversationId,
    channel_id: baseChannelId,
    contact_id: contactId,
    direction,
    type: 'image',
    content: caption,
    media_url: imageUrl,
    media_mime_type: 'image/jpeg',
    media_filename: 'imagem.jpg',
    template_name: null,
    provider_message_id: `provider-${id}`,
    status: direction === 'inbound' ? 'delivered' : status,
    error_code: null,
    error_detail: null,
    reply_to_message_id: null,
    sent_by_user_id: direction === 'outbound' ? 'demo-user' : null,
    sent_at: direction === 'outbound' ? createdAt : null,
    delivered_at: status === 'delivered' || status === 'read' ? createdAt : null,
    read_at: status === 'read' ? createdAt : null,
    failed_at: null,
    created_at: createdAt,
  };
}

function createDocumentMessage(
  id: string,
  conversationId: string,
  contactId: string,
  direction: 'inbound' | 'outbound',
  docUrl: string,
  filename: string,
  mimeType: string,
  caption: string | null,
  createdAt: string,
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' = 'read'
): InboxMessage {
  return {
    id,
    tenant_id: baseTenantId,
    conversation_id: conversationId,
    channel_id: baseChannelId,
    contact_id: contactId,
    direction,
    type: 'document',
    content: caption,
    media_url: docUrl,
    media_mime_type: mimeType,
    media_filename: filename,
    template_name: null,
    provider_message_id: `provider-${id}`,
    status: direction === 'inbound' ? 'delivered' : status,
    error_code: null,
    error_detail: null,
    reply_to_message_id: null,
    sent_by_user_id: direction === 'outbound' ? 'demo-user' : null,
    sent_at: direction === 'outbound' ? createdAt : null,
    delivered_at: status === 'delivered' || status === 'read' ? createdAt : null,
    read_at: status === 'read' ? createdAt : null,
    failed_at: null,
    created_at: createdAt,
  };
}

function createAudioMessage(
  id: string,
  conversationId: string,
  contactId: string,
  direction: 'inbound' | 'outbound',
  audioUrl: string,
  createdAt: string,
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' = 'read'
): InboxMessage {
  return {
    id,
    tenant_id: baseTenantId,
    conversation_id: conversationId,
    channel_id: baseChannelId,
    contact_id: contactId,
    direction,
    type: 'audio',
    content: null,
    media_url: audioUrl,
    media_mime_type: 'audio/ogg',
    media_filename: 'audio.ogg',
    template_name: null,
    provider_message_id: `provider-${id}`,
    status: direction === 'inbound' ? 'delivered' : status,
    error_code: null,
    error_detail: null,
    reply_to_message_id: null,
    sent_by_user_id: direction === 'outbound' ? 'demo-user' : null,
    sent_at: direction === 'outbound' ? createdAt : null,
    delivered_at: status === 'delivered' || status === 'read' ? createdAt : null,
    read_at: status === 'read' ? createdAt : null,
    failed_at: null,
    created_at: createdAt,
  };
}

// Conversa 1 - Orçamento (com documento PDF)
const conv1Messages: InboxMessage[] = [
  createMessage('msg-1-1', 'conv-1', 'contact-1', 'inbound', 'Olá, boa tarde!', hoursAgo(3)),
  createMessage('msg-1-2', 'conv-1', 'contact-1', 'outbound', 'Olá Maria! Tudo bem? Como posso ajudar?', hoursAgo(2.9), 'read'),
  createMessage('msg-1-3', 'conv-1', 'contact-1', 'inbound', 'Gostaria de solicitar um orçamento para o serviço de marketing digital', hoursAgo(2.8)),
  createMessage('msg-1-4', 'conv-1', 'contact-1', 'outbound', 'Claro! Para qual tipo de serviço? Temos pacotes de gestão de redes sociais, tráfego pago e conteúdo.', hoursAgo(2.7), 'read'),
  createMessage('msg-1-5', 'conv-1', 'contact-1', 'inbound', 'Estou interessada no pacote completo com gestão de redes e tráfego pago', hoursAgo(2)),
  createMessage('msg-1-6', 'conv-1', 'contact-1', 'outbound', 'Ótima escolha! Vou preparar um orçamento personalizado. Qual o segmento da sua empresa?', hoursAgo(1.8), 'read'),
  createMessage('msg-1-7', 'conv-1', 'contact-1', 'inbound', 'Sou do ramo de moda feminina, tenho uma loja online', hoursAgo(1)),
  createDocumentMessage('msg-1-8', 'conv-1', 'contact-1', 'outbound', DEMO_MEDIA.pdf_proposal, 'Proposta_Comercial_MarketingDigital.pdf', 'application/pdf', 'Segue nossa proposta comercial! 📄', hoursAgo(0.5), 'delivered'),
  createMessage('msg-1-9', 'conv-1', 'contact-1', 'inbound', 'Ótimo! Aguardo o orçamento, por favor!', minutesAgo(5)),
];

// Conversa 2 - Dúvida de preço (com áudio)
const conv2Messages: InboxMessage[] = [
  createMessage('msg-2-1', 'conv-2', 'contact-2', 'inbound', 'Boa tarde', hoursAgo(4)),
  createMessage('msg-2-2', 'conv-2', 'contact-2', 'outbound', 'Boa tarde João! Seja bem-vindo! 😊', hoursAgo(3.9), 'read'),
  createAudioMessage('msg-2-3', 'conv-2', 'contact-2', 'inbound', DEMO_MEDIA.audio1, hoursAgo(3.8)),
  createMessage('msg-2-4', 'conv-2', 'contact-2', 'outbound', 'Que bom! Posso te ajudar com informações sobre nossos planos?', hoursAgo(3.7), 'read'),
  createMessage('msg-2-5', 'conv-2', 'contact-2', 'inbound', 'Sim, por favor. Vocês trabalham com planos mensais?', hoursAgo(2)),
  createAudioMessage('msg-2-6', 'conv-2', 'contact-2', 'outbound', DEMO_MEDIA.audio2, hoursAgo(1.8), 'read'),
  createMessage('msg-2-7', 'conv-2', 'contact-2', 'inbound', 'Entendi. E qual o valor do plano mensal?', minutesAgo(15)),
];

// Conversa 3 - Agendamento
const conv3Messages: InboxMessage[] = [
  createMessage('msg-3-1', 'conv-3', 'contact-3', 'inbound', 'Olá! Preciso agendar uma reunião', hoursAgo(5)),
  createMessage('msg-3-2', 'conv-3', 'contact-3', 'outbound', 'Olá Ana! Claro, qual o melhor dia e horário para você?', hoursAgo(4.9), 'read'),
  createMessage('msg-3-3', 'conv-3', 'contact-3', 'inbound', 'Essa semana fica difícil. Pode ser semana que vem?', hoursAgo(4.5)),
  createMessage('msg-3-4', 'conv-3', 'contact-3', 'outbound', 'Sem problemas! Temos disponibilidade na segunda e terça, manhã ou tarde.', hoursAgo(4.3), 'read'),
  createMessage('msg-3-5', 'conv-3', 'contact-3', 'inbound', 'Segunda está ótimo!', hoursAgo(3)),
  createMessage('msg-3-6', 'conv-3', 'contact-3', 'outbound', 'Perfeito! Prefere às 10h ou 14h?', hoursAgo(2.8), 'read'),
  createMessage('msg-3-7', 'conv-3', 'contact-3', 'inbound', 'Às 14h seria melhor para mim', hoursAgo(2)),
  createMessage('msg-3-8', 'conv-3', 'contact-3', 'outbound', 'Anotado! Segunda-feira às 14h está confirmado. Te envio o link da reunião por aqui mesmo, ok?', hoursAgo(1.5), 'read'),
  createMessage('msg-3-9', 'conv-3', 'contact-3', 'inbound', 'Posso agendar para amanhã às 14h?', minutesAgo(45)),
];

// Conversa 4 - Suporte técnico (com screenshot)
const conv4Messages: InboxMessage[] = [
  createMessage('msg-4-1', 'conv-4', 'contact-4', 'inbound', 'Estou com um problema no sistema', hoursAgo(5)),
  createMessage('msg-4-2', 'conv-4', 'contact-4', 'outbound', 'Olá Pedro! Pode me descrever o que está acontecendo?', hoursAgo(4.9), 'read'),
  createMessage('msg-4-3', 'conv-4', 'contact-4', 'inbound', 'Não consigo acessar o painel de relatórios. Fica carregando infinitamente.', hoursAgo(4.8)),
  createImageMessage('msg-4-4', 'conv-4', 'contact-4', 'inbound', DEMO_MEDIA.screenshot, 'Olha o erro que aparece na tela', hoursAgo(4.7)),
  createMessage('msg-4-5', 'conv-4', 'contact-4', 'outbound', 'Entendi. Você já tentou limpar o cache do navegador?', hoursAgo(4.5), 'read'),
  createMessage('msg-4-6', 'conv-4', 'contact-4', 'inbound', 'Sim, já tentei e não funcionou', hoursAgo(4)),
  createMessage('msg-4-7', 'conv-4', 'contact-4', 'outbound', 'Ok, vou verificar no sistema. Um momento, por favor...', hoursAgo(3.8), 'read'),
  createMessage('msg-4-8', 'conv-4', 'contact-4', 'outbound', 'Encontrei o problema! Era uma configuração de permissão. Já corrigi aqui. Pode tentar acessar novamente?', hoursAgo(3.2), 'read'),
  createMessage('msg-4-9', 'conv-4', 'contact-4', 'inbound', 'Agora funcionou! Muito obrigado!', hoursAgo(3)),
  createMessage('msg-4-10', 'conv-4', 'contact-4', 'outbound', 'Pronto, problema resolvido! Qualquer dúvida estou à disposição.', hoursAgo(2), 'read'),
];

// Conversa 5 - Pós-venda (com imagem de produto)
const conv5Messages: InboxMessage[] = [
  createMessage('msg-5-1', 'conv-5', 'contact-5', 'outbound', 'Olá Carla! Passando para saber como está sendo sua experiência com nosso serviço 😊', hoursAgo(8), 'read'),
  createMessage('msg-5-2', 'conv-5', 'contact-5', 'inbound', 'Oi! Está tudo ótimo! Muito satisfeita com os resultados', hoursAgo(7)),
  createMessage('msg-5-3', 'conv-5', 'contact-5', 'outbound', 'Que maravilha! Fico muito feliz em saber! 🎉', hoursAgo(6.8), 'read'),
  createImageMessage('msg-5-4', 'conv-5', 'contact-5', 'inbound', DEMO_MEDIA.product1, 'Olha esse produto que chegou! Amei!', hoursAgo(6.5)),
  createMessage('msg-5-5', 'conv-5', 'contact-5', 'outbound', 'Uau! Que foto linda! Fico feliz que gostou! 🚀', hoursAgo(6.3), 'read'),
  createMessage('msg-5-6', 'conv-5', 'contact-5', 'inbound', 'Vocês estão de parabéns pelo trabalho', hoursAgo(5.5)),
  createMessage('msg-5-7', 'conv-5', 'contact-5', 'outbound', 'Obrigada pelo feedback! Fico feliz que esteja satisfeita.', hoursAgo(5), 'read'),
  createMessage('msg-5-8', 'conv-5', 'contact-5', 'inbound', 'Vou indicar para outras amigas empresárias!', hoursAgo(4.5)),
  createMessage('msg-5-9', 'conv-5', 'contact-5', 'outbound', 'Agradeço demais! Se precisar de algo, é só chamar! 💚', hoursAgo(4), 'read'),
];

// Conversa 6 - Catálogo (com PDF de catálogo)
const conv6Messages: InboxMessage[] = [
  createMessage('msg-6-1', 'conv-6', 'contact-6', 'inbound', 'Olá, vocês tem catálogo de produtos?', hoursAgo(10)),
  createMessage('msg-6-2', 'conv-6', 'contact-6', 'outbound', 'Olá Lucas! Sim, temos! Posso enviar para você agora mesmo.', hoursAgo(9.8), 'read'),
  createMessage('msg-6-3', 'conv-6', 'contact-6', 'inbound', 'Por favor!', hoursAgo(9.5)),
  createDocumentMessage('msg-6-4', 'conv-6', 'contact-6', 'outbound', DEMO_MEDIA.pdf_catalog, 'Catalogo_Produtos_2024.pdf', 'application/pdf', 'Segue nosso catálogo completo! 📚', hoursAgo(9.3), 'read'),
  createMessage('msg-6-5', 'conv-6', 'contact-6', 'inbound', 'Recebi! Vou dar uma olhada', hoursAgo(9)),
  createMessage('msg-6-6', 'conv-6', 'contact-6', 'outbound', 'Ótimo! Qualquer dúvida sobre os produtos, estou à disposição!', hoursAgo(8.5), 'read'),
  createImageMessage('msg-6-7', 'conv-6', 'contact-6', 'inbound', DEMO_MEDIA.product2, 'Esse aqui está disponível?', hoursAgo(7)),
  createMessage('msg-6-8', 'conv-6', 'contact-6', 'outbound', 'Sim! Temos em estoque. Deseja fazer o pedido?', hoursAgo(6.5), 'read'),
  createMessage('msg-6-9', 'conv-6', 'contact-6', 'inbound', 'Vou pensar e te retorno!', hoursAgo(6)),
];

// Conversa 7 - Pagamento (com imagem de comprovante)
const conv7Messages: InboxMessage[] = [
  createMessage('msg-7-1', 'conv-7', 'contact-7', 'inbound', 'Fiz o pagamento do pedido agora', hoursAgo(15)),
  createMessage('msg-7-2', 'conv-7', 'contact-7', 'outbound', 'Olá Juliana! Pode enviar o comprovante para eu verificar?', hoursAgo(14.8), 'read'),
  createImageMessage('msg-7-3', 'conv-7', 'contact-7', 'inbound', DEMO_MEDIA.receipt, 'Segue o comprovante do Pix!', hoursAgo(14.5)),
  createMessage('msg-7-4', 'conv-7', 'contact-7', 'outbound', 'Recebi! Vou conferir e te retorno em instantes.', hoursAgo(14.3), 'read'),
  createMessage('msg-7-5', 'conv-7', 'contact-7', 'outbound', 'Pagamento confirmado! ✅', hoursAgo(13.5), 'read'),
  createMessage('msg-7-6', 'conv-7', 'contact-7', 'inbound', 'Ótimo! Quando enviam?', hoursAgo(13.2)),
  createMessage('msg-7-7', 'conv-7', 'contact-7', 'outbound', 'Seu pedido será despachado amanhã. Prazo de entrega é de 3 a 5 dias úteis.', hoursAgo(13), 'read'),
  createMessage('msg-7-8', 'conv-7', 'contact-7', 'inbound', 'Perfeito!', hoursAgo(12.5)),
  createMessage('msg-7-9', 'conv-7', 'contact-7', 'outbound', 'Pagamento confirmado! Seu pedido será enviado em breve. 🚚', hoursAgo(12), 'read'),
];

// Conversa 8 - Horário de funcionamento (com áudio)
const conv8Messages: InboxMessage[] = [
  createAudioMessage('msg-8-1', 'conv-8', 'contact-8', 'inbound', DEMO_MEDIA.audio1, hoursAgo(22)),
  createMessage('msg-8-2', 'conv-8', 'contact-8', 'outbound', 'Boa noite Roberto! Funcionamos de segunda a sexta, das 9h às 18h.', hoursAgo(21), 'read'),
  createMessage('msg-8-3', 'conv-8', 'contact-8', 'inbound', 'E aos sábados?', hoursAgo(20.5)),
  createMessage('msg-8-4', 'conv-8', 'contact-8', 'outbound', 'Aos sábados atendemos das 9h às 13h, somente com agendamento prévio.', hoursAgo(20), 'read'),
  createMessage('msg-8-5', 'conv-8', 'contact-8', 'inbound', 'Entendi. Vocês atendem por videochamada?', hoursAgo(19)),
  createAudioMessage('msg-8-6', 'conv-8', 'contact-8', 'outbound', DEMO_MEDIA.audio2, hoursAgo(18.5), 'read'),
  createMessage('msg-8-7', 'conv-8', 'contact-8', 'inbound', 'Ótimo! Vou agendar para a semana que vem então.', hoursAgo(18.2)),
  createMessage('msg-8-8', 'conv-8', 'contact-8', 'outbound', 'Perfeito! Aguardo seu contato. 📅', hoursAgo(18), 'read'),
];

// Conversa 9 - Resolvida
const conv9Messages: InboxMessage[] = [
  createMessage('msg-9-1', 'conv-9', 'contact-9', 'inbound', 'Preciso de ajuda com minha conta', daysAgo(2)),
  createMessage('msg-9-2', 'conv-9', 'contact-9', 'outbound', 'Olá Fernanda! Pode me informar seu email de cadastro?', daysAgo(1.9), 'read'),
  createMessage('msg-9-3', 'conv-9', 'contact-9', 'inbound', 'fernanda.rocha@email.com', daysAgo(1.8)),
  createMessage('msg-9-4', 'conv-9', 'contact-9', 'outbound', 'Localizei sua conta. Qual o problema?', daysAgo(1.7), 'read'),
  createMessage('msg-9-5', 'conv-9', 'contact-9', 'inbound', 'Não estou conseguindo alterar minha senha', daysAgo(1.6)),
  createMessage('msg-9-6', 'conv-9', 'contact-9', 'outbound', 'Vou enviar um link de redefinição de senha para seu email agora.', daysAgo(1.5), 'read'),
  createMessage('msg-9-7', 'conv-9', 'contact-9', 'outbound', 'Pronto! Enviado. Verifique sua caixa de entrada.', daysAgo(1.4), 'read'),
  createMessage('msg-9-8', 'conv-9', 'contact-9', 'inbound', 'Recebi! Consegui alterar. Muito obrigada pela ajuda!', daysAgo(1)),
];

// Conversa 10 - Janela fechada (com documento XLSX)
const conv10Messages: InboxMessage[] = [
  createMessage('msg-10-1', 'conv-10', 'contact-10', 'inbound', 'Olá, gostaria de uma proposta comercial', daysAgo(4)),
  createMessage('msg-10-2', 'conv-10', 'contact-10', 'outbound', 'Olá Thiago! Claro! Pode me contar mais sobre sua necessidade?', daysAgo(3.9), 'read'),
  createMessage('msg-10-3', 'conv-10', 'contact-10', 'inbound', 'Preciso de um sistema para gerenciar minha equipe de vendas', daysAgo(3.8)),
  createMessage('msg-10-4', 'conv-10', 'contact-10', 'outbound', 'Quantas pessoas na equipe? E qual seu volume de vendas mensal?', daysAgo(3.5), 'read'),
  createDocumentMessage('msg-10-5', 'conv-10', 'contact-10', 'inbound', DEMO_MEDIA.xlsx_report, 'Relatorio_Vendas_Dezembro.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Segue nosso relatório do mês passado', daysAgo(3)),
  createMessage('msg-10-6', 'conv-10', 'contact-10', 'outbound', 'Excelente! Analisei o relatório. Vou preparar uma proposta personalizada para vocês.', daysAgo(2.8), 'read'),
  createMessage('msg-10-7', 'conv-10', 'contact-10', 'inbound', 'Obrigado! Aguardo', daysAgo(2.5)),
  createMessage('msg-10-8', 'conv-10', 'contact-10', 'outbound', 'Vou analisar e retorno em breve.', daysAgo(2), 'sent'),
];

// Conversa 11 - Arquivada (com contrato PDF)
const conv11Messages: InboxMessage[] = [
  createMessage('msg-11-1', 'conv-11', 'contact-11', 'inbound', 'Olá! Vocês fazem entrega para outras cidades?', daysAgo(6)),
  createMessage('msg-11-2', 'conv-11', 'contact-11', 'outbound', 'Olá Beatriz! Sim, entregamos em todo o Brasil via transportadora.', daysAgo(5.8), 'read'),
  createMessage('msg-11-3', 'conv-11', 'contact-11', 'inbound', 'Qual o prazo para Brasília?', daysAgo(5.5)),
  createMessage('msg-11-4', 'conv-11', 'contact-11', 'outbound', 'Para Brasília o prazo é de 5 a 7 dias úteis.', daysAgo(5.3), 'read'),
  createMessage('msg-11-5', 'conv-11', 'contact-11', 'inbound', 'E o frete, quanto fica?', daysAgo(5)),
  createMessage('msg-11-6', 'conv-11', 'contact-11', 'outbound', 'Depende do peso do pedido. Me passa o CEP que calculo para você.', daysAgo(4.8), 'read'),
  createMessage('msg-11-7', 'conv-11', 'contact-11', 'inbound', '70000-000', daysAgo(4.5)),
  createDocumentMessage('msg-11-8', 'conv-11', 'contact-11', 'outbound', DEMO_MEDIA.pdf_contract, 'Contrato_Servico.pdf', 'application/pdf', 'Para esse CEP, o frete fica em R$ 35,00. Segue nosso contrato padrão.', daysAgo(4), 'read'),
  createMessage('msg-11-9', 'conv-11', 'contact-11', 'inbound', 'Até a próxima!', daysAgo(3)),
];

// Conversa 12 - Antiga (com foto do defeito)
const conv12Messages: InboxMessage[] = [
  createMessage('msg-12-1', 'conv-12', 'contact-12', 'inbound', 'Meu pedido chegou com defeito', daysAgo(8)),
  createMessage('msg-12-2', 'conv-12', 'contact-12', 'outbound', 'Olá Ricardo! Sentimos muito por isso! Pode enviar uma foto do produto?', daysAgo(7.8), 'read'),
  createImageMessage('msg-12-3', 'conv-12', 'contact-12', 'inbound', DEMO_MEDIA.product2, 'Olha como chegou danificado', daysAgo(7.5)),
  createMessage('msg-12-4', 'conv-12', 'contact-12', 'outbound', 'Recebi. Realmente há um defeito. Vamos enviar um novo produto sem custo adicional.', daysAgo(7.2), 'read'),
  createMessage('msg-12-5', 'conv-12', 'contact-12', 'inbound', 'Preciso devolver o com defeito?', daysAgo(7)),
  createMessage('msg-12-6', 'conv-12', 'contact-12', 'outbound', 'Não precisa! Pode descartar ou doar. O novo será enviado amanhã.', daysAgo(6.8), 'read'),
  createAudioMessage('msg-12-7', 'conv-12', 'contact-12', 'inbound', DEMO_MEDIA.audio1, daysAgo(6.5)),
  createMessage('msg-12-8', 'conv-12', 'contact-12', 'outbound', 'Ficamos felizes em ajudar! Qualquer problema, é só nos chamar.', daysAgo(6), 'read'),
  createMessage('msg-12-9', 'conv-12', 'contact-12', 'inbound', 'Perfeito, obrigado pelo retorno!', daysAgo(5)),
];

// Mapa de mensagens por conversa
export const demoMessagesMap: Record<string, InboxMessage[]> = {
  'conv-1': conv1Messages,
  'conv-2': conv2Messages,
  'conv-3': conv3Messages,
  'conv-4': conv4Messages,
  'conv-5': conv5Messages,
  'conv-6': conv6Messages,
  'conv-7': conv7Messages,
  'conv-8': conv8Messages,
  'conv-9': conv9Messages,
  'conv-10': conv10Messages,
  'conv-11': conv11Messages,
  'conv-12': conv12Messages,
};

// Helper para obter mensagens de uma conversa
export function getDemoMessages(conversationId: string): InboxMessage[] {
  return demoMessagesMap[conversationId] || [];
}

// Helper para obter contato
export function getDemoContact(contactId: string): InboxContact | null {
  return demoContacts.find(c => c.id === contactId) || null;
}
