/**
 * Template Presets
 * 
 * Biblioteca de templates pré-aprovados para início rápido
 */

import { TemplateComponent, TemplateButton, DetectedVariable } from './templateParser';

export interface TemplatePreset {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: TemplateComponent[];
  variables: DetectedVariable[];
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ===============================
  // UTILITY - Utilitários
  // ===============================
  {
    id: 'utility_order_confirmation',
    name: 'confirmacao_pedido',
    displayName: 'Confirmação de Pedido',
    description: 'Confirma que o pedido foi recebido e está sendo processado',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '✅ Pedido Confirmado!',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}! Seu pedido #{{2}} foi confirmado com sucesso.\n\nValor total: R$ {{3}}\nPrevisão de entrega: {{4}}\n\nAcompanhe seu pedido pelo nosso site.',
      },
      {
        type: 'FOOTER',
        text: 'Obrigado pela preferência!',
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'João', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Número do pedido', required: true, example: '12345', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Valor total', required: true, example: '150,00', section: 'BODY' },
      { index: 4, key: 'var_4', label: 'Data de entrega', required: true, example: '15/01/2026', section: 'BODY' },
    ],
  },
  {
    id: 'utility_appointment_reminder',
    name: 'lembrete_agendamento',
    displayName: 'Lembrete de Agendamento',
    description: 'Lembra o cliente sobre um compromisso agendado',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '📅 Lembrete de Agendamento',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nLembramos que você tem um agendamento:\n\n📍 Local: {{2}}\n📆 Data: {{3}}\n⏰ Horário: {{4}}\n\nPor favor, confirme sua presença respondendo esta mensagem.',
      },
      {
        type: 'FOOTER',
        text: 'Em caso de imprevisto, avise com antecedência.',
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Maria', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Local', required: true, example: 'Clínica Centro', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Data', required: true, example: '20/01/2026', section: 'BODY' },
      { index: 4, key: 'var_4', label: 'Horário', required: true, example: '14:30', section: 'BODY' },
    ],
  },
  {
    id: 'utility_order_status',
    name: 'status_pedido',
    displayName: 'Atualização de Status do Pedido',
    description: 'Informa o cliente sobre mudanças no status do pedido',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '📦 Atualização do Pedido',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nSeu pedido #{{2}} foi atualizado:\n\n🔄 Novo status: {{3}}\n\nVocê pode acompanhar em tempo real pelo link abaixo.',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Acompanhar Pedido',
            url: 'https://seusite.com/rastreio/{{1}}',
            url_suffix_variable: true,
          },
        ],
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Carlos', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Número do pedido', required: true, example: '67890', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Status atual', required: true, example: 'Em trânsito', section: 'BODY' },
    ],
  },
  {
    id: 'utility_payment_confirmation',
    name: 'confirmacao_pagamento',
    displayName: 'Confirmação de Pagamento',
    description: 'Confirma que o pagamento foi recebido',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '💳 Pagamento Confirmado',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nRecebemos seu pagamento de R$ {{2}}.\n\nNúmero da transação: {{3}}\nData: {{4}}\n\nObrigado!',
      },
      {
        type: 'FOOTER',
        text: 'Guarde este comprovante.',
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Ana', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Valor pago', required: true, example: '250,00', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Número da transação', required: true, example: 'TXN123456', section: 'BODY' },
      { index: 4, key: 'var_4', label: 'Data do pagamento', required: true, example: '14/01/2026', section: 'BODY' },
    ],
  },

  // ===============================
  // AUTHENTICATION - Autenticação
  // ===============================
  {
    id: 'auth_verification_code',
    name: 'codigo_verificacao',
    displayName: 'Código de Verificação',
    description: 'Envia código OTP para verificação de conta',
    category: 'AUTHENTICATION',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        text: 'Seu código de verificação é: {{1}}\n\nEste código expira em 10 minutos.\n\n⚠️ Não compartilhe este código com ninguém.',
      },
      {
        type: 'FOOTER',
        text: 'Se você não solicitou, ignore.',
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Código OTP', required: true, example: '123456', section: 'BODY' },
    ],
  },
  {
    id: 'auth_password_reset',
    name: 'redefinir_senha',
    displayName: 'Redefinição de Senha',
    description: 'Envia link ou código para redefinir senha',
    category: 'AUTHENTICATION',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '🔐 Redefinição de Senha',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nRecebemos uma solicitação para redefinir sua senha.\n\nSeu código é: {{2}}\n\nEste código expira em 15 minutos.',
      },
      {
        type: 'FOOTER',
        text: 'Se não foi você, ignore esta mensagem.',
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do usuário', required: true, example: 'Pedro', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Código de redefinição', required: true, example: '789012', section: 'BODY' },
    ],
  },

  // ===============================
  // MARKETING - Marketing
  // ===============================
  {
    id: 'marketing_promo_discount',
    name: 'promocao_desconto',
    displayName: 'Promoção com Desconto',
    description: 'Convida o cliente para uma promoção especial',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '🎉 Promoção Especial!',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nTemos uma oferta exclusiva para você:\n\n🔥 {{2}}% de desconto em toda a loja!\n📅 Válido até: {{3}}\n🎁 Use o cupom: {{4}}\n\nNão perca essa oportunidade!',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Aproveitar Agora',
            url: 'https://seusite.com/promo',
          },
          {
            type: 'QUICK_REPLY',
            text: 'Não tenho interesse',
          },
        ],
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Fernanda', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Percentual de desconto', required: true, example: '30', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Data de validade', required: true, example: '31/01/2026', section: 'BODY' },
      { index: 4, key: 'var_4', label: 'Código do cupom', required: true, example: 'PROMO30', section: 'BODY' },
    ],
  },
  {
    id: 'marketing_new_product',
    name: 'lancamento_produto',
    displayName: 'Lançamento de Produto',
    description: 'Anuncia um novo produto ou serviço',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '✨ Novidade Exclusiva!',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nTemos uma novidade incrível:\n\n🆕 {{2}}\n\n{{3}}\n\nSeja um dos primeiros a conhecer!',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Conhecer Agora',
            url: 'https://seusite.com/novidade',
          },
        ],
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Ricardo', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Nome do produto', required: true, example: 'Super Widget 3000', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Descrição breve', required: true, example: 'O melhor widget do mercado!', section: 'BODY' },
    ],
  },
  {
    id: 'marketing_reengagement',
    name: 'reengajamento',
    displayName: 'Reengajamento de Cliente',
    description: 'Traz de volta clientes inativos',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '👋 Sentimos sua falta!',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nFaz tempo que não te vemos por aqui.\n\nPreparamos um presente especial: {{2}}% de desconto na sua próxima compra!\n\nUse o código: {{3}}',
      },
      {
        type: 'FOOTER',
        text: 'Válido por tempo limitado.',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Voltar a Comprar',
            url: 'https://seusite.com',
          },
        ],
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Luciana', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Percentual de desconto', required: true, example: '20', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Código do cupom', required: true, example: 'VOLTEI20', section: 'BODY' },
    ],
  },
  {
    id: 'marketing_event_invite',
    name: 'convite_evento',
    displayName: 'Convite para Evento',
    description: 'Convida clientes para um evento especial',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '🎊 Você está Convidado!',
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}!\n\nVocê está convidado(a) para:\n\n🎉 {{2}}\n📍 {{3}}\n📅 {{4}}\n⏰ {{5}}\n\nConfirme sua presença!',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Confirmar presença',
          },
          {
            type: 'QUICK_REPLY',
            text: 'Não poderei ir',
          },
        ],
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome do cliente', required: true, example: 'Marcos', section: 'BODY' },
      { index: 2, key: 'var_2', label: 'Nome do evento', required: true, example: 'Workshop de Vendas', section: 'BODY' },
      { index: 3, key: 'var_3', label: 'Local', required: true, example: 'Centro de Convenções', section: 'BODY' },
      { index: 4, key: 'var_4', label: 'Data', required: true, example: '25/01/2026', section: 'BODY' },
      { index: 5, key: 'var_5', label: 'Horário', required: true, example: '19:00', section: 'BODY' },
    ],
  },

  // ===============================
  // SIMPLE TEMPLATES
  // ===============================
  {
    id: 'simple_hello',
    name: 'ola_simples',
    displayName: 'Saudação Simples',
    description: 'Template básico de saudação',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        text: 'Olá {{1}}! Como posso te ajudar hoje?',
      },
    ],
    variables: [
      { index: 1, key: 'var_1', label: 'Nome', required: true, example: 'Cliente', section: 'BODY' },
    ],
  },
];

/**
 * Agrupa presets por categoria
 */
export function getPresetsByCategory(): Record<string, TemplatePreset[]> {
  return TEMPLATE_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.category]) {
      acc[preset.category] = [];
    }
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<string, TemplatePreset[]>);
}

/**
 * Busca um preset pelo ID
 */
export function getPresetById(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find((p) => p.id === id);
}

/**
 * Mapeia categoria para label amigável
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    MARKETING: 'Marketing',
    UTILITY: 'Utilitário',
    AUTHENTICATION: 'Autenticação',
  };
  return labels[category] || category;
}
